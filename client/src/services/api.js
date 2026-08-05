import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' }
});

export function resolveMediaUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const apiBase = import.meta.env.VITE_API_URL || '/api';
  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    try {
      const origin = new URL(apiBase).origin;
      return `${origin}${path.startsWith('/') ? '' : '/'}${path}`;
    } catch (_) {}
  }
  return path;
}

api.interceptors.request.use((config) => {
  if (config.headers.Authorization) return config;
  const raw = localStorage.getItem('homehq_session');
  if (raw) {
    try {
      const { token } = JSON.parse(raw);
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (_) {
      localStorage.removeItem('homehq_session');
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.message || err.message || 'Something went wrong.';
    const status = err.response?.status;
    return Promise.reject(Object.assign(new Error(message), { status }));
  }
);

export default api;
