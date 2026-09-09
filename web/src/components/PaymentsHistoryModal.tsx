import { useEffect, useState } from 'react';
import Modal from './Modal';
import { api } from '../lib/api';

interface PaymentRow {
  id: string;
  amount: number;
  paymentType?: string;
  paidAt?: number;
  createdAt?: number;
  collectorName?: string;
  approvalStatus?: string;
  principalApplied?: number;
  interestApplied?: number;
  arrearsApplied?: number;
}

const fmt = (v?: number) => (v ?? 0).toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (t?: number) =>
  t ? new Intl.DateTimeFormat('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(t)) : '-';

const TYPE_LABEL: Record<string, string> = { MIXED: 'Ambos', CAPITAL: 'Solo capital', INTEREST: 'Solo interés' };
const APPROVAL_LABEL: Record<string, string> = { APPROVED: 'Aprobado', PENDING: 'Pendiente', REJECTED: 'Rechazado' };

/** Desglose de abonos de un crédito (historial con fecha, monto y cobrador). */
export default function PaymentsHistoryModal({
  loanId,
  clientName,
  onClose,
}: {
  loanId: string;
  clientName: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<PaymentRow[]>(`/payments?loanId=${loanId}`)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar abonos.'))
      .finally(() => setLoading(false));
  }, [loanId]);

  const total = rows.filter((r) => r.approvalStatus === 'APPROVED').reduce((acc, r) => acc + (r.amount || 0), 0);

  return (
    <Modal title="Historial de abonos" subtitle={clientName} onClose={onClose} wide>
      {loading ? (
        <p className="py-6 text-center text-sm text-slate-500">Cargando…</p>
      ) : error ? (
        <p className="py-6 text-center text-sm text-rose-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Sin abonos registrados para este crédito.</p>
      ) : (
        <>
          <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Total abonado (aprobado): <span className="font-semibold text-slate-900">{fmt(total)}</span>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Monto</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2 text-right">Capital</th>
                  <th className="px-3 py-2 text-right">Interés</th>
                  <th className="px-3 py-2 text-right">Mora</th>
                  <th className="px-3 py-2">Cobrador</th>
                  <th className="px-3 py-2">Aprobación</th>
                </tr>
              </thead>
              <tbody>
                {[...rows]
                  .sort((a, b) => (b.paidAt || b.createdAt || 0) - (a.paidAt || a.createdAt || 0))
                  .map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-600">{fmtDate(p.paidAt || p.createdAt)}</td>
                      <td className="px-3 py-2 font-semibold text-slate-800">{fmt(p.amount)}</td>
                      <td className="px-3 py-2">{TYPE_LABEL[p.paymentType || ''] || p.paymentType}</td>
                      <td className="px-3 py-2 text-right">{fmt(p.principalApplied)}</td>
                      <td className="px-3 py-2 text-right">{fmt(p.interestApplied)}</td>
                      <td className="px-3 py-2 text-right">{fmt(p.arrearsApplied)}</td>
                      <td className="px-3 py-2">{p.collectorName || '-'}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            p.approvalStatus === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-700'
                              : p.approvalStatus === 'REJECTED'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {APPROVAL_LABEL[p.approvalStatus || ''] || p.approvalStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
