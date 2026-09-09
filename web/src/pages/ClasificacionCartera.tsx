import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface LoanRow {
  id: string;
  clientName?: string;
  loanType?: string;
  currentBalance: number;
  expiresAt?: number;
  nextDueDate?: number;
  collectorName?: string;
  status?: string;
  approvalStatus?: string;
}
const fmt = (v: number) => Math.round(v).toLocaleString('es-PY');
const DAY = 86400000;
const startUtc = (t: number) => {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
const mora = (l: LoanRow) => {
  if (l.status === 'PAID' || l.status === 'ANULADO' || l.approvalStatus !== 'APPROVED') return 0;
  const due = l.nextDueDate || l.expiresAt;
  return due ? Math.max(0, Math.floor((startUtc(Date.now()) - startUtc(due)) / DAY)) : 0;
};

type Cat = 'BUENO' | 'INFORCONF' | 'PREJUDICIAL' | 'JUDICIAL';
const classify = (m: number): Cat => (m <= 30 ? 'BUENO' : m <= 90 ? 'INFORCONF' : m <= 120 ? 'PREJUDICIAL' : 'JUDICIAL');
const CATS: Array<{ key: Cat | 'TODOS'; label: string }> = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'BUENO', label: 'Bueno' },
  { key: 'INFORCONF', label: 'Inforconf' },
  { key: 'PREJUDICIAL', label: 'Prejudicial' },
  { key: 'JUDICIAL', label: 'Judicial' },
];

export default function ClasificacionCartera() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LoanRow[]>([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Cat | 'TODOS'>('TODOS');

  useEffect(() => {
    const params = new URLSearchParams();
    if (user?.role === 'COLLECTOR') params.set('collectorId', user.uid);
    api<LoanRow[]>(`/loans?approvalStatus=APPROVED&${params.toString()}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [user]);

  const items = useMemo(
    () =>
      rows
        .filter((l) => l.status !== 'PAID' && l.status !== 'ANULADO')
        .map((l) => ({ ...l, mora: mora(l), cat: classify(mora(l)) })),
    [rows],
  );
  const filtered = useMemo(() => (tab === 'TODOS' ? items : items.filter((i) => i.cat === tab)), [items, tab]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { BUENO: 0, INFORCONF: 0, PREJUDICIAL: 0, JUDICIAL: 0 };
    items.forEach((i) => (c[i.cat] += 1));
    return c;
  }, [items]);

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-xl font-semibold text-slate-900">Clasificación de Cartera</h2>
        <p className="mb-4 text-sm text-slate-500">Bueno (≤30 días) · Inforconf (≤90) · Prejudicial (≤120) · Judicial (&gt;120)</p>
        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['BUENO', 'INFORCONF', 'PREJUDICIAL', 'JUDICIAL'] as Cat[]).map((c) => (
            <button key={c} onClick={() => setTab(c)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-300">
              <p className="text-xs uppercase text-slate-400">{c}</p>
              <p className="mt-1 text-2xl font-semibold text-slate-800">{counts[c]}</p>
            </button>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {CATS.map((c) => (
            <button
              key={c.key}
              onClick={() => setTab(c.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                tab === c.key ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Mora (días)</th>
                <th className="px-4 py-3 text-right">Saldo (Gs.)</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Cobrador</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{r.clientName || '-'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.loanType || '-'}</td>
                  <td className="px-4 py-2.5 text-right text-rose-600">{r.mora}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{fmt(r.currentBalance || 0)}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{r.cat}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{r.collectorName || '-'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin créditos en esta categoría</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
