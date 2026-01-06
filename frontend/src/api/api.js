import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Car API
export const carAPI = {
  getAll: () => axios.get(`${API}/cars`),
  getById: (id) => axios.get(`${API}/cars/${id}`),
  create: (data) => axios.post(`${API}/cars`, data),
  update: (id, data) => axios.put(`${API}/cars/${id}`, data),
  delete: (id) => axios.delete(`${API}/cars/${id}`),
  getQRCode: (id) => `${API}/cars/${id}/qr`,
  block: (id, data) => axios.post(`${API}/cars/${id}/block`, data),
  unblock: (id, data) => axios.post(`${API}/cars/${id}/unblock`, data),
};

// Compliance API
export const complianceAPI = {
  getAlerts: () => axios.get(`${API}/admin/compliance-alerts`),
};

// Status API
export const statusAPI = {
  create: (data) => axios.post(`${API}/status`, data),
  getLive: () => axios.get(`${API}/status/live`),
  getHistory: (carId, limit = 50) => axios.get(`${API}/status/history/${carId}?limit=${limit}`),
};

// Booking API
export const bookingAPI = {
  getAll: () => axios.get(`${API}/bookings`),
  getByCar: (carId) => axios.get(`${API}/bookings/car/${carId}`),
  create: (data) => axios.post(`${API}/bookings`, data),
  delete: (id) => axios.delete(`${API}/bookings/${id}`),
  getPending: () => axios.get(`${API}/admin/pending-bookings`),
  approve: (groupId) => axios.post(`${API}/admin/bookings/${groupId}/approve`),
  reject: (groupId, reason) => axios.post(`${API}/admin/bookings/${groupId}/reject`, { reason }),
  edit: (bookingId, data) => axios.put(`${API}/admin/bookings/${bookingId}`, data),
  editSeries: (recurrenceId, data) => axios.put(`${API}/admin/bookings/series/${recurrenceId}`, data),
};

// Booking Notifications API
export const bookingNotificationAPI = {
  get: () => axios.get(`${API}/booking-notifications`),
  markRead: (id) => axios.post(`${API}/booking-notifications/${id}/read`),
};

// Assistance API
export const assistanceAPI = {
  getAll: () => axios.get(`${API}/assistance`),
  getByRegion: (region) => axios.get(`${API}/assistance/${region}`),
  create: (data) => axios.post(`${API}/assistance`, data),
  update: (id, data) => axios.put(`${API}/assistance/${id}`, data),
  delete: (id) => axios.delete(`${API}/assistance/${id}`),
};

// User Management API
export const userAPI = {
  create: (data) => axios.post(`${API}/admin/users/create`, data),
  invite: (data) => axios.post(`${API}/admin/users/invite`, data),
  getAll: () => axios.get(`${API}/admin/users`),
  update: (id, data) => axios.put(`${API}/admin/users/${id}`, data),
  delete: (id) => axios.delete(`${API}/admin/users/${id}`),
  changePassword: (data) => axios.post(`${API}/auth/change-password`, data),
};

// Admin Messages API
export const messageAPI = {
  // Admin endpoints
  create: (data) => axios.post(`${API}/admin/messages`, data),
  getAll: () => axios.get(`${API}/admin/messages`),
  update: (id, data) => axios.put(`${API}/admin/messages/${id}`, data),
  delete: (id) => axios.delete(`${API}/admin/messages/${id}`),
  // Staff endpoints
  getUnacknowledged: () => axios.get(`${API}/messages/unacknowledged`),
  acknowledge: (id) => axios.post(`${API}/messages/${id}/acknowledge`),
};

// Lift Request API
export const liftRequestAPI = {
  create: (data) => axios.post(`${API}/lift-requests`, data),
  getActive: () => axios.get(`${API}/lift-requests`),
  getAll: () => axios.get(`${API}/lift-requests/all`),
  getCount: () => axios.get(`${API}/lift-requests/count`),
  accept: (id, message) => axios.post(`${API}/lift-requests/${id}/accept`, { message }),
  dismiss: (id) => axios.post(`${API}/lift-requests/${id}/dismiss`),
  delete: (id) => axios.delete(`${API}/lift-requests/${id}`),
};

// Lift Notifications API
export const liftNotificationAPI = {
  get: () => axios.get(`${API}/lift-notifications`),
  getCount: () => axios.get(`${API}/lift-notifications/count`),
  markRead: (id) => axios.post(`${API}/lift-notifications/${id}/read`),
};

// Admin To-Do List API
export const todoAPI = {
  getAll: () => axios.get(`${API}/admin/todos`),
  create: (data) => axios.post(`${API}/admin/todos`, data),
  update: (id, data) => axios.put(`${API}/admin/todos/${id}`, data),
  delete: (id) => axios.delete(`${API}/admin/todos/${id}`),
};

export default { carAPI, statusAPI, bookingAPI, assistanceAPI, userAPI, complianceAPI, messageAPI, liftRequestAPI, todoAPI };
