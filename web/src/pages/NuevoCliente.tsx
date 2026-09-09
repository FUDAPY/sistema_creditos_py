import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, apiPost } from '../lib/api';

interface Collector { uid: string; name: string; role?: string; }
interface Ref { name: string; relationship: string; phone: string; workplace: string; }

export default function NuevoCliente() {
  const { user } = useAuth();
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const [f, setF] = useState({
    fullName: '', documentId: '', phone: '', email: '', collectorId: '',
    birthDate: '', nationality: '', address: '', city: '', neighborhood: '',
    housingType: 'PROPIA',
    workplaceName: '', position: '', department: '', seniority: '', workPhone: '',
    employmentStatus: 'EMPLEADO', workplaceAddress: '', workplaceCity: '', workplaceNeighborhood: '',
    lat: '', lng: '', googleMapsUrl: '',
  });
  const [refs, setRefs] = useState<Ref[]>([
    { name: '', relationship: '', phone: '', workplace: '' },
    { name: '', relationship: '', phone: '', workplace: '' },
    { name: '', relationship: '', phone: '', workplace: '' },
  ]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      api<Collector[]>('/users?activeOnly=true')
        .then((rows) => setCollectors(rows.filter((r) => r.role === 'COLLECTOR')))
        .catch(() => undefined);
    }
  }, [user]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));
  const setRef = (i: number, k: keyof Ref) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setRefs((list) => list.map((r, idx) => (idx === i ? { ...r, [k]: e.target.value } : r)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (refs.some((r) => !r.name.trim() || !r.relationship.trim() || !r.phone.trim())) {
      setError('Las 3 referencias personales son obligatorias.');
      return;
    }
    const collector = collectors.find((c) => c.uid === f.collectorId) || (user?.role === 'COLLECTOR' ? { uid: user.uid, name: user.name } : undefined);
    setBusy(true);
    try {
      await apiPost('/clients', {
        fullName: f.fullName,
        documentId: f.documentId,
        phone: f.phone,
        email: f.email || undefined,
        collectorId: collector?.uid,
        collectorName: collector?.name,
        birthDate: f.birthDate || undefined,
        nationality: f.nationality || undefined,
        address: f.address,
        city: f.city,
        neighborhood: f.neighborhood || undefined,
        housingType: f.housingType,
        workplaceName: f.workplaceName,
        position: f.position || undefined,
        department: f.department || undefined,
        seniority: f.seniority || undefined,
        workPhone: f.workPhone,
        employmentStatus: f.employmentStatus,
        workplaceAddress: f.workplaceAddress || undefined,
        workplaceCity: f.workplaceCity || undefined,
        workplaceNeighborhood: f.workplaceNeighborhood || undefined,
        references: refs,
        location: {
          latitude: Number(f.lat) || undefined,
          longitude: Number(f.lng) || undefined,
          googleMapsUrl: f.googleMapsUrl || undefined,
        },
      });
      setInfo('Cliente registrado correctamente.');
      setF({ fullName: '', documentId: '', phone: '', email: '', collectorId: '', birthDate: '', nationality: '', address: '', city: '', neighborhood: '', housingType: 'PROPIA', workplaceName: '', position: '', department: '', seniority: '', workPhone: '', employmentStatus: 'EMPLEADO', workplaceAddress: '', workplaceCity: '', workplaceNeighborhood: '', lat: '', lng: '', googleMapsUrl: '' });
      setRefs(refs.map(() => ({ name: '', relationship: '', phone: '', workplace: '' })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar el cliente.');
    } finally {
      setBusy(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
  const label = 'mb-1 block text-sm font-medium text-slate-700';
  const section = 'space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
  const grid = 'grid grid-cols-1 gap-3 sm:grid-cols-2';
  const title = 'text-sm font-semibold uppercase tracking-wide text-teal-700';
  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Registrar Nuevo Cliente</h2>
          <p className="text-sm text-slate-500">Disponible para Admin y Cobrador</p>
        </div>
        {info && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{info}</div>}
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <form onSubmit={submit} className="space-y-5">
          {/* 1. Datos Personales */}
          <section className={section}>
            <h3 className={title}>1. Datos Personales</h3>
            <div className={grid}>
              <div className="sm:col-span-2">
                <label className={label}>Nombre Completo *</label>
                <input required value={f.fullName} onChange={set('fullName')} className={inputCls} />
              </div>
              <div>
                <label className={label}>C.I. / Documento *</label>
                <input required value={f.documentId} onChange={set('documentId')} className={inputCls} />
              </div>
              <div>
                <label className={label}>Teléfono *</label>
                <input required value={f.phone} onChange={set('phone')} className={inputCls} />
              </div>
              <div>
                <label className={label}>Email</label>
                <input type="email" value={f.email} onChange={set('email')} className={inputCls} />
              </div>
              <div>
                <label className={label}>Cobrador Asignado *</label>
                {user?.role === 'ADMIN' ? (
                  <select required value={f.collectorId} onChange={set('collectorId')} className={inputCls}>
                    <option value="">Selecciona una opción</option>
                    {collectors.map((c) => (
                      <option key={c.uid} value={c.uid}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <input disabled value={user?.name || ''} className={`${inputCls} bg-slate-100`} />
                )}
              </div>
              <div>
                <label className={label}>Fecha de Nacimiento</label>
                <input type="date" value={f.birthDate} onChange={set('birthDate')} className={inputCls} />
              </div>
              <div>
                <label className={label}>Nacionalidad</label>
                <input value={f.nationality} onChange={set('nationality')} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Dirección *</label>
                <input required value={f.address} onChange={set('address')} className={inputCls} />
              </div>
              <div>
                <label className={label}>Ciudad *</label>
                <input required value={f.city} onChange={set('city')} className={inputCls} />
              </div>
              <div>
                <label className={label}>Barrio/Zona</label>
                <input value={f.neighborhood} onChange={set('neighborhood')} className={inputCls} />
              </div>
              <div>
                <label className={label}>Tipo de Vivienda *</label>
                <select required value={f.housingType} onChange={set('housingType')} className={inputCls}>
                  <option value="PROPIA">Propia</option>
                  <option value="ALQUILADA">Alquilada</option>
                  <option value="FAMILIAR">Familiar</option>
                </select>
              </div>
            </div>
          </section>
          {/* 2. Datos Laborales */}
          <section className={section}>
            <h3 className={title}>2. Datos Laborales</h3>
            <div className={grid}>
              <div className="sm:col-span-2">
                <label className={label}>Empresa *</label>
                <input required placeholder="Buscar o crear empresa" value={f.workplaceName} onChange={set('workplaceName')} className={inputCls} />
              </div>
              <div>
                <label className={label}>Cargo *</label>
                <input required value={f.position} onChange={set('position')} className={inputCls} />
              </div>
              <div>
                <label className={label}>Departamento</label>
                <input value={f.department} onChange={set('department')} className={inputCls} />
              </div>
              <div>
                <label className={label}>Antigüedad (Ej: 5 años) *</label>
                <input required placeholder="5 años" value={f.seniority} onChange={set('seniority')} className={inputCls} />
              </div>
              <div>
                <label className={label}>Teléfono Laboral *</label>
                <input required value={f.workPhone} onChange={set('workPhone')} className={inputCls} />
              </div>
              <div>
                <label className={label}>Situación Laboral *</label>
                <select required value={f.employmentStatus} onChange={set('employmentStatus')} className={inputCls}>
                  <option value="EMPLEADO">Empleado</option>
                  <option value="PROPIETARIO">Propietario</option>
                  <option value="INDEPENDIENTE">Independiente</option>
                </select>
              </div>
              <div>
                <label className={label}>Dirección Laboral</label>
                <input value={f.workplaceAddress} onChange={set('workplaceAddress')} className={inputCls} />
              </div>
              <div>
                <label className={label}>Ciudad Laboral</label>
                <input value={f.workplaceCity} onChange={set('workplaceCity')} className={inputCls} />
              </div>
              <div>
                <label className={label}>Barrio Laboral</label>
                <input value={f.workplaceNeighborhood} onChange={set('workplaceNeighborhood')} className={inputCls} />
              </div>
            </div>
          </section>
          {/* 3. Referencias Personales (3 requeridas) */}
          <section className={section}>
            <h3 className={title}>3. Referencias Personales (3 requeridas)</h3>
            {refs.map((r, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Referencia {i + 1}</p>
                <div className={grid}>
                  <div>
                    <label className={label}>Nombre *</label>
                    <input required placeholder="Nombre Completo" value={r.name} onChange={setRef(i, 'name')} className={inputCls} />
                  </div>
                  <div>
                    <label className={label}>Relación *</label>
                    <input required placeholder="Ej: Amigo, Familiar" value={r.relationship} onChange={setRef(i, 'relationship')} className={inputCls} />
                  </div>
                  <div>
                    <label className={label}>Teléfono *</label>
                    <input required value={r.phone} onChange={setRef(i, 'phone')} className={inputCls} />
                  </div>
                  <div>
                    <label className={label}>Lugar de Trabajo</label>
                    <input placeholder="Empresa o lugar" value={r.workplace} onChange={setRef(i, 'workplace')} className={inputCls} />
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* 4. Ubicación del Cliente */}
          <section className={section}>
            <h3 className={title}>4. Ubicación del Cliente</h3>
            <div className={grid}>
              <div>
                <label className={label}>Latitud</label>
                <input type="number" step="any" value={f.lat} onChange={set('lat')} className={inputCls} />
              </div>
              <div>
                <label className={label}>Longitud</label>
                <input type="number" step="any" value={f.lng} onChange={set('lng')} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Link Google Maps</label>
                <input placeholder="https://maps.google.com/…" value={f.googleMapsUrl} onChange={set('googleMapsUrl')} className={inputCls} />
              </div>
            </div>
          </section>

          <button disabled={busy} className="w-full rounded-lg bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
            {busy ? 'Guardando…' : 'Registrar cliente'}
          </button>
        </form>
      </div>
    </div>
  );
}
