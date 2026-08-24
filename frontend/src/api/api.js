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
  // Fleet Board: record where a vehicle was dropped off. Accepts either an
  // Eircode ("V92 H6TP") or a free-text location label — both may be blank
  // to clear the current location.
  setDropOff: (id, data) => axios.post(`${API}/vehicles/${id}/drop-off`, data),
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
  getPending: () => axios.get(`${API}/bookings/pending-approval`).catch(() => ({ data: [] })), // Pending approval bookings
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

  // Fleet usage report — main "Total Vehicles / Total Bookings / Pending /
  // Blocked + Most Booked" card grid on the Admin > Reports tab.
  // The backend response uses `most_booked_cars` / `blocked_cars` /
  // `bookings` (per-car), but the UI was written against `most_booked` /
  // `blocked_vehicles` / `total_bookings`. We normalize here so neither side
  // needs to change.
  getFleetUsage: async (startDate, endDate) => {
    const params = {};
    if (startDate) params.from_date = startDate;
    if (endDate) params.to_date = endDate;
    const res = await axios.get(`${API}/tenant/fleet-reports`, { params });
    const d = res.data || {};
    const normalized = {
      ...d,
      summary: {
        total_vehicles: d.summary?.total_vehicles ?? 0,
        total_bookings: d.summary?.total_bookings ?? 0,
        pending_bookings: d.summary?.pending_bookings ?? 0,
        blocked_vehicles: d.summary?.blocked_cars ?? d.summary?.blocked_vehicles ?? 0,
      },
      most_booked: (d.most_booked_cars || []).map((c) => ({
        id: c.id,
        car_name: c.name,
        registration: c.registration,
        total_bookings: c.bookings ?? 0,
      })),
    };
    return { ...res, data: normalized };
  },

  // CSV export of the fleet report. Used by handleExportReport() in Admin.js
  // — it does its own fetch() so we just need a URL string here.
  exportCSV: () => `${API}/tenant/fleet-reports/csv`,

  // Charts / detail / daily-availability breakdowns. There is no dedicated
  // backend route for these, so we compute them from the canonical
  // /vehicles + /bookings data. Every Reports sub-section therefore shows
  // real, accurate numbers rather than an empty/"no data" placeholder.
  getBookingCharts: async (startDate = null, endDate = null) => {
    const params = {};
    if (startDate) params.from = startDate;
    if (endDate) params.to = endDate;
    const [vehiclesRes, bookingsRes] = await Promise.all([
      axios.get(`${API}/vehicles`),
      axios.get(`${API}/bookings`, { params }),
    ]);
    const carName = {};
    (vehiclesRes.data || []).forEach((v) => { carName[v.id] = v.name || v.registration || 'Vehicle'; });
    const bookings = (bookingsRes.data || []).filter((b) => b.status !== 'cancelled');
    const total_bookings = bookings.length;
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const jsDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const statusCounts = {}, dayCounts = {}, userCounts = {}, carCounts = {};
    dayOrder.forEach((d) => { dayCounts[d] = 0; });
    let doubleUp = 0, recurring = 0;
    bookings.forEach((b) => {
      const st = b.status || 'approved';
      statusCounts[st] = (statusCounts[st] || 0) + 1;
      if (b.is_double_up_call) doubleUp += 1;
      if (b.is_recurring || b.recurring_group_id) recurring += 1;
      const d = new Date(b.start_time);
      if (!isNaN(d.getTime())) dayCounts[jsDay[d.getDay()]] += 1;
      const u = b.user_name || 'Unknown';
      userCounts[u] = (userCounts[u] || 0) + 1;
      const c = carName[b.car_id] || 'Unassigned';
      carCounts[c] = (carCounts[c] || 0) + 1;
    });
    return { data: {
      total_bookings,
      by_status: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
      double_up_calls: { double_up: doubleUp, single: total_bookings - doubleUp },
      recurring_vs_onetime: { recurring, one_time: total_bookings - recurring },
      by_day_of_week: dayOrder.map((day) => ({ day, count: dayCounts[day] })),
      by_user: Object.entries(userCounts).map(([user, count]) => ({ user, count })).sort((a, b) => b.count - a.count),
      by_car: Object.entries(carCounts).map(([car, count]) => ({ car, count })).sort((a, b) => b.count - a.count),
    } };
  },

  getCarsWithoutBookings: async (date = null) => {
    const day = date || new Date().toISOString().slice(0, 10);
    const [vehiclesRes, bookingsRes] = await Promise.all([
      axios.get(`${API}/vehicles`),
      axios.get(`${API}/bookings`, { params: { from: day, to: day } }),
    ]);
    const vehicles = vehiclesRes.data || [];
    const bookings = (bookingsRes.data || []).filter((b) => !['cancelled', 'rejected'].includes(b.status));
    const WIN_START = 8 * 60, WIN_END = 18 * 60, WIN = WIN_END - WIN_START;
    const hourLabel = (h) => { const p = h >= 12 ? 'pm' : 'am'; const hh = h % 12 === 0 ? 12 : h % 12; return `${hh}${p}`; };
    const hours = []; for (let h = 8; h < 18; h++) hours.push(h);
    const time_slots = {}; hours.forEach((h) => { time_slots[hourLabel(h)] = { free: 0, total: vehicles.length }; });
    const all_cars = [], cars_by_location = {}, location_summaries = {};
    let total_available = 0, total_partially_free = 0, total_fully_booked = 0;
    vehicles.forEach((v) => {
      const segs = bookings.filter((b) => b.car_id === v.id).map((b) => {
        const s = new Date(b.start_time), e = new Date(b.end_time);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
        return [Math.max(WIN_START, s.getHours() * 60 + s.getMinutes()), Math.min(WIN_END, e.getHours() * 60 + e.getMinutes())];
      }).filter((seg) => seg && seg[1] > seg[0]).sort((a, b) => a[0] - b[0]);
      let coveredMin = 0, cursor = WIN_START;
      segs.forEach(([s, e]) => { const start = Math.max(s, cursor); if (e > start) { coveredMin += (e - start); cursor = Math.max(cursor, e); } });
      const free_minutes = Math.max(0, WIN - coveredMin);
      const free_hours = Math.round((free_minutes / 60) * 10) / 10;
      const is_fully_free = coveredMin === 0 && !v.is_blocked;
      const utilization_percent = Math.round((coveredMin / WIN) * 100);
      if (is_fully_free) total_available += 1;
      else if (free_minutes === 0) total_fully_booked += 1;
      else total_partially_free += 1;
      hours.forEach((h) => {
        const hs = h * 60, he = (h + 1) * 60;
        const busy = segs.some(([s, e]) => s < he && e > hs);
        if (!busy && !v.is_blocked) time_slots[hourLabel(h)].free += 1;
      });
      const loc = v.base_location || 'Unassigned';
      const carObj = { id: v.id, name: v.name, registration: v.registration, location: loc, free_hours, free_minutes, is_fully_free, utilization_percent, total_bookings: segs.length };
      all_cars.push(carObj);
      (cars_by_location[loc] = cars_by_location[loc] || []).push(carObj);
      const ls = (location_summaries[loc] = location_summaries[loc] || { total_cars: 0, fully_free: 0, partially_free: 0, fully_booked: 0, _util: 0 });
      ls.total_cars += 1;
      if (is_fully_free) ls.fully_free += 1; else if (free_minutes === 0) ls.fully_booked += 1; else ls.partially_free += 1;
      ls._util += utilization_percent;
    });
    Object.values(location_summaries).forEach((ls) => { ls.avg_utilization = ls.total_cars ? Math.round(ls._util / ls.total_cars) : 0; delete ls._util; });
    return { data: { date: day, total_cars: vehicles.length, total_available, total_partially_free, total_fully_booked, all_cars, cars_by_location, location_summaries, time_slots } };
  },

  getBookingsDetail: async (startDate = null, endDate = null) => {
    const params = {};
    if (startDate) params.from = startDate;
    if (endDate) params.to = endDate;
    const [vehiclesRes, bookingsRes] = await Promise.all([
      axios.get(`${API}/vehicles`),
      axios.get(`${API}/bookings`, { params }),
    ]);
    const vmap = {};
    (vehiclesRes.data || []).forEach((v) => { vmap[v.id] = { name: v.name, reg: v.registration }; });
    const raw = (bookingsRes.data || []).filter((b) => b.status !== 'cancelled');
    raw.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
    const bookings = raw.map((b) => ({
      id: b.id,
      vehicle_name: vmap[b.car_id]?.name || 'Vehicle',
      vehicle_registration: vmap[b.car_id]?.reg || '',
      booked_by: b.user_name || '',
      start_time: b.start_time,
      end_time: b.end_time,
      location: b.location || '',
      purpose: b.purpose || '',
      status: b.status || 'approved',
      is_double_up_call: !!b.is_double_up_call,
      is_recurring: !!(b.is_recurring || b.recurring_group_id),
    }));
    return { data: { bookings, total_records: bookings.length, double_up_calls: bookings.filter((b) => b.is_double_up_call).length } };
  },

  clearBookings: async (startDate, endDate) => {
    const res = await axios.get(`${API}/bookings`, { params: { from: startDate, to: endDate } });
    const ids = (res.data || []).map((b) => b.id);
    const results = await Promise.allSettled(ids.map((id) => axios.delete(`${API}/bookings/${id}`)));
    const deleted = results.filter((r) => r.status === 'fulfilled').length;
    return { data: { message: `Deleted ${deleted} booking${deleted === 1 ? '' : 's'} between ${startDate} and ${endDate}.` } };
  },
};

