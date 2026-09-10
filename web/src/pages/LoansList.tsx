import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, apiPost } from '../lib/api';

interface LoanRow {
  id: string;
  clientName?: string;
  loanType?: string;
  principal: number;
  currentBalance: number;
  status?: string;
  approvalStatus?: string;
  collectorName?: string;
}

const fmt = (v: number | undefined) => (v ?? 0).toLocaleString('es-PY');
const STATUS_TEXT: Record<string, string> = {
  ACTIVE: 'Activo',
  FROZEN: 'Congelado',
  CONGELADO: 'Congelado',
  PAID: 'Pagado',
  ANULADO: 'Anulado',
};

export default function LoansList() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LoanRow[]>([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filter === 'PENDING') params.set('approvalStatus', 'PENDING');
    else if (filter) params.set('status', filter);
    api<LoanRow[]>(`/loans?${params.toString()}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [filter]);

  useEffect(load, [load]);

  const approve = async (id: string) => {
    await apiPost<{ success: boolean }>(`/loans/${id}/approve`);
    load();
  };

  const pending = rows.filter((r) => r.approvalStatus === 'PENDING').length;

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Créditos {pending > 0 && `(${pending} por aprobar)`}</h2>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-sm">
            <option value="">Todos los estados</option>
            <option value="ACTIVE">Activos</option>
            <option value="PENDING">Pendientes</option>
            <option value="PAID">Pagados</option>
            <option value="ANULADO">Anulados</option>
          </select>
          <Link to="/loans/new" className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">
            Nuevo crédito
          </Link>
        </div>
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded bg-white shadow">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2 text-right">Capital</th>
              <th className="px-3 py-2 text-right">Saldo</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Aprobación</th>
              <th className="px-3 py-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-1.5">{r.clientName || '-'}</td>
                <td className="px-3 py-1.5">{r.loanType || '-'}</td>
                <td className="px-3 py-1.5 text-right">{fmt(r.principal)}</td>
                <td className="px-3 py-1.5 text-right">{fmt(r.currentBalance)}</td>
                <td className="px-3 py-1.5">{STATUS_TEXT[r.status || ''] || r.status}</td>
                <td className="px-3 py-1.5">{r.approvalStatus || '-'}</td>
                <td className="px-3 py-1.5">
                  {user?.role === 'ADMIN' && r.approvalStatus === 'PENDING' && (
                    <button onClick={() => void approve(r.id)} className="rounded bg-green-600 px-2 py-1 text-xs text-white">
                      Aprobar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                  Sin créditos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
