import { Outlet } from 'react-router-dom';
import './AuthLayout.css';

export default function AuthLayout() {
  return (
    <div className="auth-layout">
      <div className="auth-layout__center rd-premium-panel">
        <Outlet />
      </div>
      <div className="auth-layout__version">
        v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.0'}
      </div>
    </div>
  );
}
