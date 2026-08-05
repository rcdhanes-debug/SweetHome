import api from './api';

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const listEvents = (start, end) =>
  api.get('/events', { params: start || end ? { start, end } : undefined });

export const createEvent = (token, payload) => api.post('/events', payload, auth(token));
export const updateEvent = (token, id, payload) => api.patch(`/events/${id}`, payload, auth(token));
export const deleteEvent = (token, id) => api.delete(`/events/${id}`, auth(token));
