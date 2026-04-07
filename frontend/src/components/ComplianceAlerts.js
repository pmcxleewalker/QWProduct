import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, Car, Calendar, Gauge, Shield, Clock, 
  ChevronDown, ChevronUp, Settings, Bell, X, Check
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Default reminder settings
const DEFAULT_SETTINGS = {
  tax_warning_days: 60,      // 2 months warning for tax
  nct_warning_days: 60,      // 2 months warning for NCT
  service_warning_km: 10,    // 10km before service due
  enable_tax_alerts: true,
  enable_nct_alerts: true,
  enable_service_alerts: true
};

const ComplianceAlerts = ({ vehicles, onSettingsClick, complianceSettings }) => {
  const [expanded, setExpanded] = useState(true);
  
  // Merge default settings with any custom settings
  const settings = useMemo(() => ({
    ...DEFAULT_SETTINGS,
    ...complianceSettings
  }), [complianceSettings]);

  // Calculate compliance issues
  const complianceIssues = useMemo(() => {
    const issues = {
      critical: [], // Expired or overdue
      warning: [],  // Within warning period
      upcoming: []  // Beyond warning but within 2x warning period
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    vehicles.forEach(vehicle => {
      // Check Tax
      if (settings.enable_tax_alerts && vehicle.tax_due_date) {
        const taxDate = new Date(vehicle.tax_due_date);
        taxDate.setHours(0, 0, 0, 0);
        const daysUntilTax = Math.ceil((taxDate - today) / (1000 * 60 * 60 * 24));

        if (daysUntilTax < 0) {
          issues.critical.push({
            vehicle,
            type: 'tax',
            label: 'Tax Expired',
            detail: `Expired ${Math.abs(daysUntilTax)} days ago`,
            date: vehicle.tax_due_date,
            severity: 'critical'
          });
        } else if (daysUntilTax <= settings.tax_warning_days) {
          issues.warning.push({
            vehicle,
            type: 'tax',
            label: 'Tax Due Soon',
            detail: `Due in ${daysUntilTax} days`,
            date: vehicle.tax_due_date,
            severity: daysUntilTax <= 14 ? 'high' : 'medium'
          });
        } else if (daysUntilTax <= settings.tax_warning_days * 2) {
          issues.upcoming.push({
            vehicle,
            type: 'tax',
            label: 'Tax Reminder',
            detail: `Due in ${daysUntilTax} days`,
            date: vehicle.tax_due_date,
            severity: 'low'
          });
        }
      }

      // Check NCT
      if (settings.enable_nct_alerts && vehicle.nct_due_date) {
        const nctDate = new Date(vehicle.nct_due_date);
        nctDate.setHours(0, 0, 0, 0);
        const daysUntilNCT = Math.ceil((nctDate - today) / (1000 * 60 * 60 * 24));

        if (daysUntilNCT < 0) {
          issues.critical.push({
            vehicle,
            type: 'nct',
            label: 'NCT Expired',
            detail: `Expired ${Math.abs(daysUntilNCT)} days ago`,
            date: vehicle.nct_due_date,
            severity: 'critical'
          });
        } else if (daysUntilNCT <= settings.nct_warning_days) {
          issues.warning.push({
            vehicle,
            type: 'nct',
            label: 'NCT Due Soon',
            detail: `Due in ${daysUntilNCT} days`,
            date: vehicle.nct_due_date,
            severity: daysUntilNCT <= 14 ? 'high' : 'medium'
          });
        } else if (daysUntilNCT <= settings.nct_warning_days * 2) {
          issues.upcoming.push({
            vehicle,
            type: 'nct',
            label: 'NCT Reminder',
            detail: `Due in ${daysUntilNCT} days`,
            date: vehicle.nct_due_date,
            severity: 'low'
          });
        }
      }

      // Check Service Mileage
      if (settings.enable_service_alerts && vehicle.service_due_mileage && vehicle.current_mileage) {
        const kmRemaining = vehicle.service_due_mileage - vehicle.current_mileage;

        if (kmRemaining < 0) {
          issues.critical.push({
            vehicle,
            type: 'service',
            label: 'Service Overdue',
            detail: `${Math.abs(kmRemaining).toLocaleString()} km overdue`,
            mileage: { current: vehicle.current_mileage, due: vehicle.service_due_mileage },
            severity: 'critical'
          });
        } else if (kmRemaining <= settings.service_warning_km) {
          issues.warning.push({
            vehicle,
            type: 'service',
            label: 'Service Due Soon',
            detail: `${kmRemaining.toLocaleString()} km remaining`,
            mileage: { current: vehicle.current_mileage, due: vehicle.service_due_mileage },
            severity: kmRemaining <= 5 ? 'high' : 'medium'
          });
        } else if (kmRemaining <= settings.service_warning_km * 2) {
          issues.upcoming.push({
            vehicle,
            type: 'service',
            label: 'Service Approaching',
            detail: `${kmRemaining.toLocaleString()} km remaining`,
            mileage: { current: vehicle.current_mileage, due: vehicle.service_due_mileage },
            severity: 'low'
          });
        }
      }
    });

    return issues;
  }, [vehicles, settings]);

  const totalIssues = complianceIssues.critical.length + complianceIssues.warning.length;
  const hasIssues = totalIssues > 0 || complianceIssues.upcoming.length > 0;

  if (!hasIssues) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
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
            >
              <Settings size={18} className="text-green-600" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'tax': return <Shield size={16} />;
      case 'nct': return <Calendar size={16} />;
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

  const renderIssueCard = (issue) => (
    <div 
      key={`${issue.vehicle.id}-${issue.type}`}
      className={`p-3 rounded-lg border ${getSeverityColor(issue.severity)}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2">
          <div className="mt-0.5">{getTypeIcon(issue.type)}</div>
          <div>
            <p className="font-semibold text-sm">{issue.vehicle.name}</p>
            <p className="text-xs opacity-75">{issue.vehicle.registration}</p>
          </div>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
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
    </div>
  );

  return (
    <div className={`rounded-xl border overflow-hidden ${
      complianceIssues.critical.length > 0 
        ? 'bg-red-50 border-red-200' 
        : 'bg-amber-50 border-amber-200'
    }`}>
      {/* Header */}
      <div 
        className={`p-4 cursor-pointer ${
          complianceIssues.critical.length > 0 
            ? 'bg-red-100' 
            : 'bg-amber-100'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
              complianceIssues.critical.length > 0 ? 'bg-red-200' : 'bg-amber-200'
            }`}>
              <AlertTriangle className={
                complianceIssues.critical.length > 0 ? 'text-red-600' : 'text-amber-600'
              } size={20} />
            </div>
            <div>
              <h3 className={`font-semibold ${
                complianceIssues.critical.length > 0 ? 'text-red-800' : 'text-amber-800'
              }`}>
                Compliance Alerts
                {totalIssues > 0 && (
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    complianceIssues.critical.length > 0 ? 'bg-red-200' : 'bg-amber-200'
                  }`}>
                    {totalIssues} {totalIssues === 1 ? 'issue' : 'issues'}
                  </span>
                )}
              </h3>
              <p className={`text-sm ${
                complianceIssues.critical.length > 0 ? 'text-red-600' : 'text-amber-600'
              }`}>
                {complianceIssues.critical.length > 0 
                  ? `${complianceIssues.critical.length} critical issue(s) need attention`
                  : `${complianceIssues.warning.length} warning(s) within alert period`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {onSettingsClick && (
              <button
                onClick={(e) => { e.stopPropagation(); onSettingsClick(); }}
                className={`p-2 rounded-lg transition-colors ${
                  complianceIssues.critical.length > 0 
                    ? 'hover:bg-red-200 text-red-600' 
                    : 'hover:bg-amber-200 text-amber-600'
                }`}
                title="Compliance Settings"
              >
                <Settings size={18} />
              </button>
            )}
            {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* Critical Issues */}
          {complianceIssues.critical.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-red-800 mb-2 flex items-center">
                <AlertTriangle size={14} className="mr-1" />
                Critical - Immediate Action Required
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {complianceIssues.critical.map(renderIssueCard)}
              </div>
            </div>
          )}

          {/* Warnings */}
          {complianceIssues.warning.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center">
                <Bell size={14} className="mr-1" />
                Warnings - Due Soon
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {complianceIssues.warning.map(renderIssueCard)}
              </div>
            </div>
          )}

          {/* Upcoming (collapsible) */}
          {complianceIssues.upcoming.length > 0 && (
            <details className="group">
              <summary className="text-sm font-semibold text-blue-800 mb-2 flex items-center cursor-pointer list-none">
                <Clock size={14} className="mr-1" />
                Upcoming ({complianceIssues.upcoming.length})
                <ChevronDown size={14} className="ml-1 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                {complianceIssues.upcoming.map(renderIssueCard)}
              </div>
            </details>
          )}

          {/* Summary Stats */}
          <div className="flex items-center justify-between pt-3 border-t border-amber-200 text-xs text-amber-700">
            <span>
              Settings: Tax/NCT {settings.tax_warning_days} days | Service {settings.service_warning_km} km
            </span>
            {onSettingsClick && (
              <button 
                onClick={onSettingsClick}
                className="text-amber-800 hover:underline font-medium"
              >
                Adjust Settings
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Compliance Settings Modal Component
export const ComplianceSettingsModal = ({ isOpen, onClose, settings, onSave }) => {
  const [form, setForm] = useState({
    tax_warning_days: 60,
    nct_warning_days: 60,
    service_warning_km: 10,
    enable_tax_alerts: true,
    enable_nct_alerts: true,
    enable_service_alerts: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && settings) {
      setForm({
        tax_warning_days: settings.tax_warning_days ?? 60,
        nct_warning_days: settings.nct_warning_days ?? 60,
        service_warning_km: settings.service_warning_km ?? 10,
        enable_tax_alerts: settings.enable_tax_alerts ?? true,
        enable_nct_alerts: settings.enable_nct_alerts ?? true,
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-violet-600 text-white rounded-t-xl">
          <h3 className="text-lg font-bold flex items-center">
            <Settings size={20} className="mr-2" />
            Compliance Reminder Settings
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Tax Alerts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2">
                <Shield size={18} className="text-violet-600" />
                <span className="font-medium">Tax Reminders</span>
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enable_tax_alerts}
                  onChange={(e) => setForm({ ...form, enable_tax_alerts: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-violet-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </label>
            </div>
            {form.enable_tax_alerts && (
              <div className="ml-6">
                <label className="text-sm text-gray-600">Alert before (days)</label>
                <input
                  type="number"
                  value={form.tax_warning_days}
                  onChange={(e) => setForm({ ...form, tax_warning_days: parseInt(e.target.value) || 0 })}
                  min="1"
                  max="365"
                  className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">Default: 60 days (2 months)</p>
              </div>
            )}
          </div>

          {/* NCT Alerts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2">
                <Calendar size={18} className="text-violet-600" />
                <span className="font-medium">NCT Reminders</span>
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enable_nct_alerts}
                  onChange={(e) => setForm({ ...form, enable_nct_alerts: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-violet-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </label>
            </div>
            {form.enable_nct_alerts && (
              <div className="ml-6">
                <label className="text-sm text-gray-600">Alert before (days)</label>
                <input
                  type="number"
                  value={form.nct_warning_days}
                  onChange={(e) => setForm({ ...form, nct_warning_days: parseInt(e.target.value) || 0 })}
                  min="1"
                  max="365"
                  className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">Default: 60 days (2 months)</p>
              </div>
            )}
          </div>

          {/* Service Alerts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2">
                <Gauge size={18} className="text-violet-600" />
                <span className="font-medium">Service Mileage Reminders</span>
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enable_service_alerts}
                  onChange={(e) => setForm({ ...form, enable_service_alerts: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-violet-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </label>
            </div>
            {form.enable_service_alerts && (
              <div className="ml-6">
                <label className="text-sm text-gray-600">Alert when within (km)</label>
                <input
                  type="number"
                  value={form.service_warning_km}
                  onChange={(e) => setForm({ ...form, service_warning_km: parseInt(e.target.value) || 0 })}
                  min="1"
                  max="1000"
                  className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">Default: 10 km before service due</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-4 border-t bg-gray-50 rounded-b-xl">
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
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComplianceAlerts;
