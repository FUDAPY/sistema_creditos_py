import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, apiPost } from '../lib/api';
import CreditTable, { type LoanRow } from '../components/CreditTable';
import { money } from '../lib/format';

interface SiteRow { id: string; name?: string; locationName?: string; collectorName?: string; isActive?: boolean; }
interface ExternalRow {
  id: string;
  sistema: string;
  clienteNombre: string;
  cedula?: string;
  telefono?: string;
  direccion?: string;
  referencia?: string;
  referenciaDetalle?: string;
  concepto?: string;
  montoTotal: number;
  saldoPendiente: number;
  estado?: string;
  syncedAt?: number;
}

const fmt = (v: number) => money(v);
const fmtDate = (t?: number) => (t ? new Intl.DateTimeFormat('es-PY').format(new Date(t)) : '-');

const TITLES: Record<string, string> = { creditos: 'Créditos', alquileres: 'Alquileres', empenos: 'Empeños', prestacion: 'Prestación', tragamonedas: 'Tragamonedas', pos: 'POS', juridico: 'Jurídico' };
const STATUS: Record<string, string> = { ACTIVE: 'Activo', FROZEN: 'Congelado', PAID: 'Pagado', ANULADO: 'Anulado' };

export default function Empresas({ categoria }: { categoria: string }) {
  const { user } = useAuth();
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [external, setExternal] = useState<ExternalRow[]>([]);
  const [lastSync, setLastSync] = useState<number>();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const reload = () => setReloadVersion((v) => v + 1);

  // POS y Juridico son sistemas EXTERNOS: se leen de la coleccion local sincronizada.
  const isExternal = categoria === 'juridico' || categoria === 'pos';

  const loadExternal = () => {
    setError('');
    setInfo('');
    api<ExternalRow[]>(`/external-credits?system=${categoria}`)
      .then((rows) => {
        setExternal(rows);
        setLastSync(rows[0]?.syncedAt);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    if (isExternal) {
      loadExternal();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, categoria, reloadVersion]);

  const rows = useMemo(() => {
    if (isExternal) return [];
    const typeMap: Record<string, string[]> = { creditos: ['PRESTAMO'], alquileres: ['ALQUILER_INMUEBLE'], empenos: ['EMPENO'], prestacion: ['PRESTACION_SERVICIOS'] };
    return loans.filter((l) => {
      if (typeMap[categoria]) return typeMap[categoria].includes(l.loanType || '');
      return false;
    });
  }, [loans, categoria, isExternal]);

  const runSync = async () => {
    setSyncing(true);
    setError('');
    setInfo('');
    try {
      const res = await apiPost<{ imported: number; total: number }>(`/external-credits/${categoria}/sync`, {});
      setInfo(`Sincronización OK: ${res.imported} registros actualizados (${res.total} en el sistema de origen).`);
      loadExternal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al sincronizar.');
    } finally {
      setSyncing(false);
    }
  };

  const tituloExterno = categoria === 'juridico' ? 'Jurídico' : 'POS';
  return (
    <div className="p-6">
      <div className="mx-auto w-full max-w-none">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">{TITLES[categoria] || categoria}</h2>
          {isExternal && user?.role === 'ADMIN' && (
            <button
              onClick={runSync}
              disabled={syncing}
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {syncing ? 'Sincronizando…' : '↻ Sincronizar ahora'}
            </button>
          )}
        </div>
        <p className="mb-4 text-sm text-slate-500">
          {isExternal
            ? `${external.length} registros${lastSync ? ` · último sync: ${fmtDate(lastSync)}` : ' · sin sincronizar aún'}`
            : categoria === 'tragamonedas'
              ? `${sites.length} sitios`
              : `${rows.length} registros`}
        </p>
        {info && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{info}</div>}
        {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}

        {isExternal ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Teléfono</th>
                  <th className="px-4 py-3">Referencia</th>
                  <th className="px-4 py-3">Detalle</th>
                  <th className="px-4 py-3">Concepto</th>
                  <th className="px-4 py-3 text-right">Monto Total</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Sync</th>
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {external.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-800">{r.clienteNombre || '-'}</p>
                      {r.cedula && <p className="text-xs text-slate-400">{r.cedula}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{r.telefono || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.referencia || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.referenciaDetalle || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.concepto || '-'}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(r.montoTotal || 0)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-rose-600">{fmt(r.saldoPendiente || 0)}</td>
                    <td className="px-4 py-2.5">{r.estado || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{fmtDate(r.syncedAt)}</td>
                    <td className="px-4 py-2.5">
                      <button
                        disabled
                        title="Crédito externo (POS/Jurídico): el cobro se registra en su sistema de origen y aquí llega sincronizado."
                        className="cursor-not-allowed rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-400"
                      >
                        Cobro
                      </button>
                    </td>
                  </tr>
                ))}
                {external.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                      {`Sin registros sincronizados de ${tituloExterno}${user?.role === 'ADMIN' ? ' — presioná "Sincronizar ahora" (o configurá la integración si es la primera vez)' : ''}.`}
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
                  <th className="px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{s.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{s.locationName}</td>
                    <td className="px-4 py-2.5 text-slate-600">{s.collectorName || '-'}</td>
                    <td className="px-4 py-2.5">{s.isActive ? 'Activo' : 'Inactivo'}</td>
                    <td className="px-4 py-2.5">
                      <button
                        disabled
                        title="Los cobros de tragamonedas se gestionan en el módulo de recaudación específico."
                        className="cursor-not-allowed rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-400"
                      >
                        Cobro
                      </button>
                    </td>
                  </tr>
                ))}
                {sites.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Sin sitios</td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          <CreditTable loans={rows} reload={reload} />
        )}
      </div>
    </div>
  );
}
