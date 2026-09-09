import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface LoanRow {
  id: string;
  clientName?: string;
  loanType?: string;
  currentBalance: number;
  status?: string;
  approvalStatus?: string;
  expiresAt?: number;
  nextDueDate?: number;
  collectorName?: string;
}

const fmt = (v: number) => v.toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const keyOf = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function Calendario() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [error, setError] = useState('');
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState(keyOf(Date.now()));

  useEffect(() => {
    const params = new URLSearchParams();
    if (user?.role === 'COLLECTOR') params.set('collectorId', user.uid);
    api<LoanRow[]>(`/loans?approvalStatus=APPROVED&${params.toString()}`)
      .then(setLoans)
      .catch((e) => setError(e.message));
  }, [user]);

  const dueMap = useMemo(() => {
    const map = new Map<string, LoanRow[]>();
    for (const l of loans) {
      if (l.status === 'PAID' || l.status === 'ANULADO') continue;
      const due = l.nextDueDate || l.expiresAt;
      if (!due) continue;
      const k = keyOf(due);
      const arr = map.get(k) ?? [];
      arr.push(l);
      map.set(k, arr);
    }
    return map;
  }, [loans]);

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const list: Array<{ key: string; day: number; inMonth: boolean }> = [];
    for (let i = 0; i < startWeekday; i += 1) list.push({ key: `pad-${i}`, day: 0, inMonth: false });
    for (let d = 1; d <= daysInMonth; d += 1) list.push({ key: keyOf(new Date(cursor.y, cursor.m, d).getTime()), day: d, inMonth: true });
    return list;
  }, [cursor]);

  const detail = dueMap.get(selected) ?? [];

  const shift = (delta: number) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  const selDate = new Date(`${selected}T12:00:00`);

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Calendario de Cobros</h2>
            <p className="text-sm text-slate-500">{dueMap.size} fechas con vencimientos</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => shift(-1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600">
              ‹ Anterior
            </button>
            <span className="min-w-40 text-center font-semibold text-slate-800">
              {MONTHS[cursor.m]} {cursor.y}
            </span>
            <button onClick={() => shift(1)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600">
              Siguiente ›
            </button>
          </div>
        </div>

        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

        <div className="grid grid-cols-7 gap-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map((wd) => (
            <div key={wd} className="pb-1 text-center text-[10px] font-semibold uppercase text-slate-400">
              {wd}
            </div>
          ))}
          {cells.map((c) => {
            const items = c.inMonth ? (dueMap.get(c.key) ?? []) : [];
            const isToday = c.inMonth && c.key === keyOf(Date.now());
            const isSel = c.inMonth && c.key === selected;
            return (
              <button
                key={c.key}
                disabled={!c.inMonth}
                onClick={() => c.inMonth && setSelected(c.key)}
                className={`flex min-h-20 flex-col items-start gap-1 rounded-xl border p-2 text-left transition ${
                  isSel
                    ? 'border-teal-500 bg-teal-50'
                    : isToday
                      ? 'border-teal-300 bg-white'
                      : 'border-transparent bg-slate-50 hover:border-slate-200'
                }`}
              >
                <span className={`text-xs font-medium ${isToday ? 'text-teal-700' : 'text-slate-600'}`}>{c.day}</span>
                {c.inMonth && items.length > 0 && (
                  <>
                    <span className="text-[10px] text-slate-500">{items.length} vencen</span>
                    <span className="text-[10px] font-semibold text-rose-600">
                      Gs. {fmt(items.reduce((s, l) => s + (l.currentBalance || 0), 0))}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
            Vencimientos del {selDate.toLocaleDateString('es-PY', { day: '2-digit', month: 'long' })}
            <span className="ml-2 text-xs font-normal text-slate-400">({detail.length})</span>
          </div>
          {detail.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">Sin vencimientos este día</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {detail.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{l.clientName || '-'}</p>
                    <p className="text-xs text-slate-400">
                      {l.loanType || '-'} · {l.collectorName || '-'}
                    </p>
                  </div>
                  <span className="font-semibold text-slate-700">Gs. {fmt(l.currentBalance || 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
