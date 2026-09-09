import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, apiPost } from '../lib/api';
import { printPaymentTicket, type TicketData } from '../lib/ticket';

interface PaymentRow {
  id: string;
  loanId: string;
  clientName?: string;
  clientDocumentId?: string;
  collectorName?: string;
  amount: number;
  paymentType?: string;
  createdAt?: number;
  paidAt?: number;
}

const fmt = (v: number) => Math.round(v).toLocaleString('es-PY');
const fmtDate = (t?: number) =>
  t ? new Intl.DateTimeFormat('es-PY', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(t)) : '-';
const dayStart = (iso: string) => {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
};

export default function AprobarRendicion() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sel, setSel] = useState<string[]>([]);

  const load = useCallback(() => {
    api<PaymentRow[]>('/payments?approvalStatus=PENDING')
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const visible = useMemo(() => {
    const start = dayStart(from);
    const end = dayStart(to);
    const endMs = end === undefined ? undefined : end + 86400000;
    return rows.filter((p) => {
      const t = p.paidAt || p.createdAt || 0;
      if (start !== undefined && t < start) return false;
      if (endMs !== undefined && t >= endMs) return false;
      return true;
    });
  }, [rows, from, to]);

  const allSelected = visible.length > 0 && visible.every((p) => sel.includes(p.id));
  const toggleAll = () => setSel(allSelected ? [] : visible.map((p) => p.id));
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const decideBulk = async (approve: boolean) => {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      if (sel.length === 0) throw new Error('No hay cobros seleccionados.');
      let reason = '';
      if (!approve) {
        reason = window.prompt(`Motivo del rechazo (${sel.length} cobros):`)?.trim() || '';
        if (!reason) return;
      }
      await Promise.all(
        sel.map((id) =>
          approve
            ? apiPost<{ success: boolean }>(`/payments/${id}/approve`)
            : apiPost<{ success: boolean }>(`/payments/${id}/reject`, { reason }),
        ),
      );
      setMsg(approve ? `${sel.length} cobros aprobados en lote.` : `${sel.length} cobros rechazados.`);
      setSel([]);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error en la operación en lote.');
    } finally {
      setBusy(false);
    }
  };

  const decide = async (id: string, approve: boolean) => {
    try {
      if (approve) {
        await apiPost<{ success: boolean }>(`/payments/${id}/approve`);
        // Dispara la impresión del ticket térmico con los montos definitivos.
        const paid = await api<Record<string, unknown>>(`/payments/${id}`);
        printPaymentTicket(paid as unknown as TicketData);
        setMsg('Pago aprobado. El saldo fue actualizado y se imprimió el ticket.');
      } else {
        const reason = window.prompt('Motivo del rechazo/anulación:')?.trim() || '';
        if (!reason) return;
        await apiPost<{ success: boolean }>(`/payments/${id}/reject`, { reason });
        setMsg('Pago rechazado y anulado.');
      }
      setError('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar el pago.');
    }
  };

  const total = visible.reduce((s, p) => s + (p.amount || 0), 0);
  const dateCls = 'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-teal-400';
  const btnCls = 'rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40';

  return (
    <div className="p-6">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-3">
          <h2 className="text-xl font-semibold text-slate-900">Aprobar Rendición</h2>
          <p className="text-sm text-slate-500">
            {visible.length} cobros pendientes · Gs. {fmt(total)}
          </p>
        </div>

        {/* Filtros de rango de fechas + acciones en lote */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Desde
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={dateCls} />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            Hasta
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={dateCls} />
          </label>
          <span className="text-xs text-slate-400">(vacío = todo)</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button onClick={toggleAll} className={`${btnCls} border border-slate-200 text-slate-600 hover:bg-slate-100`}>
              {allSelected ? 'Quitar selección' : 'Seleccionar todo'}
            </button>
            <span className="text-xs font-medium text-slate-500">{sel.length} seleccionados</span>
            <button
              onClick={() => void decideBulk(true)}
              disabled={busy || sel.length === 0}
              className={`${btnCls} bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              Aprobar seleccionados
            </button>
            <button
              onClick={() => void decideBulk(false)}
              disabled={busy || sel.length === 0}
              className={`${btnCls} bg-rose-600 text-white hover:bg-rose-700`}
            >
              Rechazar seleccionados
            </button>
          </div>
        </div>

        {msg && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</div>}
        {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-teal-600" />
                </th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Cobrador</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} className={`border-t border-slate-100 hover:bg-slate-50 ${sel.includes(p.id) ? 'bg-teal-50/50' : ''}`}>
                  <td className="px-4 py-2.5">
                    <input type="checkbox" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 accent-teal-600" />
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-800">{p.clientName || '-'}</p>
                    <p className="text-xs text-slate-400">{p.clientDocumentId || ''}</p>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{p.collectorName || '-'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{fmt(p.amount || 0)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{p.paymentType || '-'}</td>
                  <td className="px-4 py-2.5 text-slate-500">{fmtDate(p.createdAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => void decide(p.id, true)} className="mr-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                      Aprobar
                    </button>
                    <button onClick={() => void decide(p.id, false)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">
                      Rechazar
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No hay rendiciones pendientes para los filtros
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
