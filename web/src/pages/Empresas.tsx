import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface LoanRow { id: string; clientName?: string; loanType?: string; origen?: string; principal: number; currentBalance: number; totalAmount: number; status?: string; collectorName?: string; }
interface SiteRow { id: string; name?: string; locationName?: string; collectorName?: string; isActive?: boolean; }
interface JuridicoRow {
  id: string;
  clienteNombre: string;
  cedula?: string;
  telefono?: string;
  direccion?: string;
  caratula?: string;
  juzgado?: string;
  fuero?: string;
  estadoExpediente?: string;
  concepto?: string;
  montoTotal: number;
  saldoPendiente: number;
  updatedAt?: number;
}
const fmt = (v: number) => v.toLocaleString('es-PY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (t?: number) => (t ? new Intl.DateTimeFormat('es-PY').format(new Date(t)) : '-');

const TITLES: Record<string, string> = { creditos: 'Créditos', alquileres: 'Alquileres', empenos: 'Empeños', prestacion: 'Prestación', tragamonedas: 'Tragamonedas', pos: 'POS', juridico: 'Jurídico' };
const STATUS: Record<string, string> = { ACTIVE: 'Activo', FROZEN: 'Congelado', PAID: 'Pagado', ANULADO: 'Anulado' };

export default function Empresas({ categoria }: { categoria: string }) {
  const { user } = useAuth();
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [juridico, setJuridico] = useState<JuridicoRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (categoria === 'juridico') {
      api<JuridicoRow[]>('/integrations/juridico/creditos')
        .then(setJuridico)
        .catch((e) => setError(e.message));
      return;
    }
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
    if (categoria === 'juridico') return [];
    const typeMap: Record<string, string[]> = { creditos: ['PRESTAMO'], alquileres: ['ALQUILER_INMUEBLE'], empenos: ['EMPENO'], prestacion: ['PRESTACION_SERVICIOS'] };
    return loans.filter((l) => {
      if (typeMap[categoria]) return typeMap[categoria].includes(l.loanType || '');
      if (categoria === 'pos') return l.origen === 'pos' || l.loanType === 'POS';
      return false;
    });
  }, [loans, categoria]);

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-xl font-semibold text-slate-900">{TITLES[categoria] || categoria}</h2>
        <p className="mb-4 text-sm text-slate-500">
          {categoria === 'juridico'
            ? `${juridico.length} créditos (sistema lin-group-central)`
            : categoria === 'tragamonedas'
              ? `${sites.length} sitios`
              : `${rows.length} registros`}
        </p>
        {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

        {categoria === 'juridico' ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Expediente</th>
                  <th className="px-4 py-3">Juzgado</th>
                  <th className="px-4 py-3">Concepto</th>
                  <th className="px-4 py-3 text-right">Monto Total</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {juridico.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-800">{r.clienteNombre}</p>
                      {r.cedula && <p className="text-xs text-slate-400">{r.cedula}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{r.telefono || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.caratula || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.juzgado || r.fuero || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.concepto || '-'}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(r.montoTotal || 0)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-rose-600">{fmt(r.saldoPendiente || 0)}</td>
                    <td className="px-4 py-2.5">{r.estadoExpediente || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{fmtDate(r.updatedAt)}</td>
                  </tr>
                ))}
                {juridico.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      Sin créditos jurídicos o sin conexión configurada al sistema lin-group-central
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : categoria === 'tragamonedas' ? (
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
