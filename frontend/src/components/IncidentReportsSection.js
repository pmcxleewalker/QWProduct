/**
 * Incident Reports — admin dashboard + staff submission modal.
 *
 * This component renders differently based on props:
 *   - <IncidentReportsSection mode="admin" />   → full dashboard
 *   - <IncidentReportsSection mode="staff" />   → just a "Report Incident" button
 *
 * Staff submissions fire a dashboard notification for admins.
 */
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  AlertTriangle, Plus, Download, X, Trash2, Edit2, Check,
  Camera, Settings, Loader2, User, Car as CarIcon,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const INCIDENT_TYPES = ['Damage', 'Accident', 'Breakdown', 'Theft', 'Fuel', 'Near-miss', 'Other'];
const SEVERITY_COLORS = {
  minor: 'bg-amber-100 text-amber-800 border-amber-200',
  moderate: 'bg-orange-100 text-orange-800 border-orange-200',
  severe: 'bg-rose-100 text-rose-800 border-rose-200',
};
const STATUS_COLORS = {
  open: 'bg-rose-100 text-rose-700 border-rose-200',
  resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

/* ========== helpers ========== */

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const compressImage = async (file, maxSize = 1280, quality = 0.8) => {
  // Downscale client-side so we don't send 5 × 8MB blobs through the API
  const dataUrl = await fileToDataUrl(file);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

/* ========== Incident form modal (shared: staff + admin) ========== */

const IncidentFormModal = ({
  isOpen, onClose, onSaved, cars, users, formConfig, canChooseStaff, incident,
}) => {
  const isEdit = !!incident;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    car_id: '',
    staff_user_id: '',
    incident_date: new Date().toISOString().slice(0, 10),
    type: 'Damage',
    severity: 'minor',
    location: '',
    estimated_cost: '',
    police_report_number: '',
    insurance_claim_number: '',
    description: '',
    status: 'open',
    photos: [],
  });

  useEffect(() => {
    if (incident) {
      setForm({
        car_id: incident.car_id || '',
        staff_user_id: incident.staff_user_id || '',
        incident_date: (incident.incident_date || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
        type: incident.type || 'Damage',
        severity: incident.severity || 'minor',
        location: incident.location || '',
        estimated_cost: incident.estimated_cost || '',
        police_report_number: incident.police_report_number || '',
        insurance_claim_number: incident.insurance_claim_number || '',
        description: incident.description || '',
        status: incident.status || 'open',
        photos: incident.photos || [],
      });
    } else if (isOpen) {
      setForm({
        car_id: '', staff_user_id: '', incident_date: new Date().toISOString().slice(0, 10),
        type: 'Damage', severity: 'minor', location: '', estimated_cost: '',
        police_report_number: '', insurance_claim_number: '', description: '',
        status: 'open', photos: [],
      });
    }
  }, [incident, isOpen]);

  if (!isOpen) return null;

  const handlePhotos = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - form.photos.length);
    if (!files.length) return;
    const compressed = await Promise.all(files.map((f) => compressImage(f)));
    setForm((f) => ({ ...f, photos: [...f.photos, ...compressed].slice(0, 5) }));
  };

  const removePhoto = (i) => {
    setForm((f) => ({ ...f, photos: f.photos.filter((_, idx) => idx !== i) }));
  };

  const submit = async () => {
    if (!form.car_id) { toast.error('Please select a car'); return; }
    if (formConfig?.require_description && !form.description.trim()) {
      toast.error('Description is required'); return;
    }
    if (formConfig?.require_location && !form.location.trim()) {
      toast.error('Location is required'); return;
    }
    if (formConfig?.require_photos && !form.photos.length) {
      toast.error('At least one photo is required'); return;
    }

    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.estimated_cost) payload.estimated_cost = null;
      else payload.estimated_cost = parseFloat(payload.estimated_cost);
      if (!canChooseStaff) delete payload.staff_user_id; // staff can't reassign

      if (isEdit) {
        await axios.patch(`${API}/incidents/${incident.id}`, payload);
        toast.success('Incident updated');
      } else {
        await axios.post(`${API}/incidents`, payload);
        toast.success('Incident logged');
      }
      onSaved && onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save incident');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      data-testid="incident-form-modal"
      onClick={onClose}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? 'Edit Incident' : 'Log New Incident'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" aria-label="Close" data-testid="incident-form-close">
            <X size={20} className="text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Car */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Car *</label>
            <select
              value={form.car_id}
              onChange={(e) => setForm({ ...form, car_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              data-testid="incident-car-select"
            >
              <option value="">Select a car</option>
              {(cars || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.registration ? `(${c.registration})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Staff (admin only) */}
          {canChooseStaff && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Staff Member *</label>
              <select
                value={form.staff_user_id}
                onChange={(e) => setForm({ ...form, staff_user_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                data-testid="incident-staff-select"
              >
                <option value="">Select staff member</option>
                {(users || []).map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.email}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Incident Date *</label>
              <input
                type="date"
                value={form.incident_date}
                onChange={(e) => setForm({ ...form, incident_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                data-testid="incident-date-input"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Incident Type *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                data-testid="incident-type-select"
              >
                {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Severity *</label>
            <div className="flex gap-4">
              {['minor', 'moderate', 'severe'].map((s) => (
                <label key={s} className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="severity"
                    value={s}
                    checked={form.severity === s}
                    onChange={() => setForm({ ...form, severity: s })}
                    className="accent-blue-600"
                    data-testid={`severity-${s}`}
                  />
                  <span className={`capitalize font-medium ${s === 'minor' ? 'text-amber-600' : s === 'moderate' ? 'text-orange-600' : 'text-rose-600'}`}>
                    {s}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Status (admin edit only) */}
          {isEdit && canChooseStaff && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                data-testid="incident-status-select"
              >
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          )}

          {/* Optional fields — gated by formConfig for staff */}
          {formConfig?.show_location !== false && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Location {formConfig?.require_location ? '*' : ''}
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Where did the incident occur?"
                className="w-full px-3 py-2 border rounded-lg"
                data-testid="incident-location-input"
              />
            </div>
          )}

          {formConfig?.show_estimated_cost !== false && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Estimated Cost (€)</label>
              <input
                type="number"
                step="0.01"
                value={form.estimated_cost}
                onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border rounded-lg"
                data-testid="incident-cost-input"
              />
            </div>
          )}

          {(formConfig?.show_police_report !== false || formConfig?.show_insurance_claim !== false) && (
            <div className="grid grid-cols-2 gap-3">
              {formConfig?.show_police_report !== false && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Police Report #</label>
                  <input
                    type="text"
                    value={form.police_report_number}
                    onChange={(e) => setForm({ ...form, police_report_number: e.target.value })}
                    placeholder="If applicable"
                    className="w-full px-3 py-2 border rounded-lg"
                    data-testid="incident-police-input"
                  />
                </div>
              )}
              {formConfig?.show_insurance_claim !== false && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Insurance Claim #</label>
                  <input
                    type="text"
                    value={form.insurance_claim_number}
                    onChange={(e) => setForm({ ...form, insurance_claim_number: e.target.value })}
                    placeholder="If applicable"
                    className="w-full px-3 py-2 border rounded-lg"
                    data-testid="incident-insurance-input"
                  />
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Description {formConfig?.require_description ? '*' : ''}
            </label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe what happened..."
              className="w-full px-3 py-2 border rounded-lg resize-none"
              data-testid="incident-description-input"
            />
          </div>

          {/* Photos */}
          {formConfig?.show_photos !== false && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Photos {formConfig?.require_photos ? '*' : ''}
                <span className="text-slate-400 font-normal ml-1">({form.photos.length}/5)</span>
              </label>
              <div className="grid grid-cols-5 gap-2 mb-2">
                {form.photos.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200">
                    <img src={src} alt={`Incident ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-0.5 hover:bg-rose-700"
                      aria-label="Remove photo"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {form.photos.length < 5 && (
                  <label className="aspect-square rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 text-slate-500 hover:text-blue-600">
                    <Camera size={20} />
                    <span className="text-xs mt-1">Add</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotos}
                      className="hidden"
                      data-testid="incident-photos-input"
                    />
                  </label>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3 bg-slate-50">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg">Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            data-testid="incident-submit-btn"
            className="inline-flex items-center gap-2 px-5 py-2 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {isEdit ? 'Save Changes' : 'Log Incident'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ========== Form builder modal (admin) ========== */

const FormBuilderModal = ({ isOpen, onClose, config, onSaved }) => {
  const [form, setForm] = useState(config || {});
  useEffect(() => { if (isOpen) setForm(config || {}); }, [isOpen, config]);
  if (!isOpen) return null;

  const toggles = [
    ['show_location', 'Location field'],
    ['show_estimated_cost', 'Estimated cost field'],
    ['show_police_report', 'Police report number field'],
    ['show_insurance_claim', 'Insurance claim number field'],
    ['show_photos', 'Photo upload (up to 5)'],
    ['require_description', 'Description is required'],
    ['require_location', 'Location is required'],
    ['require_photos', 'At least one photo is required'],
  ];

  const save = async () => {
    try {
      await axios.put(`${API}/incidents/form-config`, form);
      toast.success('Form saved');
      onSaved && onSaved();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()} data-testid="form-builder-modal">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Customise Staff Incident Form</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-xs text-slate-500 mb-2">
            Toggle which fields staff see when submitting an incident from their app.
          </p>
          {toggles.map(([key, label]) => (
            <label key={key} className="flex items-center justify-between py-2 cursor-pointer">
              <span className="text-sm text-slate-700">{label}</span>
              <input
                type="checkbox"
                checked={!!form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                className="w-5 h-5 accent-blue-600 cursor-pointer"
                data-testid={`form-builder-${key}`}
              />
            </label>
          ))}
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg">Cancel</button>
          <button onClick={save} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700" data-testid="form-builder-save">Save</button>
        </div>
      </div>
    </div>
  );
};

/* ========== Main section ========== */

const IncidentReportsSection = ({ mode = 'admin' }) => {
  const isAdmin = mode === 'admin';
  const [stats, setStats] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [cars, setCars] = useState([]);
  const [users, setUsers] = useState([]);
  const [formConfig, setFormConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [incRes, carsRes, cfgRes] = await Promise.all([
        axios.get(`${API}/incidents`),
        axios.get(`${API}/vehicles`),
        axios.get(`${API}/incidents/form-config`),
      ]);
      setIncidents(incRes.data.incidents || []);
      setCars(carsRes.data.vehicles || carsRes.data || []);
      setFormConfig(cfgRes.data);

      if (isAdmin) {
        try {
          const [statsRes, usersRes] = await Promise.all([
            axios.get(`${API}/incidents/stats`),
            axios.get(`${API}/tenant/users`).catch(() => ({ data: { users: [] } })),
          ]);
          setStats(statsRes.data);
          setUsers(usersRes.data.users || usersRes.data || []);
        } catch {
          /* non-fatal */
        }
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this incident? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/incidents/${id}`);
      toast.success('Incident deleted');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Delete failed');
    }
  };

  const exportCsv = async () => {
    try {
      const res = await axios.get(`${API}/incidents/export`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = 'incidents.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Export failed');
    }
  };

  /* ---- Staff mode: just a prominent button ---- */
  if (!isAdmin) {
    return (
      <div className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200 rounded-2xl p-5 flex items-center justify-between" data-testid="staff-incident-card">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Incident to report?</h3>
            <p className="text-sm text-slate-600">Log damage, accidents, breakdowns or anything unusual.</p>
          </div>
        </div>
        <button
          onClick={() => setShowLog(true)}
          data-testid="staff-report-incident-btn"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white font-semibold rounded-xl hover:bg-rose-700 shadow-md shadow-rose-200"
        >
          <Plus size={16} />
          Report Incident
        </button>

        <IncidentFormModal
          isOpen={showLog}
          onClose={() => setShowLog(false)}
          onSaved={load}
          cars={cars}
          users={[]}
          formConfig={formConfig}
          canChooseStaff={false}
        />
      </div>
    );
  }

  /* ---- Admin dashboard ---- */

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 size={22} className="animate-spin mr-2" /> Loading incidents…
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="incident-reports-section">
      {/* Header bar */}
      <div className="bg-gradient-to-r from-rose-600 to-orange-500 text-white rounded-2xl p-5 flex items-center justify-between shadow-md shadow-rose-200/40">
        <div className="flex items-center gap-3">
          <AlertTriangle size={24} />
          <h2 className="text-xl font-bold">Incident Reports</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBuilder(true)}
            data-testid="customise-form-btn"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 text-white text-sm font-medium rounded-lg hover:bg-white/25 border border-white/20"
          >
            <Settings size={14} />
            Customise Form
          </button>
          <button
            onClick={exportCsv}
            data-testid="export-incidents-btn"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 text-white text-sm font-medium rounded-lg hover:bg-white/25 border border-white/20"
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            onClick={() => { setEditing(null); setShowLog(true); }}
            data-testid="log-incident-btn"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-rose-600 text-sm font-semibold rounded-lg hover:bg-rose-50"
          >
            <Plus size={14} />
            Log Incident
          </button>
        </div>
      </div>

      {/* Top stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="incident-stats-grid">
          <StatCard label="This Week" value={stats.this_week} tint="bg-rose-50 text-rose-600" />
          <StatCard label="This Month" value={stats.this_month} tint="bg-orange-50 text-orange-600" />
          <StatCard label="This Year" value={stats.this_year} tint="bg-amber-50 text-amber-700" />
          <StatCard label="Total" value={stats.total} tint="bg-slate-100 text-slate-700" />
        </div>
      )}

      {/* By severity + type */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3">By Severity</h3>
            {['minor', 'moderate', 'severe'].map((s) => (
              <div key={s} className="flex items-center justify-between py-1">
                <span className="text-sm flex items-center gap-2 capitalize">
                  <span className={`w-2 h-2 rounded-full ${s === 'minor' ? 'bg-amber-500' : s === 'moderate' ? 'bg-orange-500' : 'bg-rose-500'}`} />
                  {s}
                </span>
                <span className="text-sm font-semibold text-slate-700">{stats.by_severity[s] || 0}</span>
              </div>
            ))}
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3">By Type</h3>
            {Object.keys(stats.by_type).length === 0 && <p className="text-xs text-slate-400 italic">No data yet</p>}
            {Object.entries(stats.by_type).map(([t, n]) => (
              <div key={t} className="flex items-center justify-between py-1">
                <span className="text-sm text-slate-700">{t}</span>
                <span className="text-sm font-semibold text-slate-700">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per staff + per car */}
      {stats && (stats.by_staff.length > 0 || stats.by_car.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <User size={14} /> Incidents per Staff
            </h3>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {stats.by_staff.map((s) => (
                <div key={s.user_id} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-slate-700">{s.name}</span>
                  <span className="font-semibold text-slate-700">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <CarIcon size={14} /> Incidents per Car
            </h3>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {stats.by_car.map((c) => (
                <div key={c.car_id} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-slate-700">
                    {c.name} <span className="text-slate-400 text-xs ml-1">{c.registration}</span>
                  </span>
                  <span className="font-semibold text-slate-700">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Unresolved banner */}
      {stats && stats.unresolved > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2 text-rose-800 text-sm" data-testid="unresolved-banner">
          <AlertTriangle size={16} />
          <span><strong>{stats.unresolved}</strong> unresolved incident{stats.unresolved !== 1 ? 's' : ''} requiring attention</span>
        </div>
      )}

      {/* Recent incidents table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">Recent Incidents</h3>
        </div>
        {incidents.length === 0 ? (
          <p className="text-sm text-slate-500 italic text-center py-8">No incidents reported yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Date</th>
                  <th className="px-4 py-2 text-left font-semibold">Type</th>
                  <th className="px-4 py-2 text-left font-semibold">Car</th>
                  <th className="px-4 py-2 text-left font-semibold">Staff</th>
                  <th className="px-4 py-2 text-left font-semibold">Severity</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
                  <th className="px-4 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incidents.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{i.incident_date}</td>
                    <td className="px-4 py-3 text-slate-700">{i.type}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-900 font-medium">{i.car_name || '—'}</div>
                      <div className="text-xs text-slate-400">{i.car_registration}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{i.staff_name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border capitalize ${SEVERITY_COLORS[i.severity] || ''}`}>
                        {i.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border capitalize ${STATUS_COLORS[i.status] || ''}`}>
                        {i.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => { setEditing(i); setShowLog(true); }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        aria-label="Edit incident"
                        data-testid={`edit-incident-${i.id}`}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(i.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded ml-1"
                        aria-label="Delete incident"
                        data-testid={`delete-incident-${i.id}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <IncidentFormModal
        isOpen={showLog}
        onClose={() => { setShowLog(false); setEditing(null); }}
        onSaved={load}
        cars={cars}
        users={users}
        formConfig={formConfig}
        canChooseStaff={true}
        incident={editing}
      />
      <FormBuilderModal
        isOpen={showBuilder}
        onClose={() => setShowBuilder(false)}
        config={formConfig}
        onSaved={load}
      />
    </div>
  );
};

/* ---- tiny stat card ---- */
const StatCard = ({ label, value, tint }) => (
  <div className={`rounded-xl p-4 text-center ${tint || 'bg-slate-100 text-slate-700'} border border-slate-200/60`}>
    <div className="text-3xl font-bold leading-none mb-1">{value || 0}</div>
    <div className="text-xs text-slate-500 uppercase tracking-wider">{label}</div>
  </div>
);

export default IncidentReportsSection;
