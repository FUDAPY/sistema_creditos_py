import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, apiPatch, apiPost } from '../lib/api';

interface UserRow {
  id: string;
  uid: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'COLLECTOR';
  isActive: boolean;
}

export default function GestionUsuarios() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'COLLECTOR' as 'ADMIN' | 'COLLECTOR' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<UserRow[]>('/users')
      .then(setUsers)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setBusy(true);
    try {
      await apiPost<UserRow>('/users', form);
      setMsg(`Usuario ${form.email} creado.`);
      setForm({ name: '', email: '', password: '', role: 'COLLECTOR' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear usuario.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (u: UserRow) => {
    try {
      await apiPatch(`/users/${u.uid}`, { isActive: !u.isActive });
      setMsg(u.isActive ? `Acceso revocado para ${u.email} (historial intacto).` : `Acceso habilitado para ${u.email}.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar usuario.');
    }
  };

  const resetPassword = async (u: UserRow) => {
    const pwd = window.prompt(`Nueva contraseña para ${u.email}:`)?.trim();
    if (!pwd || pwd.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    try {
      await apiPost(`/users/${u.uid}/password`, { password: pwd });
      setMsg('Contraseña actualizada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar contraseña.');
    }
  };

  const inputCls = 'rounded-lg border border-slate-300 px-3 py-2 text-sm';
  return (
    <div className="p-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-xl font-semibold text-slate-900">Gestión de Usuarios</h2>
        <p className="mb-4 text-sm text-slate-500">Al revocar el acceso nunca se borran los cobros ni créditos históricos del usuario.</p>

        <form onSubmit={create} className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4">
          <input placeholder="Nombre" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} required />
          <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} required />
          <input placeholder="Contraseña" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={inputCls} required minLength={6} />
          <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'ADMIN' | 'COLLECTOR' }))} className={inputCls}>
            <option value="COLLECTOR">Cobrador</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button disabled={busy} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60 sm:col-span-4">
            {busy ? 'Creando…' : 'Crear usuario'}
          </button>
        </form>

        {msg && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</div>}
        {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{u.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{u.email}</td>
                  <td className="px-4 py-2.5 text-slate-600">{u.role}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                      {u.isActive ? 'Activo' : 'Revocado'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => void resetPassword(u)} className="mr-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-teal-300">
                      Resetear clave
                    </button>
                    <button
                      onClick={() => void toggle(u)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white ${u.isActive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                    >
                      {u.isActive ? 'Revocar acceso' : 'Habilitar'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Sin usuarios</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
