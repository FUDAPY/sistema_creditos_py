import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IntegrationsService } from '../integrations/integrations.service';
import type { IntegrationSystem, RemoteCredit } from '../integrations/integrations.types';

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
    @InjectModel('Loan') private readonly loanModel: Model<Record<string, unknown>>,
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
        // Espejo local cobrable del crédito externo (para el flujo de cobro/rendición).
        // Un fallo puntual no debe tumbar toda la sincronización.
        try {
          await this.mirrorLoan(system, companyId, row, syncedAt);
        } catch (mirrorErr) {
          this.logger.warn(
            `No se pudo crear espejo local ${system}/${row.externalId}: ${
              mirrorErr instanceof Error ? mirrorErr.message : String(mirrorErr)
            }`,
          );
        }
      }

      return { sistema: system, imported, skipped, total: rows.length, syncedAt } satisfies SyncResult;
    })();

    this.running.set(system, run);
    try {
      return await run;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.error(`Sync ${system} falló: ${detail}`);
      throw new ServiceUnavailableException(`Sincronización ${system} falló: ${detail}`);
    } finally {
      this.running.delete(system);
    }
  }

  /** Crea/actualiza el crédito espejo local (cobrable) del crédito externo sincronizado. */
  private async mirrorLoan(
    system: IntegrationSystem,
    companyId: string,
    row: RemoteCredit,
    syncedAt: number,
  ): Promise<void> {
    if (!row.externalId) return;
    const id = `ext-${system}-${row.externalId}`;
    const existing = await this.loanModel.findOne({ _id: id }).exec();
    const base = {
      clientName: row.clienteNombre || '',
      clientNameLower: (row.clienteNombre || '').trim().toLowerCase(),
      principal: Math.round(row.montoTotal || 0),
      totalAmount: Math.round(row.montoTotal || 0),
      updatedAt: syncedAt,
    };
    if (!existing) {
      const saldo = Math.max(0, Math.round(row.saldoPendiente || 0));
      await this.loanModel.create({
        _id: id,
        id,
        companyId,
        clientId: (() => {
          const ext = String(
            (row as unknown as { clienteJuridicoId?: string }).clienteJuridicoId || '',
          ).trim();
          // El schema de Loan exige clientId no vacío: los espejos externos usan un id sintético.
          return ext.length > 0 ? ext : `externo:${row.externalId}`;
        })(),
        clientDocumentId: row.cedula || '',
        clientPhone: row.telefono || '',
        clientAddress: row.direccion || '',
        collectorId: '',
        collectorName: '',
        currency: 'PYG',
        interestRate: 0,
        loanType: 'PRESTAMO',
        ...base,
        paidAmount: 0,
        currentBalance: saldo,
        accruedInterestBalance: 0,
        accruedLateFeeBalance: 0,
        status: saldo > 0 ? 'ACTIVE' : 'PAID',
        approvalStatus: 'APPROVED',
        grantedAt: syncedAt,
        expiresAt: syncedAt,
        nextDueDate: syncedAt,
        cycleDays: 30,
        origen: system === 'juridico' ? 'juridico' : 'pos',
        externalSource: system,
        externalId: row.externalId,
        createdAt: syncedAt,
      });
      return;
    }
    // En actualizaciones NO se toca el saldo local (puede haber cobros aplicados).
    await this.loanModel.updateOne({ _id: id }, { $set: base }).exec();
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
