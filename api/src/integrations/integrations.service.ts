import { Injectable, BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  IntegrationStatus,
  IntegrationSystem,
  RemoteCredit,
} from './integrations.types';
import {
  fetchJuridicoCreditosWithFallback,
  type JuridicoCreditoView,
} from './juridico.connector';
import { fetchPosCreditos } from './pos.connector';

/**
 * Gateway de integraciones con sistemas externos (POS, Juridico, Financiero).
 * Estado por defecto: DESHABILITADAS (enabled=false). La reconexion posterior
 * solo requiere activar la env correspondiente y completar el adaptador.
 */
@Injectable()
export class IntegrationsService {
  constructor(private readonly config: ConfigService) {}

  private isEnabled(key: string): boolean {
    return this.config.get<string>(key, 'false') === 'true';
  }

  private hasCredentials(keys: string[]): boolean {
    return keys.some((key) => Boolean(this.config.get<string>(key, '')));
  }

  statuses(): IntegrationStatus[] {
    const posEnabled = this.isEnabled('INTEGRATION_POS_ENABLED');
    const juridicoEnabled = this.isEnabled('INTEGRATION_JURIDICO_ENABLED');
    const financieroEnabled = this.isEnabled('INTEGRATION_FINANCIERO_ENABLED');

    return [
      {
        system: 'pos',
        direction: 'inbound',
        enabled: posEnabled,
        configured: this.hasCredentials(['INTEGRATION_POS_URL']),
        detail: posEnabled
          ? 'Importacion de clientes/deudas del POS habilitada (reconexion pendiente de adaptador).'
          : 'Deshabilitada. Se conectara al POS en una fase posterior.',
      },
      {
        system: 'juridico',
        direction: 'inbound',
        enabled: juridicoEnabled,
        configured:
          this.hasCredentials(['INTEGRATION_JURIDICO_URL']) &&
          Boolean(this.config.get<string>('INTEGRATION_JURIDICO_DB', '')),
        detail: juridicoEnabled
          ? 'Importacion de creditos juridicos habilitada (lee MongoDB del sistema lin-group-central).'
          : 'Deshabilitada. El sistema juridico (lin-group-central) se conecta leyendo su MongoDB.',
      },
      {
        system: 'financiero',
        direction: 'outbound',
        enabled: financieroEnabled,
        configured: this.hasCredentials(['INTEGRATION_FINANCIERO_URL', 'INTEGRATION_FINANCIERO_BRANCH_ID']),
        detail: financieroEnabled
          ? 'Sincronizacion contable (movimientos) habilitada (reconexion pendiente de adaptador).'
          : 'Deshabilitada. Rendiciones/movimientos se reconectaran en una fase posterior.',
      },
    ];
  }

  /** Ejecuta la sincronizacion de un sistema. Mientras este deshabilitado, responde 503. */
  async runSync(
    system: IntegrationSystem,
  ): Promise<{ system: IntegrationSystem; ran: boolean; imported?: number }> {
    const status = this.statuses().find((item) => item.system === system);
    if (!status?.enabled) {
      throw new ServiceUnavailableException(
        `Integracion "${system}" deshabilitada. Active ${this.envKeyOf(system)} para reconectarla.`,
      );
    }
    if (system === 'juridico') {
      const rows = await this.juridicoCreditos();
      return { system, ran: true, imported: rows.length };
    }
    // TODO(fase de reconexion): implementar el adaptador especifico (lectura/escritura HTTP).
    return { system, ran: false };
  }

  /** Devuelve clientes con creditos juridicos (lectura SOLO-lectura de la MongoDB remota). */
  async juridicoCreditos(): Promise<JuridicoCreditoView[]> {
    const status = this.statuses().find((item) => item.system === 'juridico');
    if (!status?.enabled) {
      throw new ServiceUnavailableException(
        'Integracion juridico deshabilitada. Active INTEGRATION_JURIDICO_ENABLED=true.',
      );
    }
    const uri = this.config.get<string>('INTEGRATION_JURIDICO_URL', '');
    const db = this.config.get<string>('INTEGRATION_JURIDICO_DB', '');
    if (!uri || !db) {
      throw new ServiceUnavailableException(
        'Integracion juridico sin configurar: defina INTEGRATION_JURIDICO_URL (URI Mongo) e INTEGRATION_JURIDICO_DB.',
      );
    }
    try {
      return await fetchJuridicoCreditosWithFallback(uri, db);
    } catch (err) {
      throw new BadGatewayException(
        err instanceof Error
          ? err.message
          : 'No se pudo conectar con la base del sistema jurídico (revise red/credenciales).',
      );
    }
  }

  /**
   * Devuelve los creditos externos NORMALIZADOS (RemoteCredit) de un sistema
   * inbound. Contrato común usado por la sincronización local (external-credits).
   */
  async remoteCredits(system: IntegrationSystem): Promise<RemoteCredit[]> {
    if (system === 'juridico') {
      const rows = await this.juridicoCreditos();
      return rows.map((r): RemoteCredit => {
        const detalle = [r.juzgado, r.fuero].filter(Boolean).join(' · ') || undefined;
        return {
          externalId: r.id,
          sistema: 'juridico',
          clienteNombre: r.clienteNombre,
          cedula: r.cedula,
          telefono: r.telefono,
          direccion: r.direccion,
          referencia: r.caratula || r.descripcion || undefined,
          referenciaDetalle: detalle,
          concepto: r.concepto,
          montoTotal: r.montoTotal,
          saldoPendiente: r.saldoPendiente,
          estado: r.estadoExpediente ?? (r.saldoPendiente > 0 ? 'activo' : 'pagado'),
          updatedAt: r.updatedAt,
        };
      });
    }
    if (system === 'pos') {
      const status = this.statuses().find((item) => item.system === 'pos');
      if (!status?.enabled) {
        throw new ServiceUnavailableException(
          'Integracion POS deshabilitada. Active INTEGRATION_POS_ENABLED=true.',
        );
      }
      const url = this.config.get<string>('INTEGRATION_POS_URL', '');
      if (!url) {
        throw new ServiceUnavailableException(
          'Integracion POS sin configurar: defina INTEGRATION_POS_URL (URL base de su API).',
        );
      }
      const token = this.config.get<string>('INTEGRATION_POS_TOKEN', '') || undefined;
      return fetchPosCreditos(url, token);
    }
    throw new ServiceUnavailableException(`El sistema "${system}" no exporta creditos importables.`);
  }

  private envKeyOf(system: IntegrationSystem): string {
    const map: Record<IntegrationSystem, string> = {
      pos: 'INTEGRATION_POS_ENABLED',
      juridico: 'INTEGRATION_JURIDICO_ENABLED',
      financiero: 'INTEGRATION_FINANCIERO_ENABLED',
    };
    return map[system];
  }
}
