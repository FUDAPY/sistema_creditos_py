export type IntegrationSystem = 'pos' | 'juridico' | 'financiero';

export interface IntegrationStatus {
  system: IntegrationSystem;
  /** Direccion del flujo: inbound = importa datos; outbound = envia datos. */
  direction: 'inbound' | 'outbound';
  enabled: boolean;
  configured: boolean;
  detail: string;
}
