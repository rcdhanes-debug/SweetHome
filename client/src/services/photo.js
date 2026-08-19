import api from './api';

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const listPhotos = (folder) => api.get('/photos', { params: { folder } });

export const uploadPhoto = (token, dataUrl, name, folder, caption) =>
  api.post('/photos', { data: dataUrl, name, folder, caption }, auth(token));

export const deletePhoto = (token, id) => api.delete(`/photos/${id}`, auth(token));

export const listFolders = () => api.get('/photos/folders');

export const createFolder = (token, name, color, description) =>
  api.post('/photos/folders', { name, color, description }, auth(token));

export const deleteFolder = (token, name) => api.delete(`/photos/folders/${encodeURIComponent(name)}`, auth(token));

export const listDriveLinks = () => api.get('/photos/drive-links');

export const createDriveLink = (token, title, url, description) =>
  api.post('/photos/drive-links', { title, url, description }, auth(token));

export const deleteDriveLink = (token, id) => api.delete(`/photos/drive-links/${id}`, auth(token));
