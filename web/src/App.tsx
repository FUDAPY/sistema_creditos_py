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
          <Route path="/clientes/nuevo" element={<Placeholder title="Nuevo Cliente" description="Formulario de registro (Admin y Cobrador)." />} />
          <Route path="/cartera/clasificacion" element={<Placeholder title="Clasificación de Cartera" description="Bueno · Inforconf · Prejudicial · Judicial." />} />

          {/* ADMINISTRACIÓN (solo ADMIN por RBAC) */}
          <Route path="/admin/aprobar-creditos" element={<Placeholder title="Aprobar Créditos" description="Bandeja de autorización de créditos pendientes." />} />
          <Route path="/admin/aprobar-rendicion" element={<AprobarRendicion />} />
          <Route path="/admin/recaudo" element={<Placeholder title="Recaudo" description="Cobros por cobrador y administrador · comisiones 5% / 10%." />} />

          {/* USUARIOS */}
          <Route path="/admin/usuarios" element={<Placeholder title="Gestión de Usuarios" description="Crear, resetear contraseña y revocar acceso (sin borrar historial)." />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}

