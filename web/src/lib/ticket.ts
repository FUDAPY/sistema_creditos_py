/* Ticket térmico 80mm para comprobantes de pago (Chicolín Préstamos). */

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

/** Abre la ventana de impresión del ticket de pago (ancho 80mm). */
export function printPaymentTicket(p: TicketData): void {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Ticket de pago</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body { width: 78mm; margin: 0 auto; padding: 2mm 1mm 4mm; font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.35; color: #000; }
  h1 { font-size: 13px; margin: 1mm 0; text-align: center; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .big { font-size: 13px; }
  hr { border: none; border-top: 1px dashed #000; margin: 2mm 0; }
  .line { display: flex; justify-content: space-between; gap: 4mm; }
  .line span:first-child { white-space: nowrap; }
  .footer { margin-top: 3mm; text-align: center; font-size: 10px; }
</style></head><body>
  <h1>LOGO DE LA EMPRESA</h1>
  <p class="center bold">ESTUDIO JURIDICO<br>LIN GROUP Y ASOCIADOS<br>
    Galeria Jebai Center<br>2do Piso Torre A<br>CIUDAD DEL ESTE, PARAGUAY</p>
  <hr>
  <p class="center bold">COPIA CLIENTE<br><span class="big">TICKET DE PAGO</span></p>
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
  <p class="center" style="font-size:10px">[Si no se imprimió: Ctrl+P]</p>
</body></html>`;

  const win = window.open('', '_blank', 'width=340,height=640,menubar=no,toolbar=no');
  if (!win) {
    alert('Permití las ventanas emergentes para imprimir el ticket.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 150);
}
