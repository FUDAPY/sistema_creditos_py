import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IntegrationsService } from '../integrations/integrations.service';
import type { IntegrationSystem } from '../integrations/integrations.types';

interface ExternalCreditDoc {
  _id: string;
  companyId: string;
  sistema: string;
  externalId: string;
  clienteNombre?: string;
  cedula?: string;
  telefono?: string;
  direccion?: string;
  referencia?: string;
  referenciaDetalle?: string;
  concepto?: string;
  montoTotal?: number;
  saldoPendiente?: number;
  estado?: string;
  updatedAtExterno?: number;
  syncedAt?: number;
}

export interface SyncResult {
  sistema: string;
  imported: number;
  skipped: number;
  total: number;
  syncedAt: number;
}

const IMPORTABLE_SYSTEMS: IntegrationSystem[] = ['juridico', 'pos'];

/**
 * Sincroniza periodicamente los creditos de sistemas externos (juridico, pos)
 * a la coleccion local `externalCredits` (solo lectura del origen).
 * La primera corrida ocurre al arrancar; luego en el intervalo configurado.
 */
@Injectable()
export class ExternalCreditsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExternalCreditsService.name);
  private timers: Array<ReturnType<typeof setInterval>> = [];
  private running = new Map<string, Promise<unknown>>();

  constructor(
    @InjectModel('ExternalCredit') private readonly model: Model<ExternalCreditDoc>,
    private readonly config: ConfigService,
    private readonly integrations: IntegrationsService,
  ) {}

  private companyId(): string {
    return this.config.get<string>('COMPANY_ID', 'lin_group_sa_001');
  }

  async onModuleInit(): Promise<void> {
    for (const system of IMPORTABLE_SYSTEMS) {
      await this.safeSync(system);
    }
    if (this.config.get<string>('EXTERNAL_CREDIT_AUTO_SYNC', 'true') !== 'false') {
      const intervalMs = Number(this.config.get('EXTERNAL_CREDIT_SYNC_INTERVAL_MS', 6 * 60 * 60 * 1000));
      const timer = setInterval(() => {
        for (const system of IMPORTABLE_SYSTEMS) void this.safeSync(system);
      }, Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 6 * 60 * 60 * 1000);
      this.timers.push(timer);
      this.logger.log('Auto-sync de creditos externos activado (juridico, pos).');
    }
  }

  onModuleDestroy(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  /** Sincroniza sin propagar errores (para arranque/intervalo). */
  private async safeSync(system: IntegrationSystem): Promise<void> {
    try {
      const res = await this.sync(system);
      this.logger.log(
        `Sync ${system}: ${res.imported} importados / ${res.total} en origen (${new Date(res.syncedAt).toISOString()}).`,
      );
    } catch (err) {
      this.logger.warn(`Sync ${system} omitido: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async sync(system: IntegrationSystem, companyIdOverride?: string): Promise<SyncResult> {
    if (!IMPORTABLE_SYSTEMS.includes(system)) {
      throw new Error(`Sistema externo "${system}" no soportado para sincronizacion.`);
    }
    const previous = this.running.get(system);
    if (previous) await previous;

    const run = (async () => {
      const companyId = companyIdOverride || this.companyId();
      const rows = await this.integrations.remoteCredits(system);
      const syncedAt = Date.now();
      let imported = 0;
      let skipped = 0;

      for (const row of rows) {
        if (!row.externalId) {
          skipped += 1;
          continue;
        }
        await this.model
          .updateOne(
            { companyId, sistema: system, externalId: row.externalId },
            {
              $set: {
                sistema: system,
                externalId: row.externalId,
                clienteNombre: row.clienteNombre,
                cedula: row.cedula,
                telefono: row.telefono,
                direccion: row.direccion,
                referencia: row.referencia,
                referenciaDetalle: row.referenciaDetalle,
                concepto: row.concepto,
                montoTotal: row.montoTotal,
                saldoPendiente: row.saldoPendiente,
                estado: row.estado,
                updatedAtExterno: row.updatedAt,
                syncedAt,
              },
            },
            { upsert: true, setDefaultsOnInsert: true },
          )
          .exec();
        imported += 1;
      }

      return { sistema: system, imported, skipped, total: rows.length, syncedAt } satisfies SyncResult;
    })();

    this.running.set(system, run);
    try {
      return await run;
    } finally {
      this.running.delete(system);
    }
  }

  async list(system: IntegrationSystem, companyIdOverride?: string): Promise<ExternalCreditDoc[]> {
    const companyId = companyIdOverride || this.companyId();
    const docs = await this.model
      .find({ companyId, sistema: system })
      .sort({ syncedAt: -1, updatedAtExterno: -1 })
      .exec();
    return docs.map((d) => d.toObject({ virtuals: false }) as ExternalCreditDoc);
  }

  async summary(system: IntegrationSystem): Promise<{
    sistema: string;
    total: number;
    activos: number;
    montoTotal: number;
    saldoPendiente: number;
  }> {
    const companyId = this.companyId();
    const [total, activos, sums] = await Promise.all([
      this.model.countDocuments({ companyId, sistema: system }),
      this.model.countDocuments({ companyId, sistema: system, saldoPendiente: { $gt: 0 } }),
      this.model
        .aggregate<{ montoTotal: number; saldoPendiente: number }>([
          { $match: { companyId, sistema: system } },
          { $group: { _id: null, montoTotal: { $sum: '$montoTotal' }, saldoPendiente: { $sum: '$saldoPendiente' } } },
        ])
        .exec(),
    ]);
    return {
      sistema: system,
      total,
      activos,
      montoTotal: sums[0]?.montoTotal ?? 0,
      saldoPendiente: sums[0]?.saldoPendiente ?? 0,
    };
  }
}
