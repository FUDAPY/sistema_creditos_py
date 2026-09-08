import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-gray-500">Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
