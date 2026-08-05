import api from './api';

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const verifyPin = (name, pin) => api.post('/auth/verify-pin', { name, pin });

export const listUsers = () => api.get('/users');
export const changeUserPin = (token, userId, newPin) =>
  api.patch(`/users/${userId}/pin`, { newPin }, auth(token));
export const updateUser = (token, userId, role) =>
  api.patch(`/users/${userId}`, { role }, auth(token));
export const setAway = (token, userId, away) =>
  api.patch(`/users/${userId}/away`, { away }, auth(token));
export const updateProfile = (token, userId, fields) =>
  api.patch(`/users/${userId}/profile`, fields, auth(token));
