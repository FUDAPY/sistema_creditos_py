/**
 * Formato de moneda global de SysCreditos.
 * Guaraníes NO usan decimales: siempre entero redondeado con punto como separador
 * de miles (2.000.000). Nunca se muestran centavos.
 */
const MONEY = new Intl.NumberFormat('es-PY', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const money = (value?: number): string => MONEY.format(Math.round(value ?? 0));
