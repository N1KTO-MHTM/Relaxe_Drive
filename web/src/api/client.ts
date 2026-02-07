export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const BASE = API_BASE_URL;

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

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' });
  } catch (err) {
    const isNetwork = err instanceof TypeError && (err.message === 'Failed to fetch' || (err as Error).message?.includes('fetch'));
    if (isNetwork && (options.method === undefined || (options.method as string).toUpperCase() === 'GET')) {
      await new Promise((r) => setTimeout(r, 1000));
      res = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' });
    } else {
      throw err;
    }
  }
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
    const isRetryable = res.status >= 500 || res.status === 408;
    if (isRetryable && (options.method === undefined || (options.method as string).toUpperCase() === 'GET')) {
      await new Promise((r) => setTimeout(r, 1000));
      const retryRes = await fetch(`${BASE}${path}`, { ...options, headers, credentials: 'include' });
      if (!retryRes.ok) {
        const retryText = await retryRes.text().catch(() => '');
        let retryMsg = retryRes.statusText;
        try {
          const body = retryText ? JSON.parse(retryText) : null;
          if (body?.message) retryMsg = Array.isArray(body.message) ? body.message[0] : body.message;
        } catch {
          if (retryText) retryMsg = retryText;
        }
        throw new Error(retryMsg);
      }
      const retryText = await retryRes.text().catch(() => '');
      if (!retryText || retryText.trim() === '') return null as T;
      try {
        return JSON.parse(retryText) as T;
      } catch {
        throw new Error('Invalid JSON in response');
      }
    }
    throw new Error(message);
  }
  const text = await res.text().catch(() => '');
  if (!text || text.trim() === '') return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Invalid JSON in response');
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
