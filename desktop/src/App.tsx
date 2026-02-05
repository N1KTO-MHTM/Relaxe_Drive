import { Routes, Route, Navigate } from 'react-router-dom';
import ControlMode from './modes/ControlMode';
import LiveWallMode from './modes/LiveWallMode';
import SystemHealthMode from './modes/SystemHealthMode';
import LogsAuditMode from './modes/LogsAuditMode';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import { useAuthStore } from './store/auth';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
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
            <ControlMode />
          </PrivateRoute>
        }
      />
      <Route
        path="/wall"
        element={
          <PrivateRoute>
            <LiveWallMode />
          </PrivateRoute>
        }
      />
      <Route
        path="/health"
        element={
          <PrivateRoute>
            <SystemHealthMode />
          </PrivateRoute>
        }
      />
      <Route
        path="/logs"
        element={
          <PrivateRoute>
            <LogsAuditMode />
          </PrivateRoute>
        }
      />
      <Route path="/" element={<Navigate to="/control" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
