import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import CreditTable, { type LoanRow } from '../components/CreditTable';

export default function CarteraActiva() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LoanRow[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (user?.role === 'COLLECTOR') params.set('collectorId', user.uid);
    api<LoanRow[]>(`/loans?${params.toString()}`)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar cartera.'));
  }, [user]);

  useEffect(load, [load]);

  return (
    <div className="p-4 lg:p-6">
      <div className="mx-auto w-full max-w-none">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 lg:text-xl">Cartera Activa</h2>
            <p className="text-xs text-slate-500">
              {rows.length} créditos · paginación de 25 registros · hacé clic en el cliente, el total abonado o Acciones
            </p>
          </div>
        </div>
        {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}
        <CreditTable loans={rows} reload={load} />
      </div>
    </div>
  );
}
