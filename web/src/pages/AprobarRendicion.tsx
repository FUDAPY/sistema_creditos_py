import { useCallback, useEffect, useState } from 'react';
import { api, apiPost } from '../lib/api';

interface PaymentRow {
  id: string;
  loanId: string;
  clientName?: string;
  clientDocumentId?: string;
  collectorName?: string;
  amount: number;
  paymentType?: string;
  createdAt?: number;
}

const fmt = (v: number) => v.toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (t?: number) =>
  t ? new Intl.DateTimeFormat('es-PY', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(t)) : '-';

export default function AprobarRendicion() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api<PaymentRow[]>('/payments?approvalStatus=PENDING')
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const decide = async (id: string, approve: boolean) => {
    try {
      if (approve) {
        await apiPost<{ success: boolean }>(`/payments/${id}/approve`);
        setMsg('Pago aprobado. El saldo fue actualizado.');
      } else {
        const reason = window.prompt('Motivo del rechazo/anulación:')?.trim() || '';
        await apiPost<{ success: boolean }>(`/payments/${id}/reject`, { reason });
        setMsg('Pago rechazado y anulado.');
      }
      setError('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar el pago.');
    }
  };

  const total = rows.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="p-6">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Aprobar Rendición</h2>
            <p className="text-sm text-slate-500">
              {rows.length} cobros pendientes · Gs. {fmt(total)}
            </p>
          </div>
        </div>

        {msg && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</div>}
        {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Cobrador</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-800">{p.clientName || '-'}</p>
                    <p className="text-xs text-slate-400">{p.clientDocumentId || ''}</p>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{p.collectorName || '-'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{fmt(p.amount || 0)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{p.paymentType || '-'}</td>
                  <td className="px-4 py-2.5 text-slate-500">{fmtDate(p.createdAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => void decide(p.id, true)}
                      className="mr-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => void decide(p.id, false)}
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      Rechazar
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No hay rendiciones pendientes
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
