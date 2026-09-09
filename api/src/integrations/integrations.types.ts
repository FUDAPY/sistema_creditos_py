export type IntegrationSystem = 'pos' | 'juridico' | 'financiero';

export interface IntegrationStatus {
  system: IntegrationSystem;
  /** Direccion del flujo: inbound = importa datos; outbound = envia datos. */
  direction: 'inbound' | 'outbound';
  enabled: boolean;
  configured: boolean;
  detail: string;
}

/**
 * Vista normalizada de un credito externo (POS/Juridico) importado de otro sistema.
 * Es el contrato común entre los adaptadores y la sincronización local.
 */
export interface RemoteCredit {
  externalId: string;
  sistema: Extract<IntegrationSystem, 'pos' | 'juridico'>;
  clienteNombre: string;
  cedula?: string;
  telefono?: string;
  direccion?: string;
  /** Referencia del caso: caratula/expediente (juridico) o nro. de operacion (POS). */
  referencia?: string;
  /** Detalle extra de la referencia: juzgado/fuero (juridico) o local/sucursal (POS). */
  referenciaDetalle?: string;
  concepto?: string;
  montoTotal: number;
  saldoPendiente: number;
  estado?: string;
  /** Fecha (ms) de la última actualización del sistema de origen. */
  updatedAt?: number;
}

