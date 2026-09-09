import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import SidebarLayout from './components/SidebarLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Portfolio from './pages/Portfolio';
import LoansList from './pages/LoansList';
import LoanForm from './pages/LoanForm';
import Pagares from './pages/Pagares';
import CarteraActiva from './pages/CarteraActiva';
import PagoRapido from './pages/PagoRapido';
import AprobarRendicion from './pages/AprobarRendicion';
import Calendario from './pages/Calendario';
import Recaudo from './pages/Recaudo';
import AprobarCreditos from './pages/AprobarCreditos';
import ClasificacionCartera from './pages/ClasificacionCartera';
import NuevoCliente from './pages/NuevoCliente';
import GestionUsuarios from './pages/GestionUsuarios';
import Placeholder from './pages/Placeholder';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        {/* Dashboard conserva su layout propio rediseñado */}
        <Route path="/" element={<Dashboard />} />
        {/* Resto de la app bajo la sidebar fija con RBAC */}
        <Route element={<SidebarLayout />}>
          <Route path="/loans" element={<LoansList />} />
          <Route path="/loans/new" element={<LoanForm />} />
          <Route path="/pagares" element={<Pagares />} />
          <Route path="/portfolio" element={<Portfolio />} />

          {/* GENERAL */}
          <Route path="/pago-rapido" element={<PagoRapido />} />
          <Route path="/calendario" element={<Calendario />} />

          {/* COBROS / EMPRESAS */}
          <Route path="/cartera" element={<CarteraActiva />} />
          <Route path="/empresas/creditos" element={<Placeholder title="Empresas · Créditos" />} />
          <Route path="/empresas/alquileres" element={<Placeholder title="Empresas · Alquileres" />} />
          <Route path="/empresas/empenos" element={<Placeholder title="Empresas · Empeños" />} />
          <Route path="/empresas/prestacion" element={<Placeholder title="Empresas · Prestación de Servicios" />} />
          <Route path="/empresas/tragamonedas" element={<Placeholder title="Empresas · Tragamonedas" />} />
          <Route path="/empresas/pos" element={<Placeholder title="Empresas · POS" />} />
          <Route path="/empresas/juridico" element={<Placeholder title="Empresas · Jurídico" />} />

          {/* CLIENTES */}
          <Route path="/clientes/nuevo" element={<NuevoCliente />} />
          <Route path="/cartera/clasificacion" element={<ClasificacionCartera />} />

          {/* ADMINISTRACIÓN (solo ADMIN por RBAC) */}
          <Route path="/admin/aprobar-creditos" element={<AprobarCreditos />} />
          <Route path="/admin/aprobar-rendicion" element={<AprobarRendicion />} />
          <Route path="/admin/recaudo" element={<Recaudo />} />

          {/* USUARIOS */}
          <Route path="/admin/usuarios" element={<GestionUsuarios />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

