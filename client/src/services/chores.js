import api from './api';

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const listChores = () => api.get('/chores');
export const getToday = () => api.get('/chores/today');

export const updateDay = (token, day, data) => api.patch(`/chores/${day}`, data, auth(token));
export const swap = (token, day, personA, personB) =>
  api.post('/chores/swap', { day, personA, personB }, auth(token));
export const restoreDefault = (token) => api.post('/chores/restore-default', {}, auth(token));
