import api from './api';

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

export const listRedeems = () => api.get('/redeem');
export const createRedeem = (token, data) => api.post('/redeem', data, auth(token));
export const closeRedeem = (closedByName, id) => api.patch(`/redeem/${id}/close`, { closedByName });
export const reopenRedeem = (token, id) => api.patch(`/redeem/${id}/reopen`, {}, auth(token));
export const deleteRedeem = (token, id) => api.delete(`/redeem/${id}`, auth(token));
