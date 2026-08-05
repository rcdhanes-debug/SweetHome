import api from './api';

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const listNotifications = () => api.get('/notifications');
export const createNotification = (token, payload) => api.post('/notifications', payload, auth(token));
export const markRead = (id) => api.patch(`/notifications/${id}/read`, {});
export const markAllRead = () => api.patch('/notifications/read-all', {});
export const dismiss = (id) => api.delete(`/notifications/${id}`);
export const clearAll = () => api.delete('/notifications/all');
