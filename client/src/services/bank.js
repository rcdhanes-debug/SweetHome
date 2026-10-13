import api from './api';

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const getBankBalance = () => api.get('/bank/balance');

export const getBankTransactions = (limit = 50) =>
  api.get('/bank/transactions', { params: { limit } });

export const syncBankBalance = () => api.post('/bank/sync');

export const getWebhookInfo = () => api.get('/bank/webhook-info');

export const simulateSms = (data) => api.post('/bank/simulate-sms', data);

export const updateManualBalance = (token, data) =>
  api.patch('/bank/manual', data, auth(token));
