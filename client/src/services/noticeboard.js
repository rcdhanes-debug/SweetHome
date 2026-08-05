import api from './api';

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const getBoard = () => api.get('/noticeboard');

export const addShopping = (text) => api.post('/noticeboard/shopping', { text });
export const toggleShopping = (id, checked) => api.patch(`/noticeboard/shopping/${id}`, { checked });
export const editShopping = (id, text) => api.patch(`/noticeboard/shopping/${id}`, { text });
export const deleteShopping = (id) => api.delete(`/noticeboard/shopping/${id}`);

export const addFix = (title, description) => api.post('/noticeboard/fixes', { title, description });
export const setFix = (id, resolved) => api.patch(`/noticeboard/fixes/${id}`, { resolved });
export const deleteFix = (id) => api.delete(`/noticeboard/fixes/${id}`);

export const addGuest = (token, data) => api.post('/noticeboard/guests', data, auth(token));
export const deleteGuest = (token, id) => api.delete(`/noticeboard/guests/${id}`, auth(token));

export const createResolution = (token, title, options) =>
  api.post('/noticeboard/resolutions', { title, options }, auth(token));
export const voteResolution = (token, id, option) =>
  api.post(`/noticeboard/resolutions/${id}/vote`, { option }, auth(token));
export const closeResolution = (token, id) => api.patch(`/noticeboard/resolutions/${id}/close`, {}, auth(token));
export const reopenResolution = (token, id) => api.patch(`/noticeboard/resolutions/${id}/reopen`, {}, auth(token));
export const deleteResolution = (token, id) => api.delete(`/noticeboard/resolutions/${id}`, auth(token));
