import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ExternalCreditsService, type SyncResult } from './external-credits.service';
import { Roles } from '../common/decorators';
import type { IntegrationSystem } from '../integrations/integrations.types';

const VALID: IntegrationSystem[] = ['juridico', 'pos'];

function parseSystem(value?: string): IntegrationSystem {
  const system = value as IntegrationSystem;
  if (!VALID.includes(system)) return 'juridico';
  return system;
}

interface ListItem {
  id: string;
  sistema: string;
  externalId: string;
  clienteNombre: string;
  cedula?: string;
  telefono?: string;
  direccion?: string;
  referencia?: string;
  referenciaDetalle?: string;
  concepto?: string;
  montoTotal: number;
  saldoPendiente: number;
  estado?: string;
  updatedAtExterno?: number;
  syncedAt?: number;
}

/** Creditos externos sincronizados a local (juridico/pos). Lectura para cualquier usuario autenticado. */
@Controller('external-credits')
export class ExternalCreditsController {
  constructor(private readonly externalCredits: ExternalCreditsService) {}

  @Get()
  async list(@Query('system') system?: string): Promise<ListItem[]> {
    const docs = await this.externalCredits.list(parseSystem(system));
    return docs.map((d) => ({
      id: String(d._id),
      sistema: d.sistema,
      externalId: d.externalId,
      clienteNombre: d.clienteNombre ?? '',
      cedula: d.cedula,
      telefono: d.telefono,
      direccion: d.direccion,
      referencia: d.referencia,
      referenciaDetalle: d.referenciaDetalle,
      concepto: d.concepto,
      montoTotal: d.montoTotal ?? 0,
      saldoPendiente: d.saldoPendiente ?? 0,
      estado: d.estado,
      updatedAtExterno: d.updatedAtExterno,
      syncedAt: d.syncedAt,
    }));
  }

  @Get('summary')
  summary(@Query('system') system?: string) {
    return this.externalCredits.summary(parseSystem(system));
  }

  /** Dispara una sincronizacion manual contra el sistema de origen (solo ADMIN). */
  @Roles('ADMIN')
  @Post(':system/sync')
  sync(@Param('system') system: string): Promise<SyncResult> {
    return this.externalCredits.sync(parseSystem(system));
  }
}
