import api from './api';

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const listPhotos = () => api.get('/photos');

export const uploadPhoto = (token, dataUrl, name) => api.post('/photos', { data: dataUrl, name }, auth(token));

export const deletePhoto = (token, id) => api.delete(`/photos/${id}`, auth(token));
