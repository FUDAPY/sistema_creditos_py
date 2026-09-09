import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
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
}

const fmt = (v: number) => `${Math.round(v).toLocaleString('es-PY')}`;
const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [approvedPayments, setApprovedPayments] = useState<PaymentRow[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PaymentRow[]>([]);
  const [error, setError] = useState('');
  const [syncSeconds, setSyncSeconds] = useState(0);
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

  const monthLabel = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(new Date());

  const navItem = (to: string, label: string, end = false) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
        }`
      }
    >
      <span className="inline-block h-2 w-2 rounded-full bg-current" />
      {label}
    </NavLink>
  );

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-800">
      {/* Barra lateral */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-5 md:flex">
        <div className="mb-8">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Sys<span className="text-teal-600">Creditos</span>
          </h1>
          <p className="text-xs text-slate-400">LIN GROUP S.A.</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1.5">
          {navItem('/', 'Dashboard', true)}
          {navItem('/loans', 'Créditos')}
          {navItem('/loans/new', 'Nuevo crédito')}
          {user?.role === 'ADMIN' && navItem('/pagares', 'Pagarés')}
          {navItem('/portfolio', 'Cartera')}
        </nav>
        <div className="border-t border-slate-200 pt-4">
          <p className="text-sm font-medium text-slate-700">{user?.name || 'Usuario'}</p>
          <p className="mb-2 text-xs text-slate-400">
            {user?.role === 'ADMIN' ? 'Administrador' : 'Cobrador'}
          </p>
          <button
            onClick={logout}
            className="text-sm font-medium text-rose-600 transition hover:text-rose-700"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1">
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
      </main>
    </div>
  );
}

