import api from './api';

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const getCurrent = () => api.get('/funding/current');
export const getHistory = () => api.get('/funding/history');
export const getReport = (month) => api.get('/funding/report', { params: { month } });

export const pay = (token, userId, amount) => api.post(`/funding/${userId}/pay`, { amount }, auth(token));
export const setStatus = (token, userId, paid, paidAt) =>
  api.patch(`/funding/${userId}/status`, { paid, paidAt }, auth(token));
export const resetMonth = (token, month) => api.post('/funding/reset', { month }, auth(token));
export const setContributionAmount = (token, month, amount) =>
  api.post('/funding/settings', { month, amount }, auth(token));
export const setRolloverAmount = (token, month, amount, auto = false) =>
  api.post('/funding/rollover', { month, amount, auto }, auth(token));
export const updateCommonAccount = (token, data) =>
  api.patch('/funding/common-account', data, auth(token));

