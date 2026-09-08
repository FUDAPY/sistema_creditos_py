import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IntegrationStatus, IntegrationSystem } from './integrations.types';

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
        configured: this.hasCredentials(['INTEGRATION_JURIDICO_URL']),
        detail: juridicoEnabled
          ? 'Importacion de creditos juridicos habilitada (reconexion pendiente de adaptador).'
          : 'Deshabilitada. El sistema juridico (en VPS) se conectara en una fase posterior.',
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
  async runSync(system: IntegrationSystem): Promise<{ system: IntegrationSystem; ran: boolean }> {
    const status = this.statuses().find((item) => item.system === system);
    if (!status?.enabled) {
      throw new ServiceUnavailableException(
        `Integracion "${system}" deshabilitada. Active ${this.envKeyOf(system)} para reconectarla.`,
      );
    }
    // TODO(fase de reconexion): implementar el adaptador especifico (lectura/escritura HTTP).
    return { system, ran: false };
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
