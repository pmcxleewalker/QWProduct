import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertTriangle, Car, Calendar, Gauge, Shield, Clock, FileText,
  ChevronDown, ChevronUp, Settings, Bell, X, Check, EyeOff, RotateCcw
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Default reminder settings
const DEFAULT_SETTINGS = {
  tax_warning_days: 60,
  nct_warning_days: 60,
  insurance_warning_days: 60,
  service_warning_km: 10,
  enable_tax_alerts: true,
  enable_nct_alerts: true,
  enable_insurance_alerts: true,
  enable_service_alerts: true
};

// Build the canonical "ref" used to key acknowledgments. Must match what
// the user is acknowledging — when the underlying value changes (vehicle is
// renewed), the ref changes and the ack becomes stale, re-surfacing the alert.
const refFor = (vehicle, type) => {
  switch (type) {
    case 'tax': return vehicle.tax_due_date || '';
    case 'nct': return vehicle.nct_due_date || '';
    case 'insurance': return vehicle.insurance_due_date || '';
    case 'service':
      return vehicle.service_due_date
        ? `d:${vehicle.service_due_date}`
        : `m:${vehicle.service_due_mileage ?? ''}`;
    default: return '';
  }
};

const ackKey = (vehicleId, type, ref) => `${vehicleId}|${type}|${ref}`;