// Plan API (tenant-scoped)
export const planAPI = {
  getMyPlan: () => axios.get(`${API}/my-plan`),
};

// Tenant Settings API (tenant-scoped)
export const settingsAPI = {
  get: () => axios.get(`${API}/tenant/settings`),
  update: (data) => axios.put(`${API}/tenant/settings`, data),
  updateGps: (data) => axios.put(`${API}/tenant/settings/gps`, data),
};

// Tenant User API (tenant admin)
export const userAPI = {
  getAll: () => axios.get(`${API}/tenant/users`),
  create: (data, role = 'staff') => axios.post(`${API}/tenant/users`, data, { params: { role } }),
  updateRole: (userId, role) => axios.put(`${API}/tenant/users/${userId}/role`, null, { params: { role } }),
  updateProfile: (userId, data) => axios.patch(`${API}/tenant/users/${userId}`, data),
  setActive: (userId, isActive) =>
    axios.post(`${API}/tenant/users/${userId}/set-active`, { is_active: !!isActive }),
  remove: (userId) => axios.delete(`${API}/tenant/users/${userId}`),
  // Aliases kept for legacy callers (Admin.js was using these names).
  delete: (userId) => axios.delete(`${API}/tenant/users/${userId}`),
  deleteAdmin: (userId) => axios.delete(`${API}/tenant/users/${userId}`),
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

// Demo (magic-link) API — used by the platform admin console to list,
// revoke, and regenerate per-tenant magic-link demo URLs.
export const demoAPI = {
  list:   () => axios.get(`${API}/platform/demo-tokens`),
  revoke: (id) => axios.delete(`${API}/platform/demo-tokens/${id}`),
  regenerateForTenant: (tenantId, data = {}) => axios.post(`${API}/platform/tenants/${tenantId}/magic-link`, data),
  redeem: (token) => axios.post(`${API}/demo/redeem`, { token }),
};

// SinoTrack GPS Tracker (Phase 2 + 3)
export const trackerAPI = {
  listDevices: () => axios.get(`${API}/tracker/devices`),
  registerDevice: (data) => axios.post(`${API}/tracker/devices`, data),
  updateDevice: (id, data) => axios.patch(`${API}/tracker/devices/${id}`, data),
  deleteDevice: (id) => axios.delete(`${API}/tracker/devices/${id}`),
  listPositions: () => axios.get(`${API}/tracker/positions`),
  carPosition: (carId) => axios.get(`${API}/tracker/car/${carId}`),
  history: (carId, date) => axios.get(`${API}/tracker/history/${carId}`, { params: { date } }),
  seedDemoHistory: (carId, days = 3) => axios.post(`${API}/tracker/history/${carId}/seed-demo`, null, { params: { days } }),
  // Alerts (Phase 5)
  listAlerts: (acknowledged = false) => axios.get(`${API}/tracker/alerts`, { params: { acknowledged } }),
  alertsCount: () => axios.get(`${API}/tracker/alerts/count`),
  ackAlert: (id) => axios.post(`${API}/tracker/alerts/${id}/ack`),
  ackBulk: (type = null) => axios.post(`${API}/tracker/alerts/ack-bulk`, type ? { type } : {}),
  setGeofence: (carId, data) => axios.put(`${API}/vehicles/${carId}/geofence`, data),
  // Phase 6 — telemetry + behaviour
  telemetry: () => axios.get(`${API}/tracker/telemetry`),
  geocode: (lat, lon) => axios.get(`${API}/tracker/geocode`, { params: { lat, lon } }),
};

// Driver Behaviour Monitoring (Phase 6). NOT a scoring system — just an
// event feed with booking/staff linkage.
export const behaviourAPI = {
  listEvents: (filters = {}) => axios.get(`${API}/behaviour/events`, { params: filters }),
  summary: (windowDays = 7) => axios.get(`${API}/behaviour/summary`, { params: { window_days: windowDays } }),
};

export default { 
  carAPI, bookingAPI, providerAPI, messageAPI, todoAPI, liftRequestAPI, 
  reportsAPI, planAPI, settingsAPI, userAPI, platformAPI, authAPI, assistanceAPI, complianceAPI, 
  statusAPI, pushAPI, liftNotificationAPI, bookingNotificationAPI, bookingLocationsAPI, demoAPI
};
