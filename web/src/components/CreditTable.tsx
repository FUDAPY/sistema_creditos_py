import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { money } from '../lib/format';
import Pagination from './Pagination';
import LoanRowActions from './LoanRowActions';
import PaymentsHistoryModal from './PaymentsHistoryModal';
import ClientDetailModal from './ClientDetailModal';

export interface LoanRow {
  id: string;
  clientId?: string;
  clientName?: string;
  clientDocumentId?: string;
  loanType?: string;
  description?: string;
  principal: number;
  totalAmount?: number;
  paidAmount?: number;
  currentBalance?: number;
  principalBalance?: number;
  interestDue?: number;
  lateFeeDue?: number;
  totalDue?: number;
  daysLate?: number;
  accruedInterestBalance?: number;
  accruedLateFeeBalance?: number;
  status?: string;
  approvalStatus?: string;
  collectorName?: string;
  collectorId?: string;
  /** Origen del crédito (sistema_creditos, empeno, alquiler, prestacion_servicios, pos, juridico). */
  origen?: string;
  clientMissing?: boolean;
  grantedAt?: number;
  expiresAt?: number;
  nextDueDate?: number;
  interestRate?: number;
  inforconfConfirmedAt?: number;
}

export const PAGE_SIZE = 25;

const fmt = (v?: number) => money(v);
const fmtDate = (t?: number) =>
  t ? new Intl.DateTimeFormat('es-PY', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(new Date(t)) : '-';

const DAY = 86400000;
const MORA_GRACE_DAYS = 5;
const startUtcDay = (t: number) => {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
const moraOf = (l: LoanRow) => {
  // Congelado = mora eliminada (solo queda el interés inicial pactado).
  if (l.status === 'FROZEN' || l.status === 'CONGELADO') return 0;
  if (l.status === 'PAID' || l.status === 'ANULADO' || (l.approvalStatus && l.approvalStatus !== 'APPROVED')) return 0;
  const due = l.nextDueDate || l.expiresAt;
  if (!due) return 0;
  const lateDays = Math.max(0, Math.floor((startUtcDay(Date.now()) - startUtcDay(due)) / DAY));
  return Math.max(0, lateDays - MORA_GRACE_DAYS);
};
const isNoInterestLoan = (l: LoanRow) => ['PRESTACION_SERVICIOS', 'ALQUILER_INMUEBLE'].includes(l.loanType || '');

export interface CatRow {
  key: string;
  label: string;
  cls: string;
  dot: string;
}
export const categoryOf = (l: LoanRow): CatRow => {
  if (l.status === 'PAID') return { key: 'PAGADO', label: 'Pagado', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' };
  if (l.status === 'ANULADO') return { key: 'ANULADO', label: 'Anulado', cls: 'bg-slate-200 text-slate-600', dot: 'bg-slate-400' };
  if (l.status === 'FROZEN' || l.status === 'CONGELADO') return { key: 'CONGELADO', label: 'Congelado', cls: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' };
  const mora = moraOf(l);
  if (mora <= 30) return { key: 'ACTIVO', label: 'Activo', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' };
  if (mora <= 90) return { key: 'INFORCONF', label: 'Inforconf', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' };
  if (mora <= 120) return { key: 'PREJUDICIAL', label: 'Prejudicial', cls: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' };
  return { key: 'JUDICIAL', label: 'Judicial', cls: 'bg-rose-100 text-rose-700', dot: 'bg-rose-600' };
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

/** Tabla unificada de créditos: filtros superiores, paginación (25), modales y acciones. */
export default function CreditTable({ loans, reload }: { loans: LoanRow[]; reload: () => void }) {
  const { user } = useAuth();
  const role = user?.role;
  const [query, setQuery] = useState('');
  const [collector, setCollector] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [page, setPage] = useState(1);
  const [clientModal, setClientModal] = useState<string | null>(null);
  const [historyModal, setHistoryModal] = useState<{ id: string; clientName: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (clientModal) {
      api<{ fullName?: string }>(`/clients/${clientModal}`).catch(() => undefined);
    }
  }, [clientModal]);

  const enriched = useMemo(
    () =>
      loans.map((l) => {
        const cat = categoryOf(l);
        const noInterest = isNoInterestLoan(l);
        const interest = noInterest ? 0 : Number(l.interestDue ?? l.accruedInterestBalance ?? 0);
        const lateFee = noInterest ? 0 : Number(l.lateFeeDue ?? l.accruedLateFeeBalance ?? 0);
        const principalPend = Math.max(0, Number(l.principalBalance ?? l.currentBalance ?? 0));
        const due = Number(l.totalDue ?? principalPend + interest + lateFee);
        return { ...l, mora: moraOf(l), moraDias: l.daysLate ?? moraOf(l), interest, lateFee, principalPend, due, tipoLabel: TYPE_LABEL[l.loanType || ''] || l.loanType || '-', cat };
      }),
    [loans],
  );

  const collectors = useMemo(() => Array.from(new Set(enriched.map((r) => r.collectorName).filter(Boolean))).sort(), [enriched]);
  const tipos = useMemo(() => Array.from(new Set(enriched.map((r) => r.tipoLabel))).sort(), [enriched]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es');
    const list = enriched.filter((r) => {
      if (collector && r.collectorName !== collector) return false;
      if (tipo && r.tipoLabel !== tipo) return false;
      if (estado && r.cat.key !== estado) return false;
      if (q && !`${r.clientName || ''} ${r.clientDocumentId || ''} ${r.clientId || ''}`.toLocaleLowerCase('es').includes(q)) return false;
      return true;
    });
    return list.sort((a, b) => b.mora - a.mora || String(a.clientName || '').localeCompare(String(b.clientName || ''), 'es'));
  }, [enriched, query, collector, tipo, estado]);

  useEffect(() => {
    setPage(1);
  }, [query, collector, tipo, estado]);

  const reset = () => {
    setQuery('');
    setCollector('');
    setTipo('');
    setEstado('');
    setPage(1);
  };

  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectCls = 'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-teal-400';

  return (
    <div>
      {/* Filtros superiores */}
      <div className="mb-3 grid grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Buscar cliente, cédula…"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-teal-400 sm:col-span-2"
        />
        <select value={collector} onChange={(e) => setCollector(e.target.value)} className={selectCls}>
          <option value="">Cobrador: todos</option>
          {collectors.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={selectCls}>
          <option value="">Tipo: todos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className={`${selectCls} w-full`}>
            <option value="">Estado: todos</option>
            <option value="ACTIVO">Activo</option>
            <option value="INFORCONF">Inforconf</option>
            <option value="PREJUDICIAL">Prejudicial</option>
            <option value="JUDICIAL">Judicial</option>
            <option value="CONGELADO">Congelado</option>
            <option value="PAGADO">Pagado</option>
            <option value="ANULADO">Anulado</option>
          </select>
          {(query || collector || tipo || estado) && (
            <button onClick={reset} className="shrink-0 rounded-lg border border-slate-200 px-2 text-xs text-slate-500 hover:bg-slate-100">
              ✕
            </button>
          )}
        </div>
      </div>

      {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm credit-table">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Cliente</th>
              <th className="px-3 py-2.5">Otorgado</th>
              <th className="px-3 py-2.5">Tipo</th>
              <th className="px-3 py-2.5 text-right">Capital</th>
              <th className="px-3 py-2.5">Vence</th>
              <th className="px-3 py-2.5 text-right">Interés</th>
              <th className="px-3 py-2.5 text-right">Mora</th>
              <th className="px-3 py-2.5 text-right">Saldo</th>
              <th className="px-3 py-2.5 text-right">Total abonado</th>
              <th className="px-3 py-2.5">Estado</th>
              <th className="px-3 py-2.5">Cobrador</th>
              <th className="px-3 py-2.5">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-middle hover:bg-slate-50">
                <td className="px-3 py-2">
                  {r.clientMissing ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800" title={r.clientId ? `clientId: ${r.clientId}` : 'Sin clientId en el registro'}>
                      ⚠ Cliente no asignado
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        if (r.clientId && !r.clientId.startsWith('externo:')) setClientModal(r.clientId);
                      }}
                      className="text-left font-medium text-slate-800 hover:text-teal-700 hover:underline"
                    >
                      {r.clientName || '-'}
                    </button>
                  )}
                  {r.clientDocumentId && <p className="text-[10px] text-slate-400">{r.clientDocumentId}</p>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtDate(r.grantedAt)}</td>
                <td className="px-3 py-2 text-slate-600">
                  <span className="whitespace-nowrap">{r.tipoLabel}</span>
                  {r.description && (
                    <p className="max-w-[220px] truncate text-[10px] text-slate-400" title={r.description}>
                      {r.description}
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700">{fmt(r.principal)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtDate(r.expiresAt)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-slate-700">{fmt(r.interest)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {r.lateFee > 0 || r.mora > 0 ? (
                    <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                      Gs. {fmt(r.lateFee)} · {r.mora}d
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-600">Gs. 0 · 0d</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-800">{fmt(r.due)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {r.paidAmount ? (
                    <button
                      onClick={() => setHistoryModal({ id: r.id, clientName: r.clientName || '' })}
                      className="font-medium text-emerald-600 hover:underline"
                    >
                      {fmt(r.paidAmount)}
                    </button>
                  ) : (
                    <span className="text-slate-300">0</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.cat.cls}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${r.cat.dot}`} />
                    {r.cat.label}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{r.collectorName || '-'}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <LoanRowActions
                    loan={r}
                    role={role}
                    reload={reload}
                    onShowHistory={() => setHistoryModal({ id: r.id, clientName: r.clientName || '' })}
                  />
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                  Sin créditos para los filtros aplicados
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </div>

      {clientModal && <ClientDetailModal clientId={clientModal} onClose={() => setClientModal(null)} />}
      {historyModal && (
        <PaymentsHistoryModal loanId={historyModal.id} clientName={historyModal.clientName} onClose={() => setHistoryModal(null)} />
      )}
    </div>
  );
}
