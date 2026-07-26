import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { X, Plus, Radio, Trash2, Power, PowerOff, MessageSquare, Info, Loader2, Check } from 'lucide-react';
import { trackerAPI, carAPI } from '../api/api';

/**
 * TrackerDevicesModal
 * -------------------
 * Tenant admin console for GPS trackers (Phase 3).
 *
 * Left column: registration form + SMS setup guide for SinoTrack ST-902L.
 * Right column: table of the tenant's devices with car assignment dropdown,
 * activate/deactivate + delete actions. Demo mode is triggered by IMEIs
 * prefixed DEMO- or SIM- (skips SinoTrack cloud, uses local simulator).
 *
 * All queries are tenant-scoped by the backend — a tenant admin can only
 * ever see their own devices.
 */
const TrackerDevicesModal = ({ isOpen, onClose }) => {
  const [devices, setDevices] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ imei: '', car_id: '', label: '', sim_number: '', apn: '' });
  const [creating, setCreating] = useState(false);
  const [showSmsGuide, setShowSmsGuide] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([trackerAPI.listDevices(), carAPI.getAll()]);
      setDevices(d.data || []);
      setCars(c.data || []);
    } catch {
      toast.error('Could not load trackers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isOpen) { setLoading(true); reload(); } }, [isOpen, reload]);

  if (!isOpen) return null;

  const carLabel = (id) => {
    const car = cars.find((c) => c.id === id);
    return car ? `${car.name} · ${car.registration}` : '—';
  };

  const usedCarIds = new Set(devices.filter((d) => d.is_active && d.car_id).map((d) => d.car_id));

  const submit = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await trackerAPI.registerDevice({
        imei: form.imei.trim(),
        car_id: form.car_id || null,
        label: form.label,
        sim_number: form.sim_number,
        apn: form.apn,
      });
      toast.success('Tracker registered');
      setForm({ imei: '', car_id: '', label: '', sim_number: '', apn: '' });
      reload();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not register tracker');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (d) => {
    try {
      await trackerAPI.updateDevice(d.id, { is_active: !d.is_active });
      reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not update tracker');
    }
  };

  const reassign = async (d, car_id) => {
    try {
      await trackerAPI.updateDevice(d.id, { car_id: car_id || null });
      reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not reassign');
    }
  };

  const del = async (d) => {
    if (!window.confirm(`Delete tracker ${d.label || d.imei}? Historical positions are retained.`)) return;
    try {
      await trackerAPI.deleteDevice(d.id);
      toast.success('Tracker deleted');
      reload();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not delete tracker');
    }
  };

  const insertDemoImei = () => {
    setForm((f) => ({ ...f, imei: `DEMO-${Math.floor(1000 + Math.random() * 9000)}`, label: f.label || 'Demo tracker' }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose} data-testid="tracker-devices-modal">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[92vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center">
              <Radio size={18} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">GPS Trackers</h3>
              <p className="text-xs text-slate-500">Manage SinoTrack devices for your fleet</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        <div className="grid lg:grid-cols-5 gap-6 p-5 overflow-y-auto">
          {/* Registration form */}
          <form onSubmit={submit} className="lg:col-span-2 space-y-3" data-testid="tracker-register-form">
            <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <Plus size={14} /> Register a tracker
            </h4>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">IMEI *</label>
              <div className="flex gap-2">
                <input
                  required
                  value={form.imei}
                  onChange={(e) => setForm((f) => ({ ...f, imei: e.target.value }))}
                  placeholder="e.g. 123456789012345 or DEMO-1234"
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md font-mono"
                  data-testid="tracker-imei-input"
                />
                <button type="button" onClick={insertDemoImei} className="px-2 text-xs font-semibold text-amber-800 bg-amber-100 border border-amber-200 rounded-md hover:bg-amber-200" data-testid="tracker-demo-btn">
                  Demo
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">10-20 digits for real hardware, or DEMO-xxxx for a simulated tracker.</p>            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assign to car (optional)</label>
              <select value={form.car_id} onChange={(e) => setForm((f) => ({ ...f, car_id: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white" data-testid="tracker-car-select">
                <option value="">— none —</option>
                {cars.filter((c) => !usedCarIds.has(c.id)).map((c) => (
                  <option key={c.id} value={c.id}>{c.name} · {c.registration}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Label</label>
              <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" placeholder="e.g. Van tracker A" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">SIM number</label>
                <input value={form.sim_number} onChange={(e) => setForm((f) => ({ ...f, sim_number: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" placeholder="+353…" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">APN</label>
                <input value={form.apn} onChange={(e) => setForm((f) => ({ ...f, apn: e.target.value }))} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md" placeholder="e.g. internet" />
              </div>
            </div>
            <button type="submit" disabled={creating} className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50" data-testid="tracker-register-btn">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Register tracker
            </button>

            {/* SMS setup guide */}
            <div className="mt-4 border border-slate-200 rounded-lg">
              <button type="button" onClick={() => setShowSmsGuide((v) => !v)} className="w-full flex items-center justify-between p-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" data-testid="tracker-sms-guide-toggle">
                <span className="inline-flex items-center gap-1.5"><MessageSquare size={13} /> SinoTrack ST-902L SMS setup guide</span>
                <span>{showSmsGuide ? '−' : '+'}</span>
              </button>
              {showSmsGuide && (
                <div className="p-3 pt-0 space-y-2 text-xs text-slate-700" data-testid="tracker-sms-guide-body">
                  <p>Send these SMS commands from any mobile phone to the SIM inside the tracker. Replace <code className="bg-slate-100 px-1 rounded">123456</code> with the device password if you have changed it.</p>
                  <ol className="list-decimal ml-5 space-y-1.5 font-mono text-[11px]">
                    <li><code className="bg-slate-100 px-1 rounded">APN,123456,internet</code> — set network APN (use your SIM&apos;s APN)</li>
                    <li><code className="bg-slate-100 px-1 rounded">SERVER,123456,1,246.sinotrack.com,7700,0</code> — point to SinoTrack cloud</li>
                    <li><code className="bg-slate-100 px-1 rounded">TIMER,123456,30</code> — report every 30 s</li>
                    <li><code className="bg-slate-100 px-1 rounded">STATUS,123456</code> — verify device is online</li>
                  </ol>
                  <p className="text-[11px] text-slate-500">Device replies with confirmation SMS after each command.</p>
                </div>
              )}
            </div>
          </form>

          {/* Device list */}
          <div className="lg:col-span-3 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-900">Registered trackers</h4>
              <span className="text-xs text-slate-500">{devices.length} total</span>
            </div>
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
            ) : devices.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 italic border border-dashed border-slate-200 rounded-lg">
                No trackers yet. Register one on the left to get started.
              </div>
            ) : (
              <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden">
                {devices.map((d) => (
                  <li key={d.id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3" data-testid={`tracker-row-${d.id}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-mono text-sm font-semibold text-slate-900 truncate">{d.imei}</p>
                        {d.is_demo && <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-500 text-white px-1 rounded" data-testid={`tracker-demo-badge-${d.id}`}>DEMO</span>}
                        {d.verified_with_sinotrack && <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1"><Check size={9} />Verified</span>}
                        {!d.is_active && <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 rounded px-1">Off</span>}
                      </div>
                      {d.label && <p className="text-xs text-slate-500 truncate">{d.label}</p>}
                    </div>
                    <select value={d.car_id || ''} onChange={(e) => reassign(d, e.target.value)} className="text-xs px-2 py-1.5 border border-slate-300 rounded-md bg-white max-w-[180px] truncate" data-testid={`tracker-car-${d.id}`}>
                      <option value="">— unassigned —</option>
                      {cars.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} · {c.registration}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleActive(d)} className="p-1.5 rounded hover:bg-slate-100" title={d.is_active ? 'Deactivate' : 'Activate'} data-testid={`tracker-toggle-${d.id}`}>
                        {d.is_active ? <Power size={14} className="text-emerald-600" /> : <PowerOff size={14} className="text-slate-400" />}
                      </button>
                      <button onClick={() => del(d)} className="p-1.5 rounded hover:bg-rose-50 text-rose-600" title="Delete" data-testid={`tracker-delete-${d.id}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex gap-2 text-[11px] p-3 bg-blue-50 border border-blue-100 text-blue-900 rounded-md">
              <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
              <span>
                Assign a tracker to a car for it to appear on the Live Map. Only one active tracker per car is allowed. Demo trackers generate simulated GPS positions around real Irish city loops for development and demos.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackerDevicesModal;
