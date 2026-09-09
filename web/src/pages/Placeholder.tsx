import { useAuth } from '../context/AuthContext';

interface Props {
  title: string;
  description?: string;
}

/** Página puente para módulos cuya pantalla profunda se construye en la siguiente iteración. */
export default function Placeholder({ title, description }: Props) {
  const { user } = useAuth();
  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {description || 'Módulo en construcción · conectado a la BD.'}
        </p>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">
            Sesión: <span className="font-medium text-slate-700">{user?.name}</span> (
            {user?.role === 'ADMIN' ? 'Administrador' : 'Cobrador'})
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Este módulo respeta la matriz de roles definida en <code>src/lib/rbac.ts</code> y consume los
            endpoints de <code>/api/v1</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
