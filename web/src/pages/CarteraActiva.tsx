import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface LoanRow {
  id: string;
  clientName?: string;
  clientDocumentId?: string;
  loanType?: string;
  principal: number;
  totalAmount: number;
  paidAmount: number;
  currentBalance: number;
  status?: string;
  approvalStatus?: string;
  collectorName?: string;
  collectorId?: string;
  expiresAt?: number;
  grantedAt?: number;
  nextDueDate?: number;
}

const fmtDate = (t?: number) =>
  t
    ? new Intl.DateTimeFormat('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(t))
    : '-';
const fmt = (v: number) => v.toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DAY = 86400000;
const startUtcDay = (t: number) => {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
const daysLate = (loan: LoanRow) => {
  if (loan.status === 'PAID' || loan.status === 'ANULADO' || loan.approvalStatus !== 'APPROVED') return 0;
  const due = loan.nextDueDate || loan.expiresAt;
  if (!due) return 0;
  return Math.max(0, Math.floor((startUtcDay(Date.now()) - startUtcDay(due)) / DAY));
};

const TYPE_LABEL: Record<string, string> = {
  PRESTAMO: 'Préstamo',
  EMPENO: 'Empeño',
  ALQUILER_INMUEBLE: 'Alquiler',
  PRESTACION_SERVICIOS: 'Prestación',
  CELULAR: 'Celular',
  JURIDICO: 'Jurídico',
  POS: 'POS',
};
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activo',
  FROZEN: 'Congelado',
  CONGELADO: 'Congelado',
  PAID: 'Pagado',
  ANULADO: 'Anulado',
};

export default function CarteraActiva() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LoanRow[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [collector, setCollector] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (user?.role === 'COLLECTOR') params.set('collectorId', user.uid);
    api<LoanRow[]>(`/loans?${params.toString()}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [user]);

  const enriched = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        mora: daysLate(r),
        tipo: TYPE_LABEL[r.loanType || ''] || r.loanType || '-',
        interesTotal: Math.max(0, (r.totalAmount || 0) - (r.principal || 0)),
      })),
    [rows],
  );

  const collectors = useMemo(
    () => Array.from(new Set(enriched.map((r) => r.collectorName).filter(Boolean))),
    [enriched],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es');
    const list = enriched.filter((r) => {
      if (collector && r.collectorName !== collector) return false;
      if (status && r.status !== status) return false;
      if (q && !`${r.clientName || ''} ${r.clientDocumentId || ''}`.toLocaleLowerCase('es').includes(q)) return false;
      return true;
    });
    return list.sort(
      (a, b) => b.mora - a.mora || String(a.clientName || '').localeCompare(String(b.clientName || ''), 'es'),
    );
  }, [enriched, query, collector, status]);

  return (
    <div className="p-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Cartera Activa</h2>
          <p className="text-sm text-slate-500">{filtered.length} créditos · ordenados por mayor mora</p>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[1fr_auto_auto]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente (nombre o cédula)…"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select value={collector} onChange={(e) => setCollector(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Todos los cobradores</option>
            {collectors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Otorgado</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Capital</th>
                <th className="px-4 py-3">Vencimiento</th>
                <th className="px-4 py-3 text-right">Interés Total</th>
                <th className="px-4 py-3 text-right">Mora / Días</th>
                <th className="px-4 py-3 text-right">Total Adeudado</th>
                <th className="px-4 py-3 text-right">Total Abonado</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-800">{r.clientName || '-'}</p>
                    <p className="text-xs text-slate-400">{r.clientDocumentId || ''}</p>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{fmtDate(r.grantedAt)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.tipo}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700">{fmt(r.principal || 0)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fmtDate(r.expiresAt)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700">{fmt(r.interesTotal)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {r.mora > 0 ? (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                        {r.mora} días
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-600">Sin mora</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{fmt(r.totalAmount || 0)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{fmt(r.paidAmount || 0)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        r.status === 'ANULADO'
                          ? 'bg-slate-200 text-slate-600'
                          : r.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {STATUS_LABEL[r.status || ''] || r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{r.collectorName || '-'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                    Sin créditos para los filtros aplicados
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
