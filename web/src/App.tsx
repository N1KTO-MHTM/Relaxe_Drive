import { lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';

const Login = lazy(() => import('./pages/login/Login'));
const Register = lazy(() => import('./pages/register/Register'));
const ForgotPassword = lazy(() => import('./pages/forgot-password/ForgotPassword'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Calendar = lazy(() => import('./pages/calendar/Calendar'));
const Passengers = lazy(() => import('./pages/passengers/Passengers'));
const Drivers = lazy(() => import('./pages/drivers/Drivers'));
const Translation = lazy(() => import('./pages/translation/Translation'));
const Analytics = lazy(() => import('./pages/analytics/Analytics'));
const Roles = lazy(() => import('./pages/roles/Roles'));
const Pendings = lazy(() => import('./pages/pendings/Pendings'));
const SessionMonitor = lazy(() => import('./pages/session-monitor/SessionMonitor'));
const CostControl = lazy(() => import('./pages/cost-control/CostControl'));
const WhiteLabel = lazy(() => import('./pages/white-label/WhiteLabel'));
const Audit = lazy(() => import('./pages/audit/Audit'));
const Health = lazy(() => import('./pages/health/Health'));
const About = lazy(() => import('./pages/about/About'));
const LiveWall = lazy(() => import('./pages/live-wall/LiveWall'));
const PhoneBase = lazy(() => import('./pages/phone-base/PhoneBase'));
const Addresses = lazy(() => import('./pages/addresses/Addresses'));
const DriverReports = lazy(() => import('./pages/reports/DriverReports'));
const Chat = lazy(() => import('./pages/chat/ChatPage'));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  useTranslation();

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
        <Route path="/wall" element={<LiveWall />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/clients" element={<Passengers />} />
        <Route path="/addresses" element={<Addresses />} />
        <Route path="/drivers" element={<Drivers />} />
        <Route path="/translation" element={<Translation />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/roles" element={<Roles />} />
        <Route path="/pendings" element={<Pendings />} />
        <Route path="/sessions" element={<SessionMonitor />} />
        <Route path="/cost-control" element={<CostControl />} />
        <Route path="/white-label" element={<WhiteLabel />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/health" element={<Health />} />
        <Route path="/about" element={<About />} />
        <Route path="/phone-base" element={<PhoneBase />} />
        <Route path="/driver-reports" element={<DriverReports />} />
        <Route path="/chat" element={<Chat />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
