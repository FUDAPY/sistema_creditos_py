import { useCallback, useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { api, apiPatch, apiPost } from '../lib/api';

interface PagareRow {
  id: string;
  tomo: string;
  nombre: string;
  cedula: string;
  monto: number;
  estado: 'activo' | 'cancelado';
  cobrador?: string;
  collectorId?: string;
  asignado?: boolean;
}

interface CollectorOption { uid: string; name: string; }

interface PagareResumen {
  total: number;
  activos: number;
  cancelados: number;
  disponibles: number;
  asignados: number;
  porTomo: Array<{ tomo: string; total: number; activos: number; cancelados: number; disponibles: number }>;
}

export default function Pagares() {
  const [pagares, setPagares] = useState<PagareRow[]>([]);
  const [resumen, setResumen] = useState<PagareResumen | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [tomo, setTomo] = useState('');
  const [cantidad, setCantidad] = useState(5);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<'' | 'activo' | 'cancelado'>('');
  const [tomoFiltro, setTomoFiltro] = useState('');
  const [cobradorFiltro, setCobradorFiltro] = useState('');
  const [collectors, setCollectors] = useState<CollectorOption[]>([]);

  const load = useCallback(() => {
    api<PagareRow[]>('/pagares')
      .then(setPagares)
      .catch((e) => setError(e.message));
    api<PagareResumen>('/pagares/resumen')
      .then(setResumen)
      .catch(() => undefined);
    api<CollectorOption[]>('/pagares/collectors')
      .then(setCollectors)
      .catch(() => undefined);
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

  /** Buscador global de pagarés (nombre, cédula, tomo, cobrador y monto). */
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es');
    return pagares.filter((p) => {
      if (estadoFiltro && p.estado !== estadoFiltro) return false;
      if (tomoFiltro && p.tomo !== tomoFiltro) return false;
      if (cobradorFiltro === '__none__') {
        if (p.cobrador) return false;
      } else if (cobradorFiltro && p.cobrador !== cobradorFiltro) {
        return false;
      }
      if (!q) return true;
      const haystack = `${p.nombre || ''} ${p.cedula || ''} ${p.tomo || ''} ${p.cobrador || ''} ${
        p.monto || 0
      }`.toLocaleLowerCase('es');
      return haystack.includes(q);
    });
  }, [pagares, query, estadoFiltro, tomoFiltro, cobradorFiltro]);

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

  /** Asigna el pagaré al cobrador elegido (o lo libera si se elige vacío). */
  const assign = async (row: PagareRow, name: string) => {
    setError('');
    setInfo('');
    const collector = collectors.find((c) => c.name === name);
    try {
      await apiPatch<{ success: boolean }>(`/pagares/${row.id}/cobrador`, {
        cobrador: name,
        collectorId: collector?.uid || '',
      });
      setInfo(name ? `Pagaré ${row.tomo} asignado a ${name}.` : `Pagaré ${row.tomo} liberado.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo asignar el cobrador.');
    }
  };

  const toggle = async (row: PagareRow) => {
    const next = row.estado === 'activo' ? 'cancelado' : 'activo';
    try {
      await apiPatch<{ success: boolean }>(`/pagares/${row.id}/status`, { estado: next });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el pagaré.');
    }
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Registro de Pagarés', 14, 16);
    doc.setFontSize(9);
    let y = 26;
    doc.text('Tomo | Nombre | Cedula | Monto | Estado | Cobrador', 14, y);
    y += 6;
    filtered.forEach((p) => {
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

      {/* Contadores exactos (activos / cancelados / disponibles / asignados) */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Total</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{resumen?.total ?? pagares.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-emerald-700">Activos</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{resumen?.activos ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-rose-700">Cancelados</p>
          <p className="mt-1 text-2xl font-bold text-rose-700">{resumen?.cancelados ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Disponibles (libres)</p>
          <p className="mt-1 text-2xl font-bold text-teal-700">{resumen?.disponibles ?? disponibles}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Asignados</p>
          <p className="mt-1 text-2xl font-bold text-slate-700">{resumen?.asignados ?? 0}</p>
        </div>
      </div>

      {resumen && resumen.porTomo.length > 0 && (
        <div className="mb-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Detalle por tomo</p>
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase text-slate-500">
              <tr>
                <th className="px-2 py-1.5">Tomo</th>
                <th className="px-2 py-1.5 text-right">Total</th>
                <th className="px-2 py-1.5 text-right">Activos</th>
                <th className="px-2 py-1.5 text-right">Cancelados</th>
                <th className="px-2 py-1.5 text-right">Libres</th>
              </tr>
            </thead>
            <tbody>
              {resumen.porTomo.map((t) => (
                <tr key={t.tomo} className="border-t border-slate-100">
                  <td className="px-2 py-1.5 font-medium text-slate-700">{t.tomo}</td>
                  <td className="px-2 py-1.5 text-right">{t.total}</td>
                  <td className="px-2 py-1.5 text-right text-emerald-700">{t.activos}</td>
                  <td className="px-2 py-1.5 text-right text-rose-700">{t.cancelados}</td>
                  <td className="px-2 py-1.5 text-right text-teal-700">{t.disponibles}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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

      {/* Buscador */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Buscar por nombre, cédula, tomo, cobrador o monto…"
          className="min-w-[240px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-teal-400"
        />
        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value as '' | 'activo' | 'cancelado')}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
        >
          <option value="">Estado: todos</option>
          <option value="activo">Activos</option>
          <option value="cancelado">Cancelados</option>
        </select>
        <select
          value={tomoFiltro}
          onChange={(e) => setTomoFiltro(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
        >
          <option value="">Tomo: todos</option>
          {tomos.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={cobradorFiltro}
          onChange={(e) => setCobradorFiltro(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
        >
          <option value="">Cobrador: todos</option>
          <option value="__none__">Sin asignar</option>
          {collectors.map((c) => (
            <option key={c.uid} value={c.name}>{c.name}</option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          Mostrando {filtered.length} de {pagares.length}
        </span>
        {(query || estadoFiltro || tomoFiltro || cobradorFiltro) && (
          <button
            onClick={() => {
              setQuery('');
              setEstadoFiltro('');
              setTomoFiltro('');
              setCobradorFiltro('');
            }}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
          >
            Limpiar
          </button>
        )}
      </div>

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
            {filtered.map((p) => (
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
                <td className="px-3 py-1.5">
                  <select
                    value={p.cobrador || ''}
                    onChange={(e) => void assign(p, e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-teal-400"
                  >
                    <option value="">— Sin asignar —</option>
                    {p.cobrador && !collectors.some((c) => c.name === p.cobrador) && (
                      <option value={p.cobrador}>{p.cobrador}</option>
                    )}
                    {collectors.map((c) => (
                      <option key={c.uid} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <button onClick={() => void toggle(p)} className="text-xs text-blue-600 underline">
                    {p.estado === 'activo' ? 'Entregar' : 'Devolver'}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                  No se encontraron pagarés para la búsqueda
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
