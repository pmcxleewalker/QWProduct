import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Vehicle/Car API (tenant-scoped)
export const carAPI = {
  getAll: () => axios.get(`${API}/vehicles`),
  getById: (id) => axios.get(`${API}/vehicles/${id}`),
  create: (data) => axios.post(`${API}/vehicles`, data),
  update: (id, data) => axios.put(`${API}/vehicles/${id}`, data),
  delete: (id) => axios.delete(`${API}/vehicles/${id}`),
  getQRCode: (id) => `${API}/vehicles/${id}/qr`,
  getAvailability: (id, date, view = 'day') => axios.get(`${API}/vehicles/${id}/availability`, {
    params: { date, view }
  }),
  // Block / unblock for appointment (service, cleaning, repair) — backend
  // expects { reason, notes? } on block and { sign_off_notes? } on unblock.
  block: (id, data) => axios.post(`${API}/vehicles/${id}/block`, data),
  unblock: (id, data) => axios.post(`${API}/vehicles/${id}/unblock`, data),
};

// Booking API (tenant-scoped)
export const bookingAPI = {
  getAll: () => axios.get(`${API}/bookings`),
  getById: (id) => axios.get(`${API}/bookings/${id}`),
  create: (data) => axios.post(`${API}/bookings`, data),
  update: (id, data) => axios.put(`${API}/bookings/${id}`, data),
  delete: (id) => axios.delete(`${API}/bookings/${id}`),
  approve: (id) => axios.post(`${API}/bookings/${id}/approve`),
  reject: (id, reason = '') => axios.post(`${API}/bookings/${id}/reject`, null, { params: { reason } }),
  getSuggestions: () => Promise.resolve({ data: [] }), // Booking suggestions - placeholder
  getPending: () => axios.get(`${API}/bookings/pending`).catch(() => ({ data: [] })), // Pending bookings
  // Return cars that have no overlapping booking in the requested window.
  // Used by the EditBookingModal "Swap Car" flow. Implemented client-side
  // because the backend doesn't (yet) expose a dedicated availability search
  // endpoint — we just intersect /vehicles with /bookings?from=&to=.
  getAvailableCars: async (startISO, endISO, excludeBookingId = null) => {
    const [carsRes, bookingsRes] = await Promise.all([
      axios.get(`${API}/vehicles`),
      axios.get(`${API}/bookings`, { params: { from: startISO, to: endISO } }),
    ]);
    const cars = carsRes.data || [];
    const conflictingCarIds = new Set(
      (bookingsRes.data || [])
        .filter(b =>
          b.id !== excludeBookingId &&
          !['rejected', 'cancelled'].includes(b.status) &&
          b.start_time < endISO && b.end_time > startISO
        )
        .map(b => b.car_id)
    );
    const free = cars.filter(c => !conflictingCarIds.has(c.id) && !c.is_blocked);
    return { data: free };
  },
};

// Provider API (tenant-scoped)
export const providerAPI = {
  getAll: () => axios.get(`${API}/providers`).catch(() => ({ data: [] })),
  create: (data) => axios.post(`${API}/providers`, data),
  delete: (id) => axios.delete(`${API}/providers/${id}`),
};

// Message API (tenant-scoped)
export const messageAPI = {
  getAll: () => axios.get(`${API}/messages`).catch(() => ({ data: [] })),
  create: (data) => axios.post(`${API}/messages`, data),
  acknowledge: (id) => axios.post(`${API}/messages/${id}/acknowledge`),
};

// Todo API (tenant-scoped)
export const todoAPI = {
  getAll: () => axios.get(`${API}/todos`).catch(() => ({ data: [] })),
  create: (data) => axios.post(`${API}/todos`, data),
  complete: (id) => axios.put(`${API}/todos/${id}/complete`),
  delete: (id) => axios.delete(`${API}/todos/${id}`),
};

// Lift Request API (tenant-scoped)
export const liftRequestAPI = {
  getAll: () => axios.get(`${API}/lift-requests`),
  create: (data) => axios.post(`${API}/lift-requests`, data),
  getCount: () => axios.get(`${API}/lift-requests`).then(r => ({ data: { count: r.data?.length || 0 } })),
  getActive: () => axios.get(`${API}/lift-requests/active`),
  accept: (requestId, message) => axios.post(`${API}/lift-requests/${requestId}/accept`, null, { params: { message } }),
  dismiss: (requestId) => axios.post(`${API}/lift-requests/${requestId}/dismiss`),
};

// Reports API (tenant-scoped)
export const reportsAPI = {
  getSummary: () => axios.get(`${API}/reports/summary`),
};

// Plan API (tenant-scoped)
export const planAPI = {
  getMyPlan: () => axios.get(`${API}/my-plan`),
};

