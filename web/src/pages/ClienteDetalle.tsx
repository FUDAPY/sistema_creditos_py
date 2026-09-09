import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';

interface Client {
  id: string;
  fullName?: string;
  documentId?: string;
  phone?: string;
  email?: string;
  collectorName?: string;
  birthDate?: string;
  nationality?: string;
  address?: string;
  city?: string;
  neighborhood?: string;
  housingType?: string;
  workplaceName?: string;
  position?: string;
  department?: string;
  seniority?: string;
  workPhone?: string;
  employmentStatus?: string;
  references?: Array<{ name: string; relationship: string; workplace: string; phone: string }>;
  location?: { latitude?: number; longitude?: number; googleMapsUrl?: string };
}
interface LoanRow { id: string; loanType?: string; principal: number; currentBalance: number; totalAmount: number; status?: string; }

const fmt = (v: number) => Math.round(v).toLocaleString('es-PY');
const STATUS: Record<string, string> = { ACTIVE: 'Activo', FROZEN: 'Congelado', PAID: 'Pagado', ANULADO: 'Anulado' };

export default function ClienteDetalle() {
  const { id = '' } = useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Client>(`/clients/${id}`)
      .then(setClient)
      .catch((e) => setError(e.message));
    api<LoanRow[]>(`/loans?clientId=${id}`)
      .then(setLoans)
      .catch(() => undefined);
  }, [id]);

  if (error) return <div className="p-6 text-sm text-rose-600">{error}</div>;
  if (!client) return <div className="p-6 text-sm text-slate-500">Cargando…</div>;

  const field = (label: string, value?: string) =>
    value ? (
      <p className="text-sm text-slate-600">
        <span className="text-slate-400">{label}: </span>
        {value}
      </p>
    ) : null;

  return (
    <div className="p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <Link to="/cartera" className="text-sm text-teal-600">← Volver</Link>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{client.fullName}</h2>
          <p className="text-sm text-slate-500">{client.collectorName || 'Sin cobrador'}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold uppercase text-teal-700">Datos Personales</h3>
            {field('C.I.', client.documentId)}
            {field('Teléfono', client.phone)}
            {field('Email', client.email)}
            {field('Nacimiento', client.birthDate)}
            {field('Nacionalidad', client.nationality)}
            {field('Dirección', client.address)}
            {field('Ciudad', client.city)}
            {field('Barrio', client.neighborhood)}
            {field('Vivienda', client.housingType)}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold uppercase text-teal-700">Datos Laborales</h3>
            {field('Empresa', client.workplaceName)}
            {field('Cargo', client.position)}
            {field('Departamento', client.department)}
            {field('Antigüedad', client.seniority)}
            {field('Tel. laboral', client.workPhone)}
            {field('Situación', client.employmentStatus)}
          </section>
        </div>

        {(client.references?.length ?? 0) > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold uppercase text-teal-700">Referencias</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {client.references!.map((r, i) => (
                <div key={i} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  <p className="font-medium text-slate-800">{r.name}</p>
                  <p>{r.relationship} · {r.phone}</p>
                  {r.workplace && <p className="text-xs text-slate-400">{r.workplace}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {client.location?.googleMapsUrl && (
          <a href={client.location.googleMapsUrl} target="_blank" rel="noreferrer" className="inline-block text-sm text-teal-600">
            Ver ubicación en Google Maps →
          </a>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
            Créditos ({loans.length})
          </div>
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Capital</th>
                <th className="px-4 py-3 text-right">Saldo</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 text-slate-600">{l.loanType || '-'}</td>
                  <td className="px-4 py-2.5 text-right">{fmt(l.principal || 0)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{fmt(l.currentBalance || 0)}</td>
                  <td className="px-4 py-2.5 text-right">{fmt(l.totalAmount || 0)}</td>
                  <td className="px-4 py-2.5">{STATUS[l.status || ''] || l.status}</td>
                </tr>
              ))}
              {loans.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">Sin créditos</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
