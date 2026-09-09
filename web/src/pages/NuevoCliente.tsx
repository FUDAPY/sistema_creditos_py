import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiPost } from '../lib/api';

export default function NuevoCliente() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    fullName: '',
    documentId: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    neighborhood: '',
    housingType: 'PROPIA',
    employmentStatus: 'EMPLEADO',
    workplaceName: '',
  });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await apiPost('/clients', {
        ...form,
        email: form.email || undefined,
        collectorId: user?.role === 'COLLECTOR' ? user.uid : undefined,
        collectorName: user?.role === 'COLLECTOR' ? user.name : undefined,
      });
      setInfo('Cliente registrado correctamente.');
      setForm({ fullName: '', documentId: '', phone: '', email: '', address: '', city: '', neighborhood: '', housingType: 'PROPIA', employmentStatus: 'EMPLEADO', workplaceName: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar el cliente.');
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
  const labelCls = 'mb-1 block text-sm font-medium text-slate-700';

  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-xl font-semibold text-slate-900">Nuevo Cliente</h2>
        <p className="mb-4 text-sm text-slate-500">Disponible para Admin y Cobrador</p>
        {info && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div>}
        {error && <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <form onSubmit={submit} className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Nombre completo *</label>
            <input required value={form.fullName} onChange={set('fullName')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Cédula *</label>
            <input required value={form.documentId} onChange={set('documentId')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Teléfono *</label>
            <input required value={form.phone} onChange={set('phone')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={form.email} onChange={set('email')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Ciudad *</label>
            <input required value={form.city} onChange={set('city')} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Dirección *</label>
            <input required value={form.address} onChange={set('address')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Barrio</label>
            <input value={form.neighborhood} onChange={set('neighborhood')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Vivienda</label>
            <select value={form.housingType} onChange={set('housingType')} className={inputCls}>
              <option value="PROPIA">Propia</option>
              <option value="ALQUILADA">Alquilada</option>
              <option value="FAMILIAR">Familiar</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Ocupación</label>
            <select value={form.employmentStatus} onChange={set('employmentStatus')} className={inputCls}>
              <option value="EMPLEADO">Empleado</option>
              <option value="PROPIETARIO">Propietario</option>
              <option value="INDEPENDIENTE">Independiente</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Lugar de trabajo</label>
            <input value={form.workplaceName} onChange={set('workplaceName')} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <button disabled={busy} className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
              {busy ? 'Guardando…' : 'Registrar cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
