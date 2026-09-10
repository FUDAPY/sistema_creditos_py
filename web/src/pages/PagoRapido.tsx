import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, apiPost } from '../lib/api';

interface LoanRow {
  id: string;
  clientName?: string;
  clientDocumentId?: string;
  loanType?: string;
  currentBalance: number;
  totalAmount: number;
  principal: number;
  totalDue?: number;
  description?: string;
  status?: string;
  approvalStatus?: string;
}

const fmt = (v: number) => Math.round(v).toLocaleString('es-PY');

export default function PagoRapido() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [search, setSearch] = useState('');
  const [loanId, setLoanId] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'CAPITAL' | 'INTEREST' | 'MIXED'>('MIXED');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (user?.role === 'COLLECTOR') params.set('collectorId', user.uid);
    api<LoanRow[]>(`/loans?approvalStatus=APPROVED&${params.toString()}`)
      .then(setLoans)
      .catch((e) => setError(e.message));
  }, [user]);

  const candidates = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('es');
    return loans.filter(
      (l) =>
        l.status === 'ACTIVE' &&
        (!q || `${l.clientName || ''} ${l.clientDocumentId || ''}`.toLocaleLowerCase('es').includes(q)),
    );
  }, [loans, search]);

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
    setBusy(true);
    try {
      await apiPost<Record<string, unknown>>('/payments', { loanId, amount: value, paymentType: type });
      setInfo('Pago registrado. Quedará pendiente de aprobación del administrador para impactar en el saldo.');
      setAmount('');
      setSearch('');
      setLoanId('');
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
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Buscar cliente</label>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLoanId('');
              }}
              placeholder="Nombre o cédula…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Crédito activo</label>
            <select value={loanId} onChange={(e) => setLoanId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Seleccionar…</option>
              {candidates.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.clientName} · {l.clientDocumentId} · Gs. {fmt((l.totalDue ?? l.currentBalance) || 0)}
                </option>
              ))}
            </select>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
