/* Ticket térmico 80mm para comprobantes de pago (Chicolín Préstamos).
   Cada impresión genera DOS copias con el mismo formato: COPIA CLIENTE y
   COPIA ADMINISTRACION, separadas por una línea de corte. */

export interface TicketData {
  id?: string;
  loanId?: string;
  amount: number;
  paymentType?: string;
  paidAt?: number;
  createdAt?: number;
  previousBalance?: number;
  principalApplied?: number;
  interestApplied?: number;
  arrearsApplied?: number;
  approvalStatus?: string;
  clientName?: string;
  clientDocumentId?: string;
  collectorName?: string;
  currency?: string;
}

const money = (v?: number) => Math.round(v ?? 0).toLocaleString('es-PY');
const ticketType = (t?: string) =>
  t === 'MIXED' ? 'MIXTO' : t === 'CAPITAL' ? 'CAPITAL' : t === 'INTEREST' ? 'INTERES' : (t || '').toUpperCase();
const estadoLabel = (s?: string) =>
  s === 'APPROVED' ? 'APROBADO' : s === 'PENDING' ? 'PENDIENTE DE APROBACION' : s === 'REJECTED' ? 'RECHAZADO' : (s || 'APROBADO').toUpperCase();
const ticketNumber = (id?: string) => {
  const clean = (id || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 12)
    .toUpperCase();
  return clean ? `T-${clean}` : `T-${Date.now().toString(36).toUpperCase()}`;
};
const fmtDate = (t?: number) =>
  t
    ? new Intl.DateTimeFormat('es-PY', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(t))
    : '-';

/** Cuerpo idéntico de una copia del ticket (mismo formato para ambas copias). */
const copyHtml = (
  p: TicketData,
  label: 'COPIA CLIENTE' | 'COPIA ADMINISTRACION',
  logoDataUrl: string | null,
  last = false,
) => `
<div class="copy ${last ? 'last' : ''}">
  ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="Chicolin Prestamos" />` : '<h1>CHICOLIN PRESTAMOS</h1>'}
  <p class="center bold">ESTUDIO JURIDICO<br>LIN GROUP Y ASOCIADOS<br>
    Edificio BIJ<br>2do Piso - Av. Camilo Recalde c/ Av. Capitan Miranda<br>CIUDAD DEL ESTE, PARAGUAY</p>
  <hr>
  <p class="center bold">${label}<br><span class="big">TICKET DE PAGO</span></p>
  <div class="line"><span>Fecha:</span><span>${fmtDate(p.paidAt || p.createdAt)}</span></div>
  <div class="line"><span>Ticket Nro:</span><span>${ticketNumber(p.id)}</span></div>
  <div class="line"><span>Credito ID:</span><span>${p.loanId || '-'}</span></div>
  <div class="line"><span>Moneda:</span><span>${p.currency === 'USD' ? 'US$' : 'GS'}</span></div>
  <div class="line"><span>Cobrador:</span><span>${p.collectorName || '-'}</span></div>
  <hr>
  <div>Cliente:</div>
  <div class="bold">${p.clientName || '-'}</div>
  <div>C.I.: ${p.clientDocumentId || '-'}</div>
  <div>Estado:</div>
  <div class="bold">${estadoLabel(p.approvalStatus)}</div>
  <div class="line"><span>Saldo Anterior:</span><span>GS ${money(p.previousBalance)}</span></div>
  <div class="line"><span>Tipo:</span><span>${ticketType(p.paymentType)}</span></div>
  <div class="line"><span>Mora Aplicada:</span><span>GS ${money(p.arrearsApplied)}</span></div>
  <div class="line"><span>Interes Aplicado:</span><span>GS ${money(p.interestApplied)}</span></div>
  <div class="line"><span>Capital Aplicado:</span><span>GS ${money(p.principalApplied)}</span></div>
  <div class="line bold big"><span>MONTO PAGADO:</span><span>GS ${money(p.amount)}</span></div>
  <hr>
  <p class="center">Conserve este ticket como comprobante<br>Gracias por su preferencia</p>
  <p class="footer">© Todos los derechos reservados - OTELAX DEV de GRUPO OTELAX HOLDING<br>url: www.dev.otelax.com</p>
</div>`;

let cachedLogoDataUrl: string | null | undefined;

/** Logo embebido como dataURL (mismo origen) para que la impresora térmica lo renderice seguro. */
async function getLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;
  try {
    const res = await fetch('/logo.jpg', { cache: 'force-cache' });
    if (!res.ok) throw new Error(`logo ${res.status}`);
    const blob = await res.blob();
    cachedLogoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('No se pudo leer el logo'));
      reader.readAsDataURL(blob);
    });
  } catch {
    cachedLogoDataUrl = null;
  }
  return cachedLogoDataUrl;
}

/** Abre la ventana de impresión con las DOS copias del ticket (80mm). */
export async function printPaymentTicket(p: TicketData): Promise<void> {
  // Abrimos la ventana primero (por el gesto del usuario) y luego cargamos el logo.
  const win = window.open('', '_blank', 'width=340,height=820,menubar=no,toolbar=no');
  if (!win) {
    alert('Permití las ventanas emergentes para imprimir el ticket.');
    return;
  }
  win.document.write(
    '<p style="font:12px monospace;padding:8px;text-align:center">Preparando ticket…</p>',
  );

  const logo = await getLogoDataUrl();

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Ticket de pago</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body { width: 78mm; margin: 0 auto; padding: 2mm 1mm; font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.35; color: #000; }
  h1 { font-size: 13px; margin: 1mm 0; text-align: center; }
  .logo { display: block; margin: 0 auto 1.5mm; max-width: 74%; height: auto; filter: grayscale(1) contrast(1.15); }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .big { font-size: 13px; }
  hr { border: none; border-top: 1px dashed #000; margin: 2mm 0; }
  .line { display: flex; justify-content: space-between; gap: 4mm; }
  .line span:first-child { white-space: nowrap; }
  .footer { margin-top: 3mm; text-align: center; font-size: 10px; }
  .copy { page-break-after: always; }
  .copy.last { page-break-after: auto; }
  .cut { text-align: center; color: #333; margin: 1mm 0 2mm; letter-spacing: 1px; }
</style></head><body>
${copyHtml(p, 'COPIA CLIENTE', logo)}
<div class="cut">- - - - - - - - CORTAR AQUÍ - - - - - - - -</div>
${copyHtml(p, 'COPIA ADMINISTRACION', logo, true)}
</body></html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 250);
}
