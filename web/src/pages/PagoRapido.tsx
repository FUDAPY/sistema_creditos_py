import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { api, apiPost } from '../lib/api';
import { dateInputToMs, localTodayInput, normalizeSearch } from '../lib/format';

interface LoanRow {
  id: string;
  clientName?: string;
  clientDocumentId?: string;
  clientPhone?: string;
  loanType?: string;
  currentBalance: number;
  totalAmount: number;
  principal: number;
  totalDue?: number;
  description?: string;
  status?: string;
  approvalStatus?: string;
  daysLate?: number;
}

const fmt = (v: number) => Math.round(v).toLocaleString('es-PY');
const TYPE_LABEL: Record<string, string> = {
  PRESTAMO: 'Préstamo',
  EMPENO: 'Empeño',
  ALQUILER_INMUEBLE: 'Alquiler',
  PRESTACION_SERVICIOS: 'Prestación',
  CELULAR: 'Celular',
  JURIDICO: 'Jurídico',
  POS: 'POS',
};
const isFrozenStatus = (l: LoanRow) =>
  l.status === 'FROZEN' || l.status === 'CONGELADO' || l.loanType === 'CONGELADO';

export default function PagoRapido() {
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [search, setSearch] = useState('');
  const [loanId, setLoanId] = useState('');
  /** Autocompletado: lista de clientes desplegada al escribir. */
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const [amount, setAmount] = useState('');
  /** Fecha REAL del cobro (la elige el cobrador con el calendario). Default: hoy. */
  const [paidAt, setPaidAt] = useState(localTodayInput());
  const [type, setType] = useState<'CAPITAL' | 'INTEREST' | 'MIXED'>('MIXED');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<LoanRow[]>('/loans?approvalStatus=APPROVED')
      .then(setLoans)
      .catch((e) => setError(e.message));
  }, []);

  /**
   * Resultados que se muestran DEBAJO del buscador mientras se escribe:
   * coincidencias por nombre, cédula, teléfono o tipo de crédito (máx. 8),
   * priorizando los nombres que empiezan con lo tipeado.
   */
  const candidates = useMemo(() => {
    const q = normalizeSearch(search);
    const pool = loans.filter((l) => ['ACTIVE', 'FROZEN', 'CONGELADO'].includes(l.status || ''));
    // Sin texto: muestra los créditos más atrasados (permite cobrar sin tipear nada).
    if (!q) {
      return [...pool]
        .sort(
          (a, b) =>
            (b.daysLate ?? 0) - (a.daysLate ?? 0) ||
            normalizeSearch(a.clientName).localeCompare(normalizeSearch(b.clientName), 'es'),
        )
        .slice(0, 8);
    }
    return pool
      .filter((l) =>
        `${l.clientName || ''} ${l.clientDocumentId || ''} ${l.clientPhone || ''} ${l.loanType || ''} ${
          l.description || ''
        }`
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLocaleLowerCase('es')
          .includes(q),
      )
      .sort((a, b) => {
        const an = normalizeSearch(a.clientName);
        const bn = normalizeSearch(b.clientName);
        const aStarts = an.startsWith(q) ? 0 : 1;
        const bStarts = bn.startsWith(q) ? 0 : 1;
        return aStarts - bStarts || an.localeCompare(bn, 'es');
      })
      .slice(0, 8);
  }, [loans, search]);

  // Cierra la lista al hacer click fuera del buscador.
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const selectLoan = (loan: LoanRow) => {
    setLoanId(loan.id);
    setSearch(loan.clientName || '');
    setOpen(false);
    setHighlight(0);
    setError('');
  };

  const clearSelection = () => {
    setLoanId('');
    setSearch('');
    setOpen(false);
    setHighlight(0);
  };

  const selected = loans.find((l) => l.id === loanId);

  // Prestación (congelado) y Alquiler (monto fijo): solo admiten cobro de capital.
  const fixedCapitalOnly = Boolean(
    selected &&
      ['CELULAR', 'PRESTACION_SERVICIOS', 'ALQUILER_INMUEBLE'].includes(selected.loanType || ''),
  );
  useEffect(() => {
    if (fixedCapitalOnly) setType('CAPITAL');
  }, [fixedCapitalOnly]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    const value = Number(amount);
    if (!loanId || !Number.isFinite(value) || value <= 0) {
      setError('Seleccione un crédito e indique un monto válido.');
      return;
    }
    const paidAtMs = dateInputToMs(paidAt);
    if (!paidAtMs) {
      setError('Indique la fecha del cobro.');
      return;
    }
    if (paidAtMs > Date.now() + 60 * 1000) {
      setError('La fecha del cobro no puede ser futura.');
      return;
    }
    setBusy(true);
    try {
      await apiPost<Record<string, unknown>>('/payments', {
        loanId,
        amount: value,
        paymentType: type,
        paidAt: paidAtMs,
      });
      const fechaTxt = new Intl.DateTimeFormat('es-PY').format(new Date(paidAtMs));
      setInfo(
        `Pago registrado con fecha de cobro ${fechaTxt}. Quedará pendiente de aprobación del administrador para impactar en el saldo.`,
      );
      setAmount('');
      setSearch('');
      setLoanId('');
      setOpen(false);
      setHighlight(0);
      setPaidAt(localTodayInput());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el pago.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-xl font-semibold text-slate-900">Pago Rápido</h2>
        <p className="mb-4 text-sm text-slate-500">
          Registro inmediato de cobro. El pago queda <b>pendiente de aprobación</b> del administrador.
        </p>

        {info && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div>}
        {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="relative" ref={boxRef}>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">🔍 Buscar cliente</label>
              {loanId && (
                <button type="button" onClick={clearSelection} className="text-xs font-medium text-slate-500 hover:text-rose-600">
                  ✕ Quitar selección
                </button>
              )}
            </div>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLoanId('');
                setOpen(true);
                setHighlight(0);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false);
                  return;
                }
                if (!open || candidates.length === 0) return;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlight((h) => Math.min(h + 1, candidates.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlight((h) => Math.max(h - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  selectLoan(candidates[highlight]);
                }
              }}
              placeholder="Escriba el nombre, cédula o teléfono del cliente…"
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-400"
            />

            {/* Lista de clientes/créditos que aparece DEBAJO del buscador al escribir. */}
            {open && (
              <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {candidates.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-slate-400">
                    {search.trim() ? `Sin créditos para “${search.trim()}”.` : 'No hay créditos activos para cobrar.'}
                  </li>
                ) : (
                  candidates.map((l, i) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => selectLoan(l)}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${
                          i === highlight ? 'bg-teal-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-800">
                            {l.clientName || 'Sin nombre'}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {l.clientDocumentId || 's/cédula'}
                            {l.clientPhone ? ` · ${l.clientPhone}` : ''} ·{' '}
                            {TYPE_LABEL[l.loanType || ''] || l.loanType || '-'}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-bold text-teal-700">
                            Gs. {fmt((l.totalDue ?? l.currentBalance) || 0)}
                          </span>
                          {isFrozenStatus(l) && (
                            <span className="block text-[10px] font-semibold uppercase text-blue-600">Congelado</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
            <p className="mt-1 text-xs text-slate-500">
              {loanId
                ? 'Crédito seleccionado. Completá el monto y la fecha para registrar el cobro.'
                : 'Escribí y elegí el cliente de la lista que aparece debajo.'}
            </p>
          </div>

          {selected && (
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Saldo actual: <b>Gs. {fmt((selected.totalDue ?? selected.currentBalance) || 0)}</b> · Capital: Gs.{' '}
              {fmt(selected.principal || 0)}
              {selected.description && (
                <p className="mt-1 text-xs text-slate-500">
                  <span className="text-slate-400">Descripción: </span>
                  {selected.description}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">📅 Fecha del cobro</label>
              <input
                type="date"
                required
                max={localTodayInput()}
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                {paidAt && paidAt !== localTodayInput()
                  ? 'Cobro con fecha distinta a hoy (registro retroactivo).'
                  : 'Por defecto: hoy. Cambiala si el cobro fue otro día.'}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Monto (Gs.)</label>
              <input
                type="number"
                step="1"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de pago</label>
              <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                {fixedCapitalOnly ? (
                  <option value="CAPITAL">Solo capital</option>
                ) : (
                  <>
                    <option value="MIXED">Cobrar ambos</option>
                    <option value="CAPITAL">Solo capital</option>
                    <option value="INTEREST">Solo interés</option>
                  </>
                )}
              </select>
              {fixedCapitalOnly && (
                <p className="mt-1 text-xs text-teal-700">Este tipo de crédito no genera intereses: el cobro se imputa solo a capital.</p>
              )}
            </div>
          </div>

          <button disabled={busy} className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60">
            {busy ? 'Registrando…' : 'Registrar pago'}
          </button>
        </form>
      </div>
    </div>
  );
}
