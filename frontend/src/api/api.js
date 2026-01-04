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
  invite: (data) => axios.post(`${API}/admin/users/invite`, data),
  getAll: () => axios.get(`${API}/admin/users`),
  update: (id, data) => axios.put(`${API}/admin/users/${id}`, data),
  delete: (id) => axios.delete(`${API}/admin/users/${id}`),
};

export default { carAPI, statusAPI, bookingAPI, assistanceAPI, userAPI };