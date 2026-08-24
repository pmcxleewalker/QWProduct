import React, { useState, useEffect } from 'react';
import { X, Satellite, Zap, Info, Loader2 } from 'lucide-react';
import { settingsAPI } from '../api/api';
import { toast } from 'sonner';

/**
 * GpsSettingsModal
 * ----------------
 * Toggle SinoTrack GPS Fleet Tracking on/off for the current tenant, plus a
 * few per-tenant knobs (speed limit, poll interval, retention, device
 * password). Phase 1 of the GPS bridge — the actual poller ships in Phase 2,
 * so enabling here just flips the tenant flag so that Phase 2's per-tenant
 * loop will pick this tenant up when it lands.
 *
 * Props:
 *   isOpen (bool)
 *   onClose ()
 *   gps: {enabled, speed_limit_kmh, poll_interval_seconds, history_retention_days, device_password}
 *   onSaved(gps)  — parent updates its local state after save
 */
const GpsSettingsModal = ({ isOpen, onClose, gps, onSaved }) => {
  const [form, setForm] = useState({
    enabled: false,
    speed_limit_kmh: 120,
    poll_interval_seconds: 30,
    history_retention_days: 60,
    device_password: '123456',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && gps) {
      setForm({
        enabled: !!gps.enabled,
        speed_limit_kmh: Number(gps.speed_limit_kmh) || 120,
        poll_interval_seconds: Number(gps.poll_interval_seconds) || 30,
        history_retention_days: Number(gps.history_retention_days) || 60,
        device_password: gps.device_password || '123456',
      });
    }
  }, [isOpen, gps]);

  if (!isOpen) return null;

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await settingsAPI.updateGps(form);
      toast.success(form.enabled ? 'GPS Fleet Tracking enabled' : 'GPS Fleet Tracking disabled');
      if (onSaved) onSaved(data.gps);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not save GPS settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      data-testid="gps-settings-modal"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center">
              <Satellite size={18} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">GPS Fleet Tracking</h3>
              <p className="text-xs text-slate-500">SinoTrack cloud bridge · opt-in add-on</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100 text-slate-500" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status banner — GPS is activated by the Quick Wing team, not
              self-served, so this is read-only status rather than a toggle. */}
          <div className={`p-4 rounded-lg border ${form.enabled ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`h-2.5 w-2.5 mt-1.5 rounded-full ${form.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  GPS Fleet Tracking (SinoTrack) — {form.enabled ? 'Active' : 'Inactive'}
                </p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  When active, Quick Wing polls SinoTrack&apos;s cloud every 30 seconds
                  for every registered tracker, showing live positions, journey history,
                  speed alerts and driver scores. To activate or deactivate this add-on,
                  contact the Quick Wing team.
                </p>
              </div>
            </div>
          </div>

          {/* Advanced settings — only shown when enabled */}
          {form.enabled && (
            <div className="space-y-4" data-testid="gps-advanced-settings">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Speed limit (km/h)
                  </label>
                  <input
                    type="number"
                    min="30"
                    max="300"
                    value={form.speed_limit_kmh}
                    onChange={(e) => setForm((f) => ({ ...f, speed_limit_kmh: parseInt(e.target.value, 10) || 120 }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    data-testid="gps-speed-limit"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Triggers a speeding alert above this.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Poll interval (seconds)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="600"
                    value={form.poll_interval_seconds}
                    onChange={(e) => setForm((f) => ({ ...f, poll_interval_seconds: parseInt(e.target.value, 10) || 30 }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    data-testid="gps-poll-interval"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Recommended: 30s.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Journey retention (days)
                  </label>
                  <input
                    type="number"
                    min="7"
                    max="730"
                    value={form.history_retention_days}
                    onChange={(e) => setForm((f) => ({ ...f, history_retention_days: parseInt(e.target.value, 10) || 60 }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    data-testid="gps-history-days"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Older history is auto-deleted nightly.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tracker password
                  </label>
                  <input
                    type="text"
                    value={form.device_password}
                    onChange={(e) => setForm((f) => ({ ...f, device_password: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                    data-testid="gps-device-password"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">SinoTrack default is <code>123456</code>.</p>
                </div>
              </div>

              <div className="flex gap-2 text-[11px] p-3 bg-blue-50 border border-blue-100 text-blue-900 rounded-md">
                <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Phase 1 of the GPS bridge — this toggle controls whether Quick
                  Wing will poll for your fleet. The tracker device management,
                  live map and journey playback screens land in the next release.
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t bg-slate-50">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            data-testid="gps-settings-save"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default GpsSettingsModal;
