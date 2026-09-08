import { useCallback, useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { api, apiPost } from '../lib/api';

interface PagareRow {
  id: string;
  tomo: string;
  nombre: string;
  cedula: string;
  monto: number;
  estado: 'activo' | 'cancelado';
  cobrador?: string;
  asignado?: boolean;
}

export default function Pagares() {
  const [pagares, setPagares] = useState<PagareRow[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [tomo, setTomo] = useState('');
  const [cantidad, setCantidad] = useState(5);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<PagareRow[]>('/pagares')
      .then(setPagares)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const tomos = useMemo(
    () => Array.from(new Set(pagares.map((p) => p.tomo).filter(Boolean))).sort(),
    [pagares],
  );
  const disponibles = useMemo(
    () => pagares.filter((p) => p.estado === 'activo' && !p.asignado).length,
    [pagares],
  );

  const createTomo = async () => {
    setError('');
    setInfo('');
    if (!tomo.trim()) return;
    setBusy(true);
    try {
      await apiPost<number>('/pagares/tomo', { tomo, cantidad });
      setInfo(`Tomo "${tomo}" creado con ${cantidad} pagarés.`);
      setTomo('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear el tomo.');
    } finally {
      setBusy(false);
    }
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      const result = await apiPost<{ importedCount: number; errorsCount: number }>('/pagares/import', {
        csvText: text,
      });
      setInfo(`Importados ${result.importedCount} pagarés (${result.errorsCount} errores).`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar CSV.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (row: PagareRow) => {
    const next = row.estado === 'activo' ? 'cancelado' : 'activo';
    await apiPost<{ success: boolean }>(`/pagares/${row.id}/status`, { estado: next });
    load();
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Registro de Pagarés', 14, 16);
    doc.setFontSize(9);
    let y = 26;
    doc.text('Tomo | Nombre | Cedula | Monto | Estado | Cobrador', 14, y);
    y += 6;
    pagares.forEach((p) => {
      doc.text(
        `${p.tomo} | ${p.nombre || '-'} | ${p.cedula || '-'} | ${p.monto || 0} | ${p.estado} | ${p.cobrador || '-'}`,
        14,
        y,
      );
      y += 5;
      if (y > 200) {
        doc.addPage('landscape');
        y = 20;
      }
    });
    doc.save('pagares.pdf');
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Pagarés</h2>
        <div className="flex gap-2">
          <label className="rounded bg-slate-600 px-3 py-1.5 text-sm text-white">
            Importar CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importCsv(file);
              }}
            />
          </label>
          <button
            onClick={exportPdf}
            disabled={pagares.length === 0}
            className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Descargar PDF
          </button>
        </div>
      </div>

      <div className="mb-4 rounded bg-white p-4 shadow">
        <h3 className="mb-2 text-sm font-semibold">Crear tomo de pagarés</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-600">Tomo</label>
            <input
              value={tomo}
              onChange={(e) => setTomo(e.target.value)}
              placeholder="Ej: T-2026-01"
              className="rounded border border-slate-300 px-3 py-1.5"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">Cantidad</label>
            <input
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              className="w-24 rounded border border-slate-300 px-3 py-1.5"
            />
          </div>
          <button
            onClick={createTomo}
            disabled={busy || !tomo.trim()}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {busy ? 'Creando…' : 'Crear tomo'}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Tomos existentes: {tomos.join(', ') || 'ninguno'} · Pagarés libres: {disponibles}
        </p>
      </div>

      {info && <p className="mb-3 text-sm text-green-700">{info}</p>}
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded bg-white shadow">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2">Tomo</th>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2">Cédula</th>
              <th className="px-3 py-2 text-right">Monto</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Cobrador</th>
              <th className="px-3 py-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {pagares.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-1.5">{p.tomo}</td>
                <td className="px-3 py-1.5">{p.nombre || '-'}</td>
                <td className="px-3 py-1.5">{p.cedula || '-'}</td>
                <td className="px-3 py-1.5 text-right">{p.monto.toLocaleString('es-PY')}</td>
                <td className="px-3 py-1.5">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      p.estado === 'cancelado'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {p.asignado ? 'Asignado' : p.estado}
                  </span>
                </td>
                <td className="px-3 py-1.5">{p.cobrador || '-'}</td>
                <td className="px-3 py-1.5">
                  <button onClick={() => void toggle(p)} className="text-xs text-blue-600 underline">
                    {p.estado === 'activo' ? 'Entregar' : 'Devolver'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
