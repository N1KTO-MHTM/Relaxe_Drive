const BASE = import.meta.env.VITE_API_URL || '/api';

function isDebug(): boolean {
  return import.meta.env.DEV || typeof localStorage !== 'undefined' && localStorage.getItem('relaxdrive_debug') === '1';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  if (isDebug()) console.debug('[RelaxDrive API]', method, path);
  const token = localStorage.getItem('relaxdrive-access-token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' });
  if (res.status === 401) {
    const isAuthRequest = path === '/auth/login' || path === '/auth/register' || path === '/auth/forgot-password';
    if (isAuthRequest) {
      const text = await res.text().catch(() => 'Unauthorized');
      let message = 'Invalid credentials';
      try {
        const body = text ? JSON.parse(text) : null;
        if (body?.message) message = Array.isArray(body.message) ? body.message[0] : body.message;
      } catch {
        if (text && text.length < 120) message = text;
      }
      throw new Error(message);
    }
    const refresh = localStorage.getItem('relaxdrive-refresh-token');
    if (refresh) {
      const refreshRes = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
        credentials: 'include',
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        localStorage.setItem('relaxdrive-access-token', data.accessToken);
        return request(path, options);
      }
    }
    localStorage.removeItem('relaxdrive-access-token');
    localStorage.removeItem('relaxdrive-refresh-token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (isDebug()) console.debug('[RelaxDrive API]', method, path, res.status);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = res.statusText;
    try {
      const body = text ? JSON.parse(text) : null;
      if (body?.message) message = Array.isArray(body.message) ? body.message[0] : body.message;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
