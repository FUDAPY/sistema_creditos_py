import { useEffect, useState } from 'react';
import Modal from './Modal';
import { api, apiPatch, apiPost } from '../lib/api';
import { printPaymentTicket, type TicketData } from '../lib/ticket';
import { money } from '../lib/format';

export interface LoanLite {
  id: string;
  clientId?: string;
  clientName?: string;
  loanType?: string;
  principal: number;
  interestRate?: number;
  totalAmount?: number;
  currentBalance?: number;
  principalBalance?: number;
  interestDue?: number;
  lateFeeDue?: number;
  totalDue?: number;
  paidAmount?: number;
  status?: string;
  collectorId?: string;
  collectorName?: string;
  expiresAt?: number;
  grantedAt?: number;
  inforconfConfirmedAt?: number;
  hasPagare?: boolean;
  isLocatable?: boolean;
}

interface CollectorRow { uid: string; name: string; role?: string; }

const fmt = (v?: number) => money(v);
const toDateInput = (t?: number) => (t ? new Date(t).toISOString().slice(0, 10) : '');
const dateInputMs = (v: string) => (v ? new Date(`${v}T12:00:00`).getTime() : 0);
const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
const labelCls = 'mb-1 block text-xs font-medium text-slate-500';

/** Acciones por fila de crédito: "Administrar" (gestión) y "Cobro" (imputación de pago). */
export default function LoanRowActions({
  loan,
  role,
  reload,
  onShowHistory,
}: {
  loan: LoanLite;
  role?: string;
  reload: () => void;
  onShowHistory: () => void;
}) {
  // Prestación (congelado) y Alquiler (monto fijo): no generan intereses -> solo cobro de capital.
  const isNoInterestType = loan.loanType === 'PRESTACION_SERVICIOS' || loan.loanType === 'ALQUILER_INMUEBLE';
  const payOptions: Array<{ value: 'MIXED' | 'CAPITAL' | 'INTEREST'; label: string; hint: string }> = [
    { value: 'MIXED', label: 'Cobrar ambos', hint: 'Impacta proporcionalmente en capital e interés (primero mora).' },
    { value: 'CAPITAL', label: 'Cobrar capital', hint: 'Impacta únicamente en el saldo de capital.' },
    { value: 'INTEREST', label: 'Cobrar interés', hint: 'Impacta únicamente en el saldo de interés/mora.' },
  ];
  const cobroOptions = isNoInterestType ? payOptions.filter((o) => o.value === 'CAPITAL') : payOptions;

  // Saldo = Capital pendiente + Interés + Mora (el backend entrega totalDue ya calculado).
  const saldoActual = loan.totalDue ?? Math.max(0, (loan.currentBalance || 0) + (loan.interestDue || 0) + (loan.lateFeeDue || 0));

  const isAdmin = role === 'ADMIN';
  const [mode, setMode] = useState<'none' | 'admin' | 'cobro'>('none');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Cobro
  const [amount, setAmount] = useState('');
  const [payType, setPayType] = useState<'MIXED' | 'CAPITAL' | 'INTEREST'>('MIXED');

  // Administrar / editar
  const [collectors, setCollectors] = useState<CollectorRow[]>([]);
  const [edit, setEdit] = useState({
    principal: String(loan.principal ?? 0),
    interestRate: String(loan.interestRate ?? 20),
    grantedAt: toDateInput(loan.grantedAt),
    expiresAt: toDateInput(loan.expiresAt),
    collectorId: loan.collectorId || '',
  });
  const [requisitos, setRequisitos] = useState({
    hasPagare: Boolean(loan.hasPagare),
    isLocatable: Boolean(loan.isLocatable),
  });
  const [anularReason, setAnularReason] = useState('');
  const [redirect, setRedirect] = useState('');

  useEffect(() => {
    if (!mode || mode === 'none') return;
    setInfo('');
    setError('');
    if (mode === 'cobro') setPayType(isNoInterestType ? 'CAPITAL' : 'MIXED');
  }, [mode]);

  useEffect(() => {
    if (!isAdmin || mode !== 'admin') return;
    api<CollectorRow[]>('/users?activeOnly=true')
      .then((rows) => setCollectors(rows.filter((r) => r.role === 'COLLECTOR')))
      .catch(() => undefined);
    setEdit({
      principal: String(loan.principal ?? 0),
      interestRate: String(loan.interestRate ?? 20),
      grantedAt: toDateInput(loan.grantedAt),
      expiresAt: toDateInput(loan.expiresAt),
      collectorId: loan.collectorId || '',
    });
    setRequisitos({ hasPagare: Boolean(loan.hasPagare), isLocatable: Boolean(loan.isLocatable) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, mode]);

  const guard = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    setInfo('');
    setError('');
    try {
      await fn();
      setInfo('Operación realizada correctamente.');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en la operación.');
    } finally {
      setBusy(false);
    }
  };

  const doCobro = guard(async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) throw new Error('Ingresá un monto válido.');
    const created = await apiPost<Record<string, unknown>>('/payments', {
      loanId: loan.id,
      amount: value,
      paymentType: payType,
    });
    void printPaymentTicket(created as unknown as TicketData);
    setInfo('Pago registrado. Queda pendiente de aprobación del administrador.');
    setAmount('');
  });

  const doEditar = guard(async () => {
    const collector = collectors.find((c) => c.uid === edit.collectorId) || { uid: loan.collectorId || '', name: loan.collectorName || '' };
    if (!collector.uid) throw new Error('Seleccioná un cobrador asignado.');
    await apiPatch(`/loans/${loan.id}`, {
      principal: Number(edit.principal) || 0,
      interestRate: Number(edit.interestRate) || 0,
      grantedAt: dateInputMs(edit.grantedAt) || loan.grantedAt,
      expiresAt: dateInputMs(edit.expiresAt) || loan.expiresAt,
      collectorId: collector.uid,
      collectorName: collector.name,
    });
    reload();
  });

  const doRequisitos = guard(async () => {
    await apiPatch(`/loans/${loan.id}/meta`, {
      hasPagare: requisitos.hasPagare,
      isLocatable: requisitos.isLocatable,
    });
  });

  const doFreeze = guard(async () => {
    await apiPost<{ success: boolean }>(`/loans/${loan.id}/freeze`);
  });

  const doInforconf = guard(async () => {
    await apiPost<{ success: boolean }>(`/loans/${loan.id}/inforconf`);
  });

  const doRedirect = guard(async () => {
    const collector = collectors.find((c) => c.uid === redirect);
    if (!collector) throw new Error('Seleccioná el nuevo cobrador.');
    await apiPost(`/loans/${loan.id}/redirect`, { collectorId: collector.uid, collectorName: collector.name });
    setRedirect('');
  });

  const doAnular = guard(async () => {
    if (!anularReason.trim()) throw new Error('La razón de anulación es obligatoria.');
    await apiPost(`/loans/${loan.id}/anular`, { reason: anularReason.trim() });
    setAnularReason('');
  });

  return (
    <>
      <div className="flex gap-1.5">
        <button
          onClick={() => setMode('admin')}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-teal-400 hover:text-teal-700"
        >
          Administrar
        </button>
        <button
          onClick={() => setMode('cobro')}
          className="rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700"
        >
          Cobro
        </button>
      </div>

      {mode === 'cobro' && (
        <Modal title="Registrar cobro" subtitle={`${loan.clientName || ''} · saldo ${fmt(saldoActual)}`} onClose={() => setMode('none')}>
          {info && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</div>}
          {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
          <div className="space-y-3">
            <fieldset className="rounded-xl border border-slate-200 p-3">
              <legend className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Tipo de cobro
              </legend>
              <div className="grid gap-1.5">
                {cobroOptions.map((o) => (
                  <label
                    key={o.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition ${
                      payType === o.value ? 'bg-teal-50 ring-1 ring-inset ring-teal-500' : 'hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payType"
                      value={o.value}
                      checked={payType === o.value}
                      onChange={() => setPayType(o.value)}
                      className="mt-0.5 h-4 w-4 accent-teal-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{o.label}</span>
                      <span className="block text-xs leading-snug text-slate-500">{o.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              {isNoInterestType && (
                <p className="mt-2 text-[11px] text-teal-700">
                  Este tipo de crédito no genera intereses ni mora: el cobro se imputa solo a capital.
                </p>
              )}
            </fieldset>
            <div>
              <label className={labelCls}>Monto</label>
              <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            {(() => {
              const value = Number(amount);
              if (!Number.isFinite(value) || value <= 0) return null;
              const nuevo = Math.max(0, saldoActual - value);
              return (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                  <span className="font-medium text-slate-800">Saldo actual</span>{' '}
                  <span className="tabular-nums">{fmt(saldoActual)}</span>
                  <span className="mx-1 text-slate-400">−</span>
                  <span className="font-medium text-rose-600 tabular-nums">{fmt(value)}</span>
                  <span className="mx-1 text-slate-400">=</span>
                  <span className="font-bold text-emerald-700 tabular-nums">Nuevo saldo {fmt(nuevo)}</span>
                </div>
              );
            })()}
            <button
              onClick={() => void doCobro()}
              disabled={busy}
              className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {busy ? 'Registrando…' : 'Registrar cobro'}
            </button>
          </div>
        </Modal>
      )}

      {mode === 'admin' && (
        <Modal title="Administrar crédito" subtitle={loan.clientName || ''} onClose={() => setMode('none')} wide>
          {info && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</div>}
          {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 px-2 py-2">
                <p className="text-xs text-slate-400">Capital</p>
                <p className="font-bold text-slate-800">{fmt(loan.principal)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-2 py-2">
                <p className="text-xs text-slate-400">Abonado</p>
                <p className="font-bold text-emerald-600">{fmt(loan.paidAmount)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-2 py-2">
                <p className="text-xs text-slate-400">Saldo</p>
                <p className="font-bold text-rose-600">{fmt(saldoActual)}</p>
              </div>
            </div>

            <button onClick={() => { setMode('none'); onShowHistory(); }} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-teal-400">
              <span className="font-semibold text-slate-700">Ver / editar abonos</span>
              <span className="block text-xs text-slate-500">Abre el historial completo de pagos del crédito.</span>
            </button>
            {isAdmin && (
              <section className="rounded-xl border border-slate-200 p-3">
                <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Editar crédito</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Capital</label>
                    <input type="number" value={edit.principal} onChange={(e) => setEdit({ ...edit, principal: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Interés (%)</label>
                    <input type="number" step="0.01" value={edit.interestRate} onChange={(e) => setEdit({ ...edit, interestRate: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Otorgado</label>
                    <input type="date" value={edit.grantedAt} onChange={(e) => setEdit({ ...edit, grantedAt: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Vencimiento</label>
                    <input type="date" value={edit.expiresAt} onChange={(e) => setEdit({ ...edit, expiresAt: e.target.value })} className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Cobrador asignado</label>
                    <select value={edit.collectorId} onChange={(e) => setEdit({ ...edit, collectorId: e.target.value })} className={inputCls}>
                      {collectors.map((c) => (
                        <option key={c.uid} value={c.uid}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button onClick={() => void doEditar()} disabled={busy} className="mt-2 w-full rounded-lg bg-slate-800 px-3 py-2 text-white disabled:opacity-60">
                  Guardar cambios del crédito
                </button>
              </section>
            )}
            {isAdmin && (
              <section className="rounded-xl border border-slate-200 p-3">
                <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Requisitos</h4>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={requisitos.hasPagare}
                      onChange={(e) => setRequisitos({ ...requisitos, hasPagare: e.target.checked })}
                    />
                    Tiene pagaré
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={requisitos.isLocatable}
                      onChange={(e) => setRequisitos({ ...requisitos, isLocatable: e.target.checked })}
                    />
                    Cliente ubicable
                  </label>
                  <button
                    onClick={() => void doRequisitos()}
                    disabled={busy}
                    className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                  >
                    Guardar requisitos
                  </button>
                </div>
              </section>
            )}
            {isAdmin && (
              <section className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                <h4 className="mb-2 text-xs font-semibold uppercase text-rose-500">Acciones administrativas</h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {loan.status === 'ACTIVE' && (
                    <button onClick={() => void doFreeze()} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-left hover:border-teal-400">
                      <span className="font-semibold text-slate-700">❄ Congelar crédito</span>
                      <span className="block text-xs text-slate-500">Detiene el cómputo de intereses y moras.</span>
                    </button>
                  )}
                  {!loan.inforconfConfirmedAt && loan.status === 'ACTIVE' && (
                    <button onClick={() => void doInforconf()} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-left hover:border-amber-400">
                      <span className="font-semibold text-slate-700">Confirmar Inforconf</span>
                      <span className="block text-xs text-slate-500">Marca el cliente como reportado.</span>
                    </button>
                  )}
                  <div className="rounded-lg border border-slate-300 bg-white p-2">
                    <p className="mb-1 text-xs font-semibold text-slate-700">↪ Redirigir (cambiar cobrador)</p>
                    <div className="flex gap-1.5">
                      <select value={redirect} onChange={(e) => setRedirect(e.target.value)} className={inputCls}>
                        <option value="">Elegir cobrador…</option>
                        {collectors.map((c) => (
                          <option key={c.uid} value={c.uid}>{c.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => void doRedirect()}
                        disabled={busy || !redirect}
                        className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-rose-300 bg-white p-2">
                    <p className="mb-1 text-xs font-semibold text-rose-700">✕ Anular crédito</p>
                    <input
                      value={anularReason}
                      onChange={(e) => setAnularReason(e.target.value)}
                      placeholder="Razón de anulación…"
                      className={`${inputCls} mb-1.5`}
                    />
                    <button
                      onClick={() => void doAnular()}
                      disabled={busy}
                      className="w-full rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Anular definitivamente
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
