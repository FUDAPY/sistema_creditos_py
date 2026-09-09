import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Fondo */}
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/fondo.jpg')" }} />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-teal-950/55 to-slate-900/75" />
      <div className="absolute inset-0 backdrop-blur-[2px]" />

      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-3xl border border-white/25 bg-white/95 p-7 shadow-2xl backdrop-blur-xl md:p-9"
      >
        <div className="mb-7 flex flex-col items-center text-center">
          <img
            src="/logo.jpg"
            alt="Chicolín Préstamos"
            className="mb-5 h-24 w-auto max-w-[240px] rounded-2xl object-contain drop-shadow-md"
          />
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-slate-500">Gestión de créditos y cobranzas</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            {error}
          </div>
        )}

        <label className="mb-1 block text-sm font-medium text-slate-600">Correo electrónico</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="usuario@chicolin.com"
          autoComplete="email"
          className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
        />

        <label className="mb-1 block text-sm font-medium text-slate-600">Contraseña</label>
        <div className="relative mb-4">
          <input
            type={showPass ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-12 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
          />
          <button
            type="button"
            onClick={() => setShowPass((s) => !s)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-teal-600"
            aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPass ? '🙈' : '👁'}
          </button>
        </div>

        <button
          disabled={busy}
          className="w-full rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 transition hover:from-teal-700 hover:to-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-500/20 disabled:opacity-60"
        >
          {busy ? 'Ingresando…' : 'Ingresar'}
        </button>

        <p className="mt-5 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Chicolín Préstamos · Acceso restringido
        </p>
      </form>
    </div>
  );
}
