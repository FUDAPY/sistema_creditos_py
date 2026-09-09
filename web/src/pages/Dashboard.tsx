import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import AreaChart, { type SeriesPoint } from '../components/AreaChart';

interface LoanRow {
  id: string;
  status?: string;
  approvalStatus?: string;
  principal: number;
  currentBalance: number;
  currency?: string;
  createdAt?: number;
}
interface PaymentRow {
  id: string;
  amount: number;
  createdAt?: number;
  paidAt?: number;
  paymentType?: string;
  principalApplied?: number;
  interestApplied?: number;
  arrearsApplied?: number;
}

const fmt = (v: number) => `${Math.round(v).toLocaleString('es-PY')}`;
const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const monthKeyOf = (t?: number) => {
  if (!t) return '';
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [approvedPayments, setApprovedPayments] = useState<PaymentRow[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PaymentRow[]>([]);
  const [error, setError] = useState('');
  const [syncSeconds, setSyncSeconds] = useState(0);
  const [month, setMonth] = useState(currentMonthKey());
  const mounted = useRef(true);

  const scope = useMemo(() => (user?.role === 'COLLECTOR' ? `&collectorId=${user.uid}` : ''), [user]);

  const load = useCallback(async () => {
    try {
      const [loansRes, approved, pending] = await Promise.all([
        api<LoanRow[]>(`/loans?${scope.replace('&', '')}`),
        api<PaymentRow[]>(`/payments?approvalStatus=APPROVED${scope}`),
        api<PaymentRow[]>(`/payments?approvalStatus=PENDING${scope}`),
      ]);
      if (!mounted.current) return;
      setLoans(loansRes);
      setApprovedPayments(approved);
      setPendingPayments(pending);
      setError('');
      setSyncSeconds(0);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos.');
    }
  }, [scope]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setSyncSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const data = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startMs = startOfToday.getTime();

    const active = loans.filter((l) => ['ACTIVE', 'FROZEN', 'CONGELADO'].includes(l.status || ''));
    const activeBalance = active.reduce((sum, l) => sum + (l.currentBalance || 0), 0);
    const loansToday = loans.filter((l) => (l.createdAt || 0) >= startMs).length;
    const pendingLoanCount = loans.filter((l) => l.approvalStatus === 'PENDING').length;
    const collectedToday = approvedPayments
      .filter((p) => (p.createdAt || 0) >= startMs)
      .reduce((s, p) => s + (p.amount || 0), 0);
    const totalCollected = approvedPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const pendingApprovals = pendingPayments.length + pendingLoanCount;

    // Últimos 7 días para los gráficos
    const days: SeriesPoint[] = [];
    const daysLoans: SeriesPoint[] = [];
    const fmtDay = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric' });
    for (let i = 6; i >= 0; i -= 1) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      const key = dayKey(day.getTime());
      const start = day.getTime();
      const end = start + 86400000;
      const cobrado = approvedPayments
        .filter((p) => {
          const c = p.createdAt || 0;
          return c >= start && c < end;
        })
        .reduce((s, p) => s + (p.amount || 0), 0);
      const otorgados = loans.filter((l) => {
        const c = l.createdAt || 0;
        return c >= start && c < end;
      }).length;
      days.push({ label: fmtDay.format(day), value: cobrado });
      daysLoans.push({ label: fmtDay.format(day), value: otorgados });
      void key;
    }

    return {
      activeCount: active.length,
      activeBalance,
      loansToday,
      collectedToday,
      totalCollected,
      pendingApprovals,
      days,
      daysLoans,
      pendingPaymentsList: pendingPayments,
    };
  }, [loans, approvedPayments, pendingPayments]);

  // Desglose de cobro por componente: capital vs. interés (la mora se suma al interés).
  const breakdown = useMemo(() => {
    const tsOf = (p: PaymentRow) => p.paidAt || p.createdAt || 0;
    const capOf = (p: PaymentRow) => p.principalApplied ?? 0;
    const intOf = (p: PaymentRow) => (p.interestApplied ?? 0) + (p.arrearsApplied ?? 0);
    const sums = (list: PaymentRow[]) =>
      list.reduce(
        (acc, p) => ({
          amount: acc.amount + (p.amount || 0),
          capital: acc.capital + capOf(p),
          interes: acc.interes + intOf(p),
        }),
        { amount: 0, capital: 0, interes: 0 },
      );
    const mensual = sums(approvedPayments.filter((p) => monthKeyOf(tsOf(p)) === month));
    const historico = sums(approvedPayments);
    return { mensual, historico };
  }, [approvedPayments, month]);

  const monthLabel = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(new Date());


  return (
    <>
      {/* Header propio del Dashboard (la barra lateral ahora la aporta SidebarLayout). */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 px-6 py-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Resumen del Día</h2>
            <p className="text-sm capitalize text-slate-500">{monthLabel}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-xs text-teal-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
              </span>
              Datos sincronizados hace {syncSeconds} s
            </div>
            <button
              onClick={() => void load()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-teal-300 hover:text-teal-600"
            >
              Sincronizar
            </button>
          </div>
        </div>
      </header>

        <div className="mx-auto max-w-7xl space-y-6 p-6">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {/* KPIs */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Cartera activa (Gs.)', value: fmt(data.activeBalance), accent: 'text-teal-700', hint: `${data.activeCount} créditos activos` },
              { label: 'Cobros aprobados hoy (Gs.)', value: fmt(data.collectedToday), accent: 'text-blue-700', hint: `${fmt(data.totalCollected)} en total` },
              { label: 'Créditos otorgados hoy', value: String(data.loansToday), accent: 'text-indigo-700', hint: 'altas del día' },
              { label: 'Pendientes de aprobación', value: String(data.pendingApprovals), accent: 'text-amber-600', hint: 'créditos y pagos' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{kpi.label}</p>
                <p className={`mt-2 text-3xl font-semibold tracking-tight ${kpi.accent}`}>{kpi.value}</p>
                <p className="mt-1 text-xs text-slate-400">{kpi.hint}</p>
              </div>
            ))}
          </section>

          {/* Desglose de cobro (mensual / histórico) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Desglose de cobro · Capital vs. Interés</h3>
                <p className="text-xs text-slate-400">
                  La mora cobrada se suma a la columna de interés. Histórico = acumulado total aprobado.
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                Período
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-teal-700">Capital cobrado (mes)</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{fmt(breakdown.mensual.capital)}</p>
                <p className="text-xs text-slate-400">de {fmt(breakdown.mensual.amount)} cobrado en el período</p>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700">Interés cobrado (mes)</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{fmt(breakdown.mensual.interes)}</p>
                <p className="text-xs text-slate-400">incluye moras del período</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Capital cobrado (histórico)</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{fmt(breakdown.historico.capital)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Interés cobrado (histórico)</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{fmt(breakdown.historico.interes)}</p>
              </div>
            </div>
          </section>

          {/* Tendencias */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Cobros por día</h3>
              <p className="mb-3 text-xs text-slate-400">Últimos 7 días · montos aprobados (Gs.)</p>
              <AreaChart data={data.days} color="#0d9488" />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700">Créditos por día</h3>
              <p className="mb-3 text-xs text-slate-400">Últimos 7 días · cantidad otorgada</p>
              <AreaChart data={data.daysLoans} color="#1d4ed8" />
            </div>
          </section>

          {/* Pendientes */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h3 className="text-sm font-semibold text-slate-700">Pagos por aprobar</h3>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                {data.pendingPaymentsList.length}
              </span>
            </div>
            {data.pendingPaymentsList.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-400">Sin pagos pendientes. Todo al día. ✨</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.pendingPaymentsList.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="text-slate-600">Recibo de Gs. {fmt(p.amount)}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      Pendiente
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
    </>
  );
}

