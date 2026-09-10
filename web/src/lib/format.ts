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

/**
 * Fecha de HOY en formato `yyyy-mm-dd` usando la hora LOCAL (no UTC).
 * `toISOString()` se corre un día en Paraguay (UTC-3/-4) después de las 21:00,
 * por eso se arma con los componentes locales.
 */
export const localTodayInput = (): string => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

/**
 * Convierte un `<input type="date">` (yyyy-mm-dd) a epoch ms a MEDIODÍA local:
 * así la fecha del cobro que elige el cobrador nunca se corre por zona horaria.
 */
export const dateInputToMs = (value?: string): number | undefined =>
  value ? new Date(`${value}T12:00:00`).getTime() : undefined;

/**
 * Normaliza texto para BUSCAR: minúsculas y sin tildes.
 * Clave en Paraguay: el cobrador escribe "gimenez" y debe encontrar "GIMÉNEZ"
 * (y "nunez" -> "NÚÑEZ"). NFD descompone la tilde y el rango la elimina.
 */
export const normalizeSearch = (value?: string): string =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim();