// Tenant Settings API (tenant-scoped)
export const settingsAPI = {
  get: () => axios.get(`${API}/tenant/settings`),
  update: (data) => axios.put(`${API}/tenant/settings`, data),
};

// Tenant User API (tenant admin)
export const userAPI = {
  getAll: () => axios.get(`${API}/tenant/users`),
  create: (data, role = 'staff') => axios.post(`${API}/tenant/users`, data, { params: { role } }),
  updateRole: (userId, role) => axios.put(`${API}/tenant/users/${userId}/role`, null, { params: { role } }),
  remove: (userId) => axios.delete(`${API}/tenant/users/${userId}`),
  resetPassword: (userId, adminPassword, newPassword) => 
    axios.post(`${API}/tenant/users/${userId}/reset-password`, { admin_password: adminPassword, new_password: newPassword }),
};

// Platform API (super/master admin only)
export const platformAPI = {
  // Tenants
  getTenants: (status) => axios.get(`${API}/platform/tenants`, { params: status ? { status } : {} }),
  getTenant: (id) => axios.get(`${API}/platform/tenants/${id}`),
  createTenant: (data) => axios.post(`${API}/platform/tenants`, data),
  updateTenant: (id, data) => axios.put(`${API}/platform/tenants/${id}`, data),
  suspendTenant: (id) => axios.post(`${API}/platform/tenants/${id}/suspend`),
  reactivateTenant: (id) => axios.post(`${API}/platform/tenants/${id}/reactivate`),
  impersonateTenant: (id) => axios.post(`${API}/platform/tenants/${id}/impersonate`),
  stopImpersonation: () => axios.post(`${API}/platform/stop-impersonation`),
  
  // Users
  getUsers: (tenantId) => axios.get(`${API}/platform/users`, { params: tenantId ? { tenant_id: tenantId } : {} }),
  createUser: (data, role, tenantId) => axios.post(`${API}/platform/users`, data, { params: { role, tenant_id: tenantId } }),
  
  // Stats & Audit
  getStats: () => axios.get(`${API}/platform/stats`),
  getAuditLog: (tenantId, action, limit) => axios.get(`${API}/platform/audit-log`, { params: { tenant_id: tenantId, action, limit } }),
  
  // Plans & Features
  getPlans: () => axios.get(`${API}/platform/plans`),
  getTenantFeatures: (tenantId) => axios.get(`${API}/platform/tenants/${tenantId}/features`),
  updateTenantFeatures: (tenantId, features) => axios.put(`${API}/platform/tenants/${tenantId}/features`, features),
  updateTenantPlan: (tenantId, plan) => axios.put(`${API}/platform/tenants/${tenantId}/plan`, null, { params: { new_plan: plan } }),
  useCustomization: (tenantId, description) => axios.post(`${API}/platform/tenants/${tenantId}/use-customization`, null, { params: { description } }),
  resetCustomizations: (tenantId) => axios.post(`${API}/platform/tenants/${tenantId}/reset-customizations`),
};

// Auth API
export const authAPI = {
  login: (email, password) => axios.post(`${API}/auth/login`, { email, password }),
  selectTenant: (tenantId) => axios.post(`${API}/auth/select-tenant`, { tenant_id: tenantId }),
  getMe: () => axios.get(`${API}/auth/me`),
};

// Compatibility aliases for existing components
export const assistanceAPI = providerAPI;
export const complianceAPI = { getAlerts: () => Promise.resolve({ data: [] }) };
export const statusAPI = { 
  getLive: () => axios.get(`${API}/vehicles`),
  getWeather: () => axios.get(`${API}/weather`).catch(() => ({ data: null }))
};
export const pushAPI = {
  getVapidKey: () => axios.get(`${API}/push/vapid-public-key`).catch(() => ({ data: { key: null } })),
  subscribe: () => Promise.resolve(),
  unsubscribe: () => Promise.resolve(),
};
export const liftNotificationAPI = {
  get: () => Promise.resolve({ data: [] }),
  getCount: () => Promise.resolve({ data: { count: 0 } }),
  markRead: () => Promise.resolve(),
};
export const bookingNotificationAPI = {
  get: () => Promise.resolve({ data: [] }),
  markRead: () => Promise.resolve(),
};
export const bookingLocationsAPI = {
  getLocationsForDate: (date, carId) => axios.get(`${API}/bookings/locations`, { params: { date, car_id: carId } }).catch(() => ({ data: { pins: [] } })),
};

export default { 
  carAPI, bookingAPI, providerAPI, messageAPI, todoAPI, liftRequestAPI, 
  reportsAPI, planAPI, settingsAPI, userAPI, platformAPI, authAPI, assistanceAPI, complianceAPI, 
  statusAPI, pushAPI, liftNotificationAPI, bookingNotificationAPI, bookingLocationsAPI
};
