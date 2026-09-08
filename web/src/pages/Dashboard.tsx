import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between bg-white px-6 py-4 shadow">
        <h1 className="text-lg font-semibold text-slate-800">SysCreditos</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">
            {user?.name} · {user?.role === 'ADMIN' ? 'Administrador' : 'Cobrador'}
          </span>
          <button onClick={logout} className="text-sm text-red-600">
            Salir
          </button>
        </div>
      </header>
      <main className="p-6">
        <h2 className="mb-4 text-xl font-semibold">Panel principal</h2>
        <nav className="flex flex-wrap gap-3">
          <Link to="/loans" className="rounded bg-blue-600 px-4 py-2 text-white">
            Créditos
          </Link>
          <Link to="/loans/new" className="rounded bg-green-600 px-4 py-2 text-white">
            Nuevo crédito
          </Link>
          {user?.role === 'ADMIN' && (
            <Link to="/pagares" className="rounded bg-slate-700 px-4 py-2 text-white">
              Pagarés
            </Link>
          )}
          <Link to="/portfolio" className="rounded bg-blue-600 px-4 py-2 text-white">
            Cartera (Portafolio)
          </Link>
        </nav>
      </main>
    </div>
  );
}
