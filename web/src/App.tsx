import { lazy } from 'react';
// i18n: local ./i18n (not react-i18next)
import { useTranslation } from './i18n';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import NewVersionPrompt from './components/NewVersionPrompt';

const Login = lazy(() => import('./pages/login/Login'));
const Register = lazy(() => import('./pages/register/Register'));
const ForgotPassword = lazy(() => import('./pages/forgot-password/ForgotPassword'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Calendar = lazy(() => import('./pages/calendar/Calendar'));
const Drivers = lazy(() => import('./pages/drivers/Drivers'));
const Translation = lazy(() => import('./pages/translation/Translation'));
const Roles = lazy(() => import('./pages/roles/Roles'));
const Pendings = lazy(() => import('./pages/pendings/Pendings'));
const About = lazy(() => import('./pages/about/About'));
const MyProfile = lazy(() => import('./pages/my-profile/MyProfile'));
const LiveWall = lazy(() => import('./pages/live-wall/LiveWall'));
const DriverReports = lazy(() => import('./pages/reports/DriverReports'));
const Chat = lazy(() => import('./pages/chat/ChatPage'));
const Statements = lazy(() => import('./pages/statements/Statements'));
const Support = lazy(() => import('./pages/support/Support'));
const Addresses = lazy(() => import('./pages/addresses/Addresses'));
const PhoneBase = lazy(() => import('./pages/phone-base/PhoneBase'));
const PassengerRoutes = lazy(() => import('./pages/passenger-routes/PassengerRoutes'));

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  useTranslation();

  return (
    <>
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
        <Route path="/drivers" element={<Drivers />} />
        <Route path="/translation" element={<Translation />} />
        <Route path="/roles" element={<Roles />} />
        <Route path="/pendings" element={<Pendings />} />
        <Route path="/about" element={<About />} />
        <Route path="/my-profile" element={<MyProfile />} />
        <Route path="/driver-reports" element={<DriverReports />} />
        <Route path="/support" element={<Support />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/statements" element={<Statements />} />
        <Route path="/addresses" element={<Addresses />} />
        <Route path="/phone-base" element={<PhoneBase />} />
        <Route path="/passenger-routes" element={<PassengerRoutes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <NewVersionPrompt />
    </>
  );
}
