import { useEffect, useState } from 'react';
import Modal from './Modal';
import PaymentsHistoryModal from './PaymentsHistoryModal';
import { api } from '../lib/api';

interface ClientRow {
  id: string;
  fullName?: string;
  documentId?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  collectorName?: string;
}
interface ClientLoan {
  id: string;
  clientName?: string;
  loanType?: string;
  principal?: number;
  totalAmount?: number;
  paidAmount?: number;
  currentBalance?: number;
  status?: string;
  expiresAt?: number;
  approvalStatus?: string;
}

const fmt = (v?: number) => (v ?? 0).toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (t?: number) => (t ? new Intl.DateTimeFormat('es-PY').format(new Date(t)) : '-');
const TYPE_LABEL: Record<string, string> = { PRESTAMO: 'Préstamo', EMPENO: 'Empeño', ALQUILER_INMUEBLE: 'Alquiler', PRESTACION_SERVICIOS: 'Prestación', CELULAR: 'Celular' };
const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Activo', FROZEN: 'Congelado', CONGELADO: 'Congelado', PAID: 'Pagado', ANULADO: 'Anulado' };

/** Ficha completa del cliente: datos + todas sus deudas e historial de abonos. */
export default function ClientDetailModal({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [client, setClient] = useState<ClientRow | null>(null);
  const [loans, setLoans] = useState<ClientLoan[]>([]);
  const [historyLoan, setHistoryLoan] = useState<{ id: string; clientName: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<ClientRow>(`/clients/${clientId}`)
      .then(setClient)
      .catch((e) => setError(e.message));
    api<ClientLoan[]>(`/loans?clientId=${clientId}`)
      .then(setLoans)
      .catch(() => undefined);
  }, [clientId]);

  const activos = loans.filter((l) => l.status === 'ACTIVE' && l.approvalStatus !== 'PENDING');
  const adeudado = loans.reduce((acc, l) => acc + (l.currentBalance ?? 0), 0);
  const abonado = loans.reduce((acc, l) => acc + (l.paidAmount ?? 0), 0);
  return (
    <>
      {historyLoan ? (
        <PaymentsHistoryModal loanId={historyLoan.id} clientName={historyLoan.clientName} onClose={() => setHistoryLoan(null)} />
      ) : (
        <Modal title="Ficha del cliente" subtitle={client?.fullName || 'Cargando…'} onClose={onClose} wide>
          {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}
          {client && (
            <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 sm:grid-cols-3">
              <p><span className="text-slate-400">C.I.: </span>{client.documentId || '-'}</p>
              <p><span className="text-slate-400">Tel: </span>{client.phone || '-'}</p>
              <p><span className="text-slate-400">Cobrador: </span>{client.collectorName || '-'}</p>
              <p className="col-span-2"><span className="text-slate-400">Dirección: </span>{[client.address, client.city].filter(Boolean).join(', ') || '-'}</p>
              {client.email && <p><span className="text-slate-400">Email: </span>{client.email}</p>}
            </div>
          )}
          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-slate-200 px-2 py-3">
              <p className="text-lg font-bold text-slate-900">{loans.length}</p>
              <p className="text-[11px] uppercase text-slate-400">Créditos</p>
            </div>
            <div className="rounded-xl border border-slate-200 px-2 py-3">
              <p className="text-lg font-bold text-rose-600">{fmt(adeudado)}</p>
              <p className="text-[11px] uppercase text-slate-400">Total adeudado</p>
            </div>
            <div className="rounded-xl border border-slate-200 px-2 py-3">
              <p className="text-lg font-bold text-emerald-600">{fmt(abonado)}</p>
              <p className="text-[11px] uppercase text-slate-400">Total abonado</p>
            </div>
          </div>

          <h4 className="mb-2 text-sm font-semibold text-slate-700">
            Deudas e historial crediticio {activos.length > 0 && `(${activos.length} activas)`}
          </h4>
          {loans.length === 0 ? (
            <p className="rounded-xl bg-slate-50 py-6 text-center text-sm text-slate-400">Sin créditos registrados.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Crédito</th>
                    <th className="px-3 py-2 text-right">Capital</th>
                    <th className="px-3 py-2 text-right">Abonado</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                    <th className="px-3 py-2">Vence</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((l) => (
                    <tr key={l.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <span className="font-medium text-slate-800">{TYPE_LABEL[l.loanType || ''] || l.loanType}</span>
                        <button
                          onClick={() => setHistoryLoan({ id: l.id, clientName: l.clientName || client?.fullName || '' })}
                          className="ml-2 text-xs font-medium text-teal-600 hover:underline"
                        >
                          ver abonos →
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right">{fmt(l.principal)}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{fmt(l.paidAmount)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmt(l.currentBalance)}</td>
                      <td className="px-3 py-2">{fmtDate(l.expiresAt)}</td>
                      <td className="px-3 py-2">{STATUS_LABEL[l.status || ''] || l.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
