import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/login/Login';
import Register from './pages/register/Register';
import ForgotPassword from './pages/forgot-password/ForgotPassword';
import Dashboard from './pages/dashboard/Dashboard';
import Calendar from './pages/calendar/Calendar';
import Passengers from './pages/passengers/Passengers';
import Translation from './pages/translation/Translation';
import Analytics from './pages/analytics/Analytics';
import Roles from './pages/roles/Roles';
import SessionMonitor from './pages/session-monitor/SessionMonitor';
import CostControl from './pages/cost-control/CostControl';
import WhiteLabel from './pages/white-label/WhiteLabel';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { i18n } = useTranslation();

  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>
      <Route
        element={
          <PrivateRoute>
            <DashboardLayout />
          </PrivateRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/passengers" element={<Passengers />} />
        <Route path="/translation" element={<Translation />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/roles" element={<Roles />} />
        <Route path="/sessions" element={<SessionMonitor />} />
        <Route path="/cost-control" element={<CostControl />} />
        <Route path="/white-label" element={<WhiteLabel />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
