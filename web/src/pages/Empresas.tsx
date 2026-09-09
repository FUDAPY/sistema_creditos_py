import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface LoanRow { id: string; clientName?: string; loanType?: string; origen?: string; principal: number; currentBalance: number; totalAmount: number; status?: string; collectorName?: string; }
interface SiteRow { id: string; name?: string; locationName?: string; collectorName?: string; isActive?: boolean; }
const fmt = (v: number) => v.toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (t?: number) => (t ? new Intl.DateTimeFormat('es-PY').format(new Date(t)) : '-');

const TITLES: Record<string, string> = { creditos: 'Créditos', alquileres: 'Alquileres', empenos: 'Empeños', prestacion: 'Prestación', tragamonedas: 'Tragamonedas', pos: 'POS', juridico: 'Jurídico' };
const STATUS: Record<string, string> = { ACTIVE: 'Activo', FROZEN: 'Congelado', PAID: 'Pagado', ANULADO: 'Anulado' };

export default function Empresas({ categoria }: { categoria: string }) {
  const { user } = useAuth();
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (user?.role === 'COLLECTOR') params.set('collectorId', user.uid);
    api<LoanRow[]>(`/loans?approvalStatus=APPROVED&${params.toString()}`)
      .then(setLoans)
      .catch((e) => setError(e.message));
    if (categoria === 'tragamonedas') {
      api<SiteRow[]>('/slot-machines/sites').then(setSites).catch(() => undefined);
    }
  }, [user, categoria]);

  const rows = useMemo(() => {
    const typeMap: Record<string, string[]> = { creditos: ['PRESTAMO'], alquileres: ['ALQUILER_INMUEBLE'], empenos: ['EMPENO'], prestacion: ['PRESTACION_SERVICIOS'] };
    return loans.filter((l) => {
      if (typeMap[categoria]) return typeMap[categoria].includes(l.loanType || '');
      if (categoria === 'pos') return l.origen === 'pos' || l.loanType === 'POS';
      if (categoria === 'juridico') return l.origen === 'juridico' || l.loanType === 'JURIDICO';
      return false;
    });
  }, [loans, categoria]);

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-xl font-semibold text-slate-900">{TITLES[categoria] || categoria}</h2>
        <p className="mb-4 text-sm text-slate-500">{categoria === 'tragamonedas' ? `${sites.length} sitios` : `${rows.length} registros`}</p>
        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

        {categoria === 'tragamonedas' ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Sitio</th>
                  <th className="px-4 py-3">Local</th>
                  <th className="px-4 py-3">Cobrador</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{s.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{s.locationName}</td>
                    <td className="px-4 py-2.5 text-slate-600">{s.collectorName || '-'}</td>
                    <td className="px-4 py-2.5">{s.isActive ? 'Activo' : 'Inactivo'}</td>
                  </tr>
                ))}
                {sites.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Sin sitios</td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 text-right">Capital</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Cobrador</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.clientName || '-'}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(r.principal || 0)}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(r.currentBalance || 0)}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(r.totalAmount || 0)}</td>
                    <td className="px-4 py-2.5">{r.collectorName || '-'}</td>
                    <td className="px-4 py-2.5">{STATUS[r.status || ''] || r.status}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin registros</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
