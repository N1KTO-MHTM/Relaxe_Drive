import { Routes, Route, Navigate } from 'react-router-dom';
import ControlMode from './modes/ControlMode';
import LiveWallMode from './modes/LiveWallMode';
import SystemHealthMode from './modes/SystemHealthMode';
import LogsAuditMode from './modes/LogsAuditMode';
import AboutMode from './modes/AboutMode';
import AdminMode from './modes/AdminMode';
import ClientsMode from './modes/ClientsMode';
import DriversMode from './modes/DriversMode';
import CalendarMode from './modes/CalendarMode';
import PendingsMode from './modes/PendingsMode';
import TranslationMode from './modes/TranslationMode';
import AnalyticsMode from './modes/AnalyticsMode';
import CostControlMode from './modes/CostControlMode';
import WhiteLabelMode from './modes/WhiteLabelMode';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import { useAuthStore } from './store/auth';
import { canAccessDesktopPath, getDefaultPathForRole } from './config/roles';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Access only by role: if current path is not allowed for user role, redirect to first allowed path. */
function RoleProtectedRoute({ path, children }: { path: string; children: React.ReactNode }) {
  const role = useAuthStore((s) => s.user?.role ?? null);
  if (!canAccessDesktopPath(role, path)) {
    return <Navigate to={getDefaultPathForRole(role)} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route
        path="/control"
        element={
          <PrivateRoute>
            <RoleProtectedRoute path="/control">
              <ControlMode />
            </RoleProtectedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/wall"
        element={
          <PrivateRoute>
            <RoleProtectedRoute path="/wall">
              <LiveWallMode />
            </RoleProtectedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/health"
        element={
          <PrivateRoute>
            <RoleProtectedRoute path="/health">
              <SystemHealthMode />
            </RoleProtectedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/logs"
        element={
          <PrivateRoute>
            <RoleProtectedRoute path="/logs">
              <LogsAuditMode />
            </RoleProtectedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <PrivateRoute>
            <RoleProtectedRoute path="/admin">
              <AdminMode />
            </RoleProtectedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/clients"
        element={
          <PrivateRoute>
            <RoleProtectedRoute path="/clients">
              <ClientsMode />
            </RoleProtectedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/drivers"
        element={
          <PrivateRoute>
            <RoleProtectedRoute path="/drivers">
              <DriversMode />
            </RoleProtectedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <PrivateRoute>
            <RoleProtectedRoute path="/calendar">
              <CalendarMode />
            </RoleProtectedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/pendings"
        element={
          <PrivateRoute>
            <RoleProtectedRoute path="/pendings">
              <PendingsMode />
            </RoleProtectedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/translation"
        element={
          <PrivateRoute>
            <RoleProtectedRoute path="/translation">
              <TranslationMode />
            </RoleProtectedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <PrivateRoute>
            <RoleProtectedRoute path="/analytics">
              <AnalyticsMode />
            </RoleProtectedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/cost-control"
        element={
          <PrivateRoute>
            <RoleProtectedRoute path="/cost-control">
              <CostControlMode />
            </RoleProtectedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/white-label"
        element={
          <PrivateRoute>
            <RoleProtectedRoute path="/white-label">
              <WhiteLabelMode />
            </RoleProtectedRoute>
          </PrivateRoute>
        }
      />
      <Route
        path="/about"
        element={
          <PrivateRoute>
            <RoleProtectedRoute path="/about">
              <AboutMode />
            </RoleProtectedRoute>
          </PrivateRoute>
        }
      />
      <Route path="/" element={<Navigate to="/control" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
