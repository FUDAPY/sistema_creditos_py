import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

interface LoanRow {
  id: string;
  status?: string;
  approvalStatus?: string;
  expiresAt?: number;
  nextDueDate?: number;
}
interface PaymentRow {
  id: string;
  loanId: string;
  collectorName?: string;
  amount: number;
  paidAt?: number;
  createdAt?: number;
}

const fmt = (v: number) => Math.round(v).toLocaleString('es-PY');
const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthKeyOf = (t?: number) => {
  if (!t) return '';
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const DAY = 86400000;
const startUtcDay = (t: number) => {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
const moraOf = (l: LoanRow) => {
  // Congelado: sin mora (se eliminó al congelar).
  if (l.status === 'FROZEN' || l.status === 'CONGELADO') return 0;
  if (l.status === 'PAID' || l.status === 'ANULADO' || l.approvalStatus !== 'APPROVED') return 0;
  const due = l.nextDueDate || l.expiresAt;
  return due ? Math.max(0, Math.floor((startUtcDay(Date.now()) - startUtcDay(due)) / DAY)) : 0;
};

export default function Recaudo() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(currentMonthKey());

  useEffect(() => {
    Promise.all([api<PaymentRow[]>('/payments?approvalStatus=APPROVED'), api<LoanRow[]>('/loans')])
      .then(([p, l]) => {
        setPayments(p);
        setLoans(l);
      })
      .catch((e) => setError(e.message));
  }, []);

  const loanMap = useMemo(() => new Map(loans.map((l) => [l.id, l])), [loans]);

  const rows = useMemo(() => {
    const periodPayments = payments.filter((p) => monthKeyOf(p.paidAt || p.createdAt) === month);
    const map = new Map<string, { cobrado: number; buenos: number; malos: number; comBuenos: number; comMalos: number }>();
    for (const p of periodPayments) {
      const loan = loanMap.get(p.loanId);
      const malo = loan ? moraOf(loan) > 30 : false;
      const rate = malo ? 0.1 : 0.05;
      const key = p.collectorName || 'sin asignar';
      const row = map.get(key) ?? { cobrado: 0, buenos: 0, malos: 0, comBuenos: 0, comMalos: 0 };
      row.cobrado += p.amount || 0;
      if (malo) {
        row.malos += 1;
        row.comMalos += (p.amount || 0) * rate;
      } else {
        row.buenos += 1;
        row.comBuenos += (p.amount || 0) * rate;
      }
      map.set(key, row);
    }
    return Array.from(map.entries())
      .map(([collectorName, v]) => ({
        collectorName,
        cobrado: v.cobrado,
        buenos: v.buenos,
        malos: v.malos,
        comision: v.comBuenos + v.comMalos,
        comBuenos: v.comBuenos,
        comMalos: v.comMalos,
      }))
      .sort((a, b) => b.cobrado - a.cobrado);
  }, [payments, loanMap, month]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          cobrado: acc.cobrado + r.cobrado,
          comision: acc.comision + r.comision,
          buenos: acc.buenos + r.buenos,
          malos: acc.malos + r.malos,
        }),
        { cobrado: 0, comision: 0, buenos: 0, malos: 0 },
      ),
    [rows],
  );

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Recaudo mensual</h2>
            <p className="text-sm text-slate-500">
              Cobros aprobados por cobrador · comisión <b>5%</b> créditos Buenos · <b>10%</b> créditos Malos · procesado por mes
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Período
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-teal-400"
            />
          </label>
        </div>

        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase text-slate-400">Total cobrado</p>
            <p className="mt-1 text-2xl font-semibold text-teal-700">Gs. {fmt(totals.cobrado)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase text-slate-400">Comisiones</p>
            <p className="mt-1 text-2xl font-semibold text-blue-700">Gs. {fmt(totals.comision)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase text-slate-400">Cobros Buenos</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-600">{totals.buenos}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase text-slate-400">Cobros Malos</p>
            <p className="mt-1 text-2xl font-semibold text-rose-600">{totals.malos}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Cobrador</th>
                <th className="px-4 py-3 text-right">Total cobrado (Gs.)</th>
                <th className="px-4 py-3 text-right">Buenos</th>
                <th className="px-4 py-3 text-right">Malos</th>
                <th className="px-4 py-3 text-right">Comisión 5% (Gs.)</th>
                <th className="px-4 py-3 text-right">Comisión 10% (Gs.)</th>
                <th className="px-4 py-3 text-right">Comisión total (Gs.)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.collectorName} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{r.collectorName}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{fmt(r.cobrado)}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-600">{r.buenos}</td>
                  <td className="px-4 py-2.5 text-right text-rose-600">{r.malos}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{fmt(r.comBuenos)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{fmt(r.comMalos)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-blue-700">{fmt(r.comision)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Sin cobros aprobados todavía
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
