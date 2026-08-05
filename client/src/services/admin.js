import api from './api';

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const auditLogs = (token, limit = 100) =>
  api.get('/admin/audit-logs', { params: { limit }, ...auth(token) });

export const getTelegramConfig = (token) => api.get('/admin/telegram', auth(token));
export const updateTelegramConfig = (token, data) => api.post('/admin/telegram', data, auth(token));
export const sendTelegramTest = (token, data) => api.post('/admin/telegram/test', data, auth(token));
export const sendTomorrowChoresTest = (token) => api.post('/admin/telegram/chores-test', {}, auth(token));
export const sendRemainingMoneyTest = (token) => api.post('/admin/telegram/balance-test', {}, auth(token));
