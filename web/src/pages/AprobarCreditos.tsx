import { useCallback, useEffect, useState } from 'react';
import { api, apiPost } from '../lib/api';

interface LoanRow {
  id: string;
  clientName?: string;
  clientDocumentId?: string;
  loanType?: string;
  principal: number;
  currency?: string;
  collectorName?: string;
  createdAt?: number;
}

const fmt = (v: number) => Math.round(v).toLocaleString('es-PY');
const fmtDate = (t?: number) => (t ? new Intl.DateTimeFormat('es-PY', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(t)) : '-');

export default function AprobarCreditos() {
  const [rows, setRows] = useState<LoanRow[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api<LoanRow[]>('/loans?approvalStatus=PENDING')
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const approve = async (id: string) => {
    try {
      await apiPost<{ success: boolean }>(`/loans/${id}/approve`);
      setMsg('Crédito aprobado.');
      setError('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al aprobar.');
    }
  };

  const reject = async (id: string) => {
    const reason = window.prompt('Motivo del rechazo:')?.trim() || '';
    if (!reason) return;
    try {
      await apiPost<{ success: boolean }>(`/loans/${id}/anular`, { reason });
      setMsg('Crédito rechazado y anulado.');
      setError('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al rechazar.');
    }
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-xl font-semibold text-slate-900">Aprobar Créditos</h2>
        <p className="mb-4 text-sm text-slate-500">{rows.length} créditos pendientes de autorización</p>
        {msg && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</div>}
        {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Capital (Gs.)</th>
                <th className="px-4 py-3">Solicitado por</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-800">{r.clientName || '-'}</p>
                    <p className="text-xs text-slate-400">{r.clientDocumentId || ''}</p>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{r.loanType || '-'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{fmt(r.principal || 0)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.collectorName || '-'}</td>
                  <td className="px-4 py-2.5 text-slate-500">{fmtDate(r.createdAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => void approve(r.id)} className="mr-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                      Aprobar
                    </button>
                    <button onClick={() => void reject(r.id)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50">
                      Rechazar
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin créditos pendientes</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
