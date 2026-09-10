import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, apiPost } from '../lib/api';

interface ClientRow {
  id: string;
  fullName: string;
  documentId?: string;
  phone?: string;
}
interface UserRow {
  uid: string;
  name: string;
  role: string;
  isActive?: boolean;
}
interface PagareRow {
  tomo: string;
}

const CUOTAS_RATE: Record<number, number> = { 6: 20, 12: 20, 18: 25, 24: 30 };
const DAY_MS = 24 * 60 * 60 * 1000;
/** Tipos sin interés ni mora: se cobra únicamente el monto (capital). */
const NO_INTEREST_TYPES = ['CELULAR', 'ALQUILER_INMUEBLE', 'PRESTACION_SERVICIOS'];

const toDateInput = (value?: number) => {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const toMs = (value: string) => (value ? new Date(`${value}T12:00:00`).getTime() : undefined);

export default function LoanForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [collectors, setCollectors] = useState<UserRow[]>([]);
  const [tomos, setTomos] = useState<string[]>([]);

  const [clientId, setClientId] = useState('');
  const [clientText, setClientText] = useState('');
  const [clientOpen, setClientOpen] = useState(false);
  const [collectorId, setCollectorId] = useState(user?.role === 'COLLECTOR' ? user.uid : '');
  const [collectorName, setCollectorName] = useState(user?.role === 'COLLECTOR' ? user.name : '');
  const [loanType, setLoanType] = useState<'PRESTAMO' | 'EMPENO' | 'ALQUILER_INMUEBLE' | 'PRESTACION_SERVICIOS' | 'CELULAR'>('PRESTAMO');
  const [currency, setCurrency] = useState<'PYG' | 'USD'>('PYG');
  const [principal, setPrincipal] = useState(0);
  const [description, setDescription] = useState('');
  const isNoInterest = NO_INTEREST_TYPES.includes(loanType);
  const [cantidadCuotas, setCantidadCuotas] = useState<number | undefined>(undefined);
  const [cycleDays, setCycleDays] = useState(30);
  const [grantedDate, setGrantedDate] = useState(toDateInput(Date.now()));
  const [expiresDate, setExpiresDate] = useState(toDateInput(Date.now() + 30 * DAY_MS));

  const [tomoMode, setTomoMode] = useState<'ninguno' | 'existente' | 'nuevo'>('ninguno');
  const [tomoSel, setTomoSel] = useState('');
  const [tomoNuevo, setTomoNuevo] = useState('');

  const loadAll = useCallback(() => {
    api<ClientRow[]>('/clients').then(setClients).catch((e) => setError(e.message));
    api<UserRow[]>('/users?activeOnly=true')
      .then((rows) => setCollectors(rows.filter((r) => r.role === 'COLLECTOR')))
      .catch(() => undefined);
    api<PagareRow[]>('/pagares')
      .then((rows) => setTomos(Array.from(new Set(rows.map((r) => r.tomo).filter(Boolean))).sort()))
      .catch(() => undefined);
  }, []);
  useEffect(loadAll, [loadAll]);

  const interestRate = useMemo(() => {
    if (isNoInterest) return 0;
    if (cantidadCuotas && CUOTAS_RATE[cantidadCuotas] !== undefined) return CUOTAS_RATE[cantidadCuotas];
    return 20;
  }, [cantidadCuotas, isNoInterest]);
  const suggestions = useMemo(() => {
    const q = clientText.trim().toLocaleLowerCase('es');
    if (!q) return [];
    return clients
      .filter((c) =>
        `${c.fullName} ${c.documentId || ''}`.toLocaleLowerCase('es').includes(q),
      )
      .slice(0, 8);
  }, [clients, clientText]);
  const tomo = tomoMode === 'existente' ? tomoSel : tomoMode === 'nuevo' ? tomoNuevo.trim() : '';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!clientId || !collectorId) {
      setError('Seleccione cliente y cobrador.');
      return;
    }
    const grantedAt = toMs(grantedDate);
    const expiresAt = toMs(expiresDate);
    if (!grantedAt || !expiresAt) {
      setError('Indique las fechas.');
      return;
    }
    setBusy(true);
    try {
      await apiPost('/loans', {
        clientId,
        collectorId,
        collectorName,
        loanType,
        currency,
        principal,
        interestRate,
        cycleDays,
        cantidadCuotas: isNoInterest ? undefined : cantidadCuotas,
        planFrecuencia: !isNoInterest && cantidadCuotas ? 'MENSUAL' : 'ANUAL',
        grantedAt,
        expiresAt,
        description: description.trim() || undefined,
        tomo: tomo || undefined,
        hasPagare: Boolean(tomo),
      });
      navigate('/loans');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear el crédito.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h2 className="mb-4 text-xl font-semibold">Nuevo crédito</h2>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <form onSubmit={submit} className="grid grid-cols-2 gap-4 rounded bg-white p-5 shadow">
        <div className="block text-sm">
          Cliente *
          <div className="relative mt-1">
            <input
              value={clientText}
              onChange={(e) => {
                setClientText(e.target.value);
                setClientId('');
              }}
              onFocus={() => setClientOpen(true)}
              onBlur={() => window.setTimeout(() => setClientOpen(false), 150)}
              placeholder="Escribí nombre o documento…"
              className="w-full rounded border border-slate-300 px-2 py-1.5"
            />
            {clientOpen && suggestions.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setClientId(c.id);
                      setClientText(c.documentId ? `${c.fullName} · ${c.documentId}` : c.fullName);
                      setClientOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-teal-50"
                  >
                    <span className="font-medium text-slate-800">{c.fullName}</span>
                    {c.documentId && <span className="ml-1 text-xs text-slate-400">{c.documentId}</span>}
                    {c.phone && <span className="ml-1 text-xs text-slate-400">· {c.phone}</span>}
                  </button>
                ))}
              </div>
            )}
            {clientText && !clientId && suggestions.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">Sin coincidencias. Podés registrar al cliente desde "Nuevo Cliente".</p>
            )}
          </div>
        </div>
        <label className="block text-sm">
          Cobrador *
          <select required value={collectorId} onChange={(e) => {
            setCollectorId(e.target.value);
            setCollectorName(collectors.find((c) => c.uid === e.target.value)?.name || '');
          }} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5">
            <option value="">Seleccionar…</option>
            {collectors.map((c) => (
              <option key={c.uid} value={c.uid}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Tipo
          <select value={loanType} onChange={(e) => setLoanType(e.target.value as typeof loanType)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5">
            <option value="PRESTAMO">Préstamo</option>
            <option value="EMPENO">Empeño</option>
            <option value="ALQUILER_INMUEBLE">Alquiler de inmueble</option>
            <option value="PRESTACION_SERVICIOS">Prestación de servicios</option>
            <option value="CELULAR">Celular</option>
          </select>
        </label>
        <label className="block text-sm">
          Moneda
          <select value={currency} onChange={(e) => setCurrency(e.target.value as 'PYG' | 'USD')} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5">
            <option value="PYG">Guaraníes (PYG)</option>
            <option value="USD">Dólares (USD)</option>
          </select>
        </label>
        <label className="block text-sm">
          Capital *
          <input required type="number" min={0} value={principal || ''} onChange={(e) => setPrincipal(Number(e.target.value))} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" />
        </label>
        {isNoInterest ? (
          <div className="block text-sm">
            Plazo
            <input
              disabled
              value="Sin interés — se cobra solo el monto"
              className="mt-1 w-full rounded border border-slate-200 bg-slate-100 px-2 py-1.5 text-slate-500"
            />
          </div>
        ) : (
          <label className="block text-sm">
            Plazo (cuotas)
            <select value={cantidadCuotas ?? 0} onChange={(e) => setCantidadCuotas(Number(e.target.value) || undefined)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5">
              <option value={0}>A interés simple (sin cuotas)</option>
              <option value={6}>6 cuotas (20%)</option>
              <option value={12}>12 cuotas (20%)</option>
              <option value={18}>18 cuotas (25%)</option>
              <option value={24}>24 cuotas (30%)</option>
            </select>
          </label>
        )}
        <label className="block text-sm">
          Fecha de otorgamiento
          <input type="date" required value={grantedDate} onChange={(e) => setGrantedDate(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" />
        </label>
        <label className="block text-sm">
          Fecha de vencimiento
          <input type="date" required value={expiresDate} onChange={(e) => setExpiresDate(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5" />
        </label>
        <label className="col-span-2 block text-sm">
          Descripción {isNoInterest ? '*' : '(opcional)'}
          <textarea
            required={isNoInterest}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder={
              isNoInterest
                ? 'Detalle del equipo / inmueble / servicio (se verá en Créditos y Cartera Activa)'
                : 'Referencia u observaciones'
            }
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
          />
        </label>
        <p className="col-span-2 text-sm text-slate-600">
          Tasa de interés aplicada: <b>{interestRate}%</b>
          {isNoInterest && (
            <span className="ml-2 text-teal-700">
              Este tipo no genera interés ni mora: se cobra solo el monto (capital).
            </span>
          )}
        </p>

        <fieldset className="col-span-2 rounded border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium">Pagaré (tomo)</legend>
          <select value={tomoMode} onChange={(e) => setTomoMode(e.target.value as typeof tomoMode)} className="mb-2 w-full rounded border border-slate-300 px-2 py-1.5">
            <option value="ninguno">Sin pagaré</option>
            <option value="existente">Usar tomo existente</option>
            <option value="nuevo">Crear tomo nuevo</option>
          </select>
          {tomoMode === 'existente' && (
            <select value={tomoSel} onChange={(e) => setTomoSel(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5">
              <option value="">Seleccionar tomo…</option>
              {tomos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
          {tomoMode === 'nuevo' && (
            <input value={tomoNuevo} onChange={(e) => setTomoNuevo(e.target.value)} placeholder="Nombre del tomo (Ej: T-2026-01)" className="w-full rounded border border-slate-300 px-2 py-1.5" />
          )}
          {tomoMode !== 'ninguno' && (
            <p className="mt-1 text-xs text-slate-500">
              {tomoMode === 'nuevo'
                ? 'Si el tomo no tiene pagarés libres, se creará uno nuevo automáticamente al aprobar el crédito.'
                : 'Se asignará el primer pagaré libre del tomo seleccionado.'}
            </p>
          )}
        </fieldset>

        <div className="col-span-2 flex gap-2">
          <button type="submit" disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-60">
            {busy ? 'Guardando…' : 'Crear crédito'}
          </button>
          <button type="button" onClick={() => navigate('/loans')} className="rounded border border-slate-300 px-4 py-2 text-slate-700">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
