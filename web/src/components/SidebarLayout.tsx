import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NAV_SECTIONS, canAccess, type NavItem, type NavSection, type Role } from '../lib/rbac';

function Dot({ ok }: { ok: boolean }) {
  return (
    <span className="relative flex h-2 w-2">
      {ok && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${ok ? 'bg-teal-500' : 'bg-rose-500'}`} />
    </span>
  );
}

function ItemLink({ item, role }: { item: NavItem; role: Role | undefined }) {
  if (!canAccess(role, item.roles)) return null;
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
        }`
      }
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {item.label}
    </NavLink>
  );
}

export default function SidebarLayout() {
  const { user, logout } = useAuth();
  const role = user?.role as Role | undefined;
  const [dbUp, setDbUp] = useState<boolean | null>(null);
  const [sync, setSync] = useState(0);
  const [empresasOpen, setEmpresasOpen] = useState(() => localStorage.getItem('syscreditos_sidebar_empresas') !== '0');

  useEffect(() => {
    localStorage.setItem('syscreditos_sidebar_empresas', empresasOpen ? '1' : '0');
  }, [empresasOpen]);

  useEffect(() => {
    const ping = () => {
      fetch('/api/v1/health', { headers: { Accept: 'application/json' } })
        .then((r) => r.json())
        .then((body: { mongo?: string }) => setDbUp(body.mongo === 'up'))
        .catch(() => setDbUp(false));
    };
    ping();
    const id = window.setInterval(ping, 15000);
    const tick = window.setInterval(() => setSync((s) => s + 1), 1000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(tick);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-100 px-5 py-5">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Sys<span className="text-teal-600">Creditos</span>
          </h1>
          <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <Dot ok={dbUp !== false} />
            {dbUp === null ? 'Verificando BD…' : dbUp ? 'BD conectada' : 'BD sin conexión'}
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.filter((s) => canAccess(role, s.roles)).map((section) => (
            <div key={section.title} className="mb-5">
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) =>
                  item.children ? (
                    <div key={item.path}>
                      <button
                        onClick={() => setEmpresasOpen((o) => !o)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-slate-400" />
                          {item.label}
                        </span>
                        <span
                          className={`text-xs text-slate-400 transition-transform duration-300 ${empresasOpen ? 'rotate-90' : ''}`}
                        >
                          ›
                        </span>
                      </button>
                      <div
                        className={`grid transition-all duration-300 ease-in-out ${
                          empresasOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="ml-3 space-y-0.5 border-l border-slate-200 py-1 pl-2">
                            {item.children.map((child) => (
                              <ItemLink key={child.path} item={child} role={role} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <ItemLink key={item.path} item={item} role={role} />
                  ),
                )}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-100 px-5 py-4">
          <p className="text-sm font-medium text-slate-700">{user?.name || 'Usuario'}</p>
          <p className="mb-2 text-xs text-slate-400">{role === 'ADMIN' ? 'Administrador' : 'Cobrador'}</p>
          <button onClick={logout} className="text-sm font-medium text-rose-600 hover:text-rose-700">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="md:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="font-semibold text-slate-900">SysCreditos</span>
            <button onClick={logout} className="text-sm text-rose-600">
              Salir
            </button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
