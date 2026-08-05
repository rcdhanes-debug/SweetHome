import api from './api';

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const listExpenses = (month) => api.get('/expenses', { params: { month } });
export const currentMonth = () => api.get('/expenses/current-month');

export const create = (token, data) => api.post('/expenses', data, auth(token));
export const update = (token, id, data) => api.patch(`/expenses/${id}`, data, auth(token));
export const remove = (token, id) => api.delete(`/expenses/${id}`, auth(token));