const ComplianceAlerts = ({ vehicles, onSettingsClick, complianceSettings, isAdmin = true }) => {
  const [expanded, setExpanded] = useState(true);
  const [acks, setAcks] = useState([]);          // Active acknowledgments
  const [showCleared, setShowCleared] = useState(false);
  const [busyKey, setBusyKey] = useState(null);  // Per-card spinner

  // Merge default settings with any custom settings
  const settings = useMemo(() => ({
    ...DEFAULT_SETTINGS,
    ...complianceSettings
  }), [complianceSettings]);

  const fetchAcks = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await axios.get(`${API}/compliance/acknowledgments`);
      setAcks(res.data?.acknowledgments || []);
    } catch (e) {
      // Non-fatal — alerts still render, just nothing hidden
      setAcks([]);
    }
  }, [isAdmin]);

  useEffect(() => { fetchAcks(); }, [fetchAcks]);

  // Fast lookup map of active acks (key → ack record)
  const ackMap = useMemo(() => {
    const map = new Map();
    acks.forEach(a => map.set(ackKey(a.vehicle_id, a.type, a.ref || ''), a));
    return map;
  }, [acks]);

  // Calculate compliance issues (split into critical/warning/upcoming and
  // cleared — cleared are still tracked so admins can un-dismiss them).
  const { critical, warning, upcoming, cleared } = useMemo(() => {
    const out = { critical: [], warning: [], upcoming: [], cleared: [] };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const push = (issue) => {
      const ref = refFor(issue.vehicle, issue.type);
      const ack = ackMap.get(ackKey(issue.vehicle.id, issue.type, ref));
      if (ack) {
        out.cleared.push({ ...issue, ref, ack });
        return;
      }
      if (issue.severity === 'critical') out.critical.push({ ...issue, ref });
      else if (issue.severity === 'low') out.upcoming.push({ ...issue, ref });
      else out.warning.push({ ...issue, ref });
    };

    const dateIssue = (vehicle, type, label, dueDate, warningDays, criticalLabel, soonLabel, reminderLabel) => {
      if (!dueDate) return;
      const due = new Date(dueDate);
      due.setHours(0, 0, 0, 0);
      const days = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
      if (days < 0) {
        push({ vehicle, type, label: criticalLabel, detail: `Expired ${Math.abs(days)} days ago`, date: dueDate, severity: 'critical' });
      } else if (days <= warningDays) {
        push({ vehicle, type, label: soonLabel, detail: `Due in ${days} days`, date: dueDate, severity: days <= 14 ? 'high' : 'medium' });
      } else if (days <= warningDays * 2) {
        push({ vehicle, type, label: reminderLabel, detail: `Due in ${days} days`, date: dueDate, severity: 'low' });
      }
    };

    vehicles.forEach(vehicle => {
      if (settings.enable_tax_alerts) {
        dateIssue(vehicle, 'tax', 'Tax', vehicle.tax_due_date, settings.tax_warning_days,
          'Tax Expired', 'Tax Due Soon', 'Tax Reminder');
      }
      if (settings.enable_nct_alerts) {
        dateIssue(vehicle, 'nct', 'NCT', vehicle.nct_due_date, settings.nct_warning_days,
          'NCT Expired', 'NCT Due Soon', 'NCT Reminder');
      }
      if (settings.enable_insurance_alerts) {
        dateIssue(vehicle, 'insurance', 'Insurance', vehicle.insurance_due_date, settings.insurance_warning_days,
          'Insurance Expired', 'Insurance Renewal Due', 'Insurance Renewal Upcoming');
      }
      // Service — mileage based
      if (settings.enable_service_alerts && vehicle.service_due_mileage && vehicle.current_mileage) {
        const kmRemaining = vehicle.service_due_mileage - vehicle.current_mileage;
        if (kmRemaining < 0) {
          push({ vehicle, type: 'service', label: 'Service Overdue', detail: `${Math.abs(kmRemaining).toLocaleString()} km overdue`, severity: 'critical' });
        } else if (kmRemaining <= settings.service_warning_km) {
          push({ vehicle, type: 'service', label: 'Service Due Soon', detail: `${kmRemaining.toLocaleString()} km remaining`, severity: kmRemaining <= 5 ? 'high' : 'medium' });
        } else if (kmRemaining <= settings.service_warning_km * 2) {
          push({ vehicle, type: 'service', label: 'Service Approaching', detail: `${kmRemaining.toLocaleString()} km remaining`, severity: 'low' });
        }
      }
      // Service — date based
      if (settings.enable_service_alerts && vehicle.service_due_date && !vehicle.service_due_mileage) {
        dateIssue(vehicle, 'service', 'Service', vehicle.service_due_date, settings.service_warning_km > 30 ? settings.service_warning_km : 60,
          'Service Overdue', 'Service Due Soon', 'Service Approaching');
      }
    });

    return out;
  }, [vehicles, settings, ackMap]);

  const totalIssues = critical.length + warning.length;
  const hasIssues = totalIssues > 0 || upcoming.length > 0;
  const hasCleared = cleared.length > 0;

  // === Action handlers ===
  const acknowledge = async (issue, action) => {
    if (!isAdmin) return;
    const key = ackKey(issue.vehicle.id, issue.type, issue.ref);
    setBusyKey(key);
    try {
      const res = await axios.post(`${API}/compliance/acknowledgments`, {
        vehicle_id: issue.vehicle.id,
        type: issue.type,
        action,
        ref: issue.ref
      });
      const newAck = res.data?.acknowledgment;
      if (newAck) {
        setAcks(prev => {
          const filtered = prev.filter(a => !(
            a.vehicle_id === newAck.vehicle_id &&
            a.type === newAck.type &&
            (a.ref || '') === (newAck.ref || '')
          ));
          return [...filtered, newAck];
        });
      } else {
        await fetchAcks();
      }
      toast.success(action === 'actioned' ? 'Marked as actioned' : 'Alert dismissed');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update');
    } finally {
      setBusyKey(null);
    }
  };

  const restore = async (ack) => {
    if (!isAdmin) return;
    setBusyKey(`restore-${ack.id}`);
    try {
      await axios.delete(`${API}/compliance/acknowledgments/${ack.id}`);
      setAcks(prev => prev.filter(a => a.id !== ack.id));
      toast.success('Alert restored');
    } catch (e) {
      toast.error('Failed to restore');
    } finally {
      setBusyKey(null);
    }
  };

  // === Render helpers ===
  const getTypeIcon = (type) => {
    switch (type) {
      case 'tax': return <Shield size={16} />;
      case 'nct': return <Calendar size={16} />;
      case 'insurance': return <FileText size={16} />;
      case 'service': return <Gauge size={16} />;
      default: return <AlertTriangle size={16} />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'low': return 'bg-blue-50 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const renderIssueCard = (issue) => {
    const key = ackKey(issue.vehicle.id, issue.type, issue.ref);
    const busy = busyKey === key;
    const testid = `compliance-issue-${issue.vehicle.id}-${issue.type}`;
    return (
      <div
        key={`${issue.vehicle.id}-${issue.type}`}
        className={`p-3 rounded-lg border ${getSeverityColor(issue.severity)}`}
        data-testid={testid}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-2 min-w-0">
            <div className="mt-0.5">{getTypeIcon(issue.type)}</div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{issue.vehicle.name}</p>
              <p className="text-xs opacity-75 truncate">{issue.vehicle.registration}</p>
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
            issue.severity === 'critical' ? 'bg-red-200' :
            issue.severity === 'high' ? 'bg-orange-200' :
            issue.severity === 'medium' ? 'bg-amber-200' : 'bg-blue-100'
          }`}>
            {issue.type.toUpperCase()}
          </span>
        </div>
        <div className="mt-2 text-sm">
          <p className="font-medium">{issue.label}</p>
          <p className="text-xs opacity-75">{issue.detail}</p>
          {issue.date && (
            <p className="text-xs mt-1 opacity-60">
              Due: {new Date(issue.date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
        {isAdmin && (
          <div className="mt-3 pt-2 border-t border-current/10 flex items-center gap-2">
            <button
              onClick={() => acknowledge(issue, 'actioned')}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-white/70 hover:bg-white border border-current/20 disabled:opacity-50"
              title="Mark as actioned — clears from dashboard until the date changes"
              data-testid={`${testid}-actioned-btn`}
            >
              <Check size={12} /> Actioned
            </button>
            <button
              onClick={() => acknowledge(issue, 'dismissed')}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-white/70 hover:bg-white border border-current/20 disabled:opacity-50"
              title="Dismiss — hide this reminder until the date changes"
              data-testid={`${testid}-dismiss-btn`}
            >
              <EyeOff size={12} /> Dismiss
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderClearedCard = (issue) => {
    const ack = issue.ack;
    const busy = busyKey === `restore-${ack.id}`;
    return (
      <div
        key={`cleared-${issue.vehicle.id}-${issue.type}`}
        className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-700"
        data-testid={`compliance-cleared-${issue.vehicle.id}-${issue.type}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-2 min-w-0">
            <div className="mt-0.5 text-slate-500">{getTypeIcon(issue.type)}</div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{issue.vehicle.name}</p>
              <p className="text-xs text-slate-500 truncate">{issue.vehicle.registration}</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-slate-200 text-slate-600">
            {ack.action === 'actioned' ? 'ACTIONED' : 'DISMISSED'}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {issue.label} · {ack.actioned_by_name || 'Admin'} ·{' '}
          {ack.actioned_at ? new Date(ack.actioned_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) : ''}
        </p>
        {isAdmin && (
          <button
            onClick={() => restore(ack)}
            disabled={busy}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 disabled:opacity-50"
            data-testid={`compliance-restore-${ack.id}`}
          >
            <RotateCcw size={12} /> Restore alert
          </button>
        )}
      </div>
    );
  };

  if (!hasIssues && !hasCleared) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4" data-testid="compliance-all-clear">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
              <Check className="text-green-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-green-800">All Vehicles Compliant</h3>
              <p className="text-sm text-green-600">No upcoming compliance issues</p>
            </div>
          </div>
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="p-2 hover:bg-green-100 rounded-lg transition-colors"
              title="Compliance Settings"
              data-testid="compliance-settings-open"
            >
              <Settings size={18} className="text-green-600" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // If everything is cleared but we have cleared items, render a small banner
  if (!hasIssues && hasCleared) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4" data-testid="compliance-all-cleared">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
              <Check className="text-green-600" size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-green-800">All compliance items cleared</h3>
              <p className="text-sm text-green-600">{cleared.length} alert{cleared.length === 1 ? '' : 's'} actioned or dismissed</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCleared(s => !s)}
              className="text-xs font-medium text-green-800 underline hover:text-green-900"
              data-testid="compliance-toggle-cleared"
            >
              {showCleared ? 'Hide' : 'Show'} cleared
            </button>
            {onSettingsClick && (
              <button onClick={onSettingsClick} className="p-2 hover:bg-green-100 rounded-lg" data-testid="compliance-settings-open">
                <Settings size={18} className="text-green-600" />
              </button>
            )}
          </div>
        </div>
        {showCleared && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {cleared.map(renderClearedCard)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border overflow-hidden ${
      critical.length > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
    }`}>
      {/* Header */}
      <div
        className={`p-4 cursor-pointer ${critical.length > 0 ? 'bg-red-100' : 'bg-amber-100'}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
              critical.length > 0 ? 'bg-red-200' : 'bg-amber-200'
            }`}>
              <AlertTriangle className={critical.length > 0 ? 'text-red-600' : 'text-amber-600'} size={20} />
            </div>
            <div>
              <h3 className={`font-semibold ${critical.length > 0 ? 'text-red-800' : 'text-amber-800'}`}>
                Compliance Alerts
                {totalIssues > 0 && (
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    critical.length > 0 ? 'bg-red-200' : 'bg-amber-200'
                  }`}>
                    {totalIssues} {totalIssues === 1 ? 'issue' : 'issues'}
                  </span>
                )}
              </h3>
              <p className={`text-sm ${critical.length > 0 ? 'text-red-600' : 'text-amber-600'}`}>
                {critical.length > 0
                  ? `${critical.length} critical issue(s) need attention`
                  : `${warning.length} warning(s) within alert period`}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {onSettingsClick && (
              <button
                onClick={(e) => { e.stopPropagation(); onSettingsClick(); }}
                className={`p-2 rounded-lg transition-colors ${
                  critical.length > 0 ? 'hover:bg-red-200 text-red-600' : 'hover:bg-amber-200 text-amber-600'
                }`}
                title="Compliance Settings"
                data-testid="compliance-settings-open"
              >
                <Settings size={18} />
              </button>
            )}
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>

      {/* Content */}
      {expanded && (() => {
        // Group all (non-cleared) issues by compliance type so admins can
        // mentally check "Tax — all done", "NCT — 2 outstanding" etc instead
        // of scanning a single mixed list. Within each type we preserve the
        // existing critical → warning → upcoming hierarchy so the most
        // urgent items still surface first.
        const TYPE_META = {
          tax:       { label: 'Tax',        icon: Shield,   accent: 'text-violet-700', dot: 'bg-violet-500' },
          nct:       { label: 'NCT',        icon: Calendar, accent: 'text-sky-700',    dot: 'bg-sky-500' },
          insurance: { label: 'Insurance',  icon: FileText, accent: 'text-emerald-700', dot: 'bg-emerald-500' },
          service:   { label: 'Service',    icon: Gauge,    accent: 'text-amber-700',  dot: 'bg-amber-500' },
        };
        const TYPE_ORDER = ['tax', 'nct', 'insurance', 'service'];
        const grouped = { tax: [], nct: [], insurance: [], service: [] };
        [...critical, ...warning, ...upcoming].forEach(issue => {
          if (grouped[issue.type]) grouped[issue.type].push(issue);
        });
        // Sort within a type: critical first, then warning (high → low), then upcoming.
        const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
        Object.keys(grouped).forEach(k => {
          grouped[k].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99));
        });

        return (
          <div className="p-4 space-y-5">
            {TYPE_ORDER.map((typeKey) => {
              const issues = grouped[typeKey];
              if (!issues || issues.length === 0) return null;
              const meta = TYPE_META[typeKey];
              const Icon = meta.icon;
              const criticalCount = issues.filter(i => i.severity === 'critical').length;
              const warningCount = issues.filter(i => i.severity === 'high' || i.severity === 'medium').length;
              const upcomingCount = issues.filter(i => i.severity === 'low').length;
              return (
                <section key={typeKey} data-testid={`compliance-section-${typeKey}`}>
                  <header className="flex items-center justify-between mb-2 pb-1 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                      <Icon size={16} className={meta.accent} />
                      <h4 className={`text-sm font-semibold ${meta.accent}`}>
                        {meta.label}
                      </h4>
                      <span className="text-xs text-slate-500">
                        {issues.length} outstanding
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {criticalCount > 0 && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                          {criticalCount} critical
                        </span>
                      )}
                      {warningCount > 0 && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                          {warningCount} due soon
                        </span>
                      )}
                      {upcomingCount > 0 && (
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                          {upcomingCount} upcoming
                        </span>
                      )}
                    </div>
                  </header>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {issues.map(renderIssueCard)}
                  </div>
                </section>
              );
            })}

            {hasCleared && (
              <details className="group">
                <summary className="text-sm font-semibold text-slate-700 mb-2 flex items-center cursor-pointer list-none">
                  <EyeOff size={14} className="mr-1" />
                  Cleared by admin ({cleared.length})
                  <ChevronDown size={14} className="ml-1 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                  {cleared.map(renderClearedCard)}
                </div>
              </details>
            )}

            {/* Summary Stats */}
            <div className="flex items-center justify-between pt-3 border-t border-amber-200 text-xs text-amber-700">
              <span>
                Tax/NCT/Insurance {settings.tax_warning_days} days · Service {settings.service_warning_km} km
              </span>
              {onSettingsClick && (
                <button onClick={onSettingsClick} className="text-amber-800 hover:underline font-medium">
                  Adjust Settings
                </button>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// Compliance Settings Modal Component
export const ComplianceSettingsModal = ({ isOpen, onClose, settings, onSave }) => {
  const [form, setForm] = useState({
    tax_warning_days: 60,
    nct_warning_days: 60,
    insurance_warning_days: 60,
    service_warning_km: 10,
    enable_tax_alerts: true,
    enable_nct_alerts: true,
    enable_insurance_alerts: true,
    enable_service_alerts: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && settings) {
      setForm({
        tax_warning_days: settings.tax_warning_days ?? 60,
        nct_warning_days: settings.nct_warning_days ?? 60,
        insurance_warning_days: settings.insurance_warning_days ?? 60,
        service_warning_km: settings.service_warning_km ?? 10,
        enable_tax_alerts: settings.enable_tax_alerts ?? true,
        enable_nct_alerts: settings.enable_nct_alerts ?? true,
        enable_insurance_alerts: settings.enable_insurance_alerts ?? true,
        enable_service_alerts: settings.enable_service_alerts ?? true
      });
    }
  }, [isOpen, settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
      toast.success('Compliance settings saved');
      onClose();
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const renderToggleRow = (icon, label, enabledKey, daysKey, daysLabel, daysHelp, isKm = false) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="flex items-center space-x-2">
          {icon}
          <span className="font-medium">{label}</span>
        </label>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={form[enabledKey]}
            onChange={(e) => setForm({ ...form, [enabledKey]: e.target.checked })}
            className="sr-only peer"
            data-testid={`compliance-${enabledKey}`}
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-violet-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
        </label>
      </div>
      {form[enabledKey] && (
        <div className="ml-6">
          <label className="text-sm text-gray-600">Alert {isKm ? 'when within' : 'before'} ({isKm ? 'km' : 'days'})</label>
          <input
            type="number"
            value={form[daysKey]}
            onChange={(e) => setForm({ ...form, [daysKey]: parseInt(e.target.value) || 0 })}
            min="1"
            max={isKm ? 1000 : 365}
            className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            data-testid={`compliance-${daysKey}`}
          />
          <p className="text-xs text-gray-400 mt-1">{daysHelp}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b bg-violet-600 text-white rounded-t-xl flex-shrink-0">
          <h3 className="text-lg font-bold flex items-center">
            <Settings size={20} className="mr-2" />
            Compliance Reminder Settings
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {renderToggleRow(<Shield size={18} className="text-violet-600" />, 'Tax Reminders',
            'enable_tax_alerts', 'tax_warning_days', 'Alert before (days)', 'Default: 60 days (2 months)')}
          {renderToggleRow(<Calendar size={18} className="text-violet-600" />, 'NCT Reminders',
            'enable_nct_alerts', 'nct_warning_days', 'Alert before (days)', 'Default: 60 days (2 months)')}
          {renderToggleRow(<FileText size={18} className="text-violet-600" />, 'Insurance Renewal Reminders',
            'enable_insurance_alerts', 'insurance_warning_days', 'Alert before (days)', 'Default: 60 days (2 months)')}
          {renderToggleRow(<Gauge size={18} className="text-violet-600" />, 'Service Mileage Reminders',
            'enable_service_alerts', 'service_warning_km', 'Alert when within (km)', 'Default: 10 km before service due', true)}
        </div>

        <div className="flex justify-end space-x-3 p-4 border-t bg-gray-50 rounded-b-xl flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
            data-testid="compliance-save-settings"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComplianceAlerts;
