import React, { useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  X, Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle,
  Loader2, Car, Users, Copy
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/* ---------------- Tab definitions ---------------- */

const TABS = {
  vehicles: {
    id: 'vehicles',
    label: 'Vehicles',
    icon: Car,
    endpoint: '/vehicles/bulk-import',
    templateName: 'quick-wing-vehicles-template.csv',
    errorReportName: 'quick-wing-vehicle-errors.csv',
    successKey: 'created_vehicles',
    title: 'Bulk Import Vehicles',
    subtitle: 'Upload a CSV or Excel file to onboard a fleet in seconds',
    columns: ['name', 'registration', 'current_status', 'tax_due_date', 'nct_due_date', 'insurance_due_date', 'current_mileage', 'service_due_mileage', 'service_due_date', 'base_location'],
    sampleRows: [
      ['Ford Transit Van 2022', '12-D-12345', 'Free', '2026-12-01', '2026-08-15', '15000', '30000', '', 'Dublin North'],
      ['VW Caddy', '13-D-67890', 'Free', '2026-09-30', '', '8500', '', '2026-10-01', 'Dublin Central'],
    ],
    requiredHint: (
      <>
        Required: <code className="bg-white px-1.5 py-0.5 rounded text-slate-800">name</code>,{' '}
        <code className="bg-white px-1.5 py-0.5 rounded text-slate-800">registration</code>. Dates use{' '}
        <code className="bg-white px-1.5 py-0.5 rounded text-slate-800">YYYY-MM-DD</code>. Service due:
        provide either <code className="bg-white px-1.5 py-0.5 rounded text-slate-800">service_due_mileage</code>
        {' '}(km) or <code className="bg-white px-1.5 py-0.5 rounded text-slate-800">service_due_date</code>.
      </>
    ),
    successWord: (n) => `${n} vehicle${n === 1 ? '' : 's'} added to the fleet.`,
    errorColumns: ['row', 'name', 'registration', 'error'],
    errorRowMap: (e) => [e.row, e.name, e.registration, e.error],
    errorTableHead: ['Row', 'Registration', 'Error'],
    errorTableRow: (e) => [e.row, e.registration || '—', e.error],
  },
  staff: {
    id: 'staff',
    label: 'Staff',
    icon: Users,
    endpoint: '/users/bulk-import',
    templateName: 'quick-wing-staff-template.csv',
    errorReportName: 'quick-wing-staff-errors.csv',
    successKey: 'created_users',
    title: 'Bulk Import Staff',
    subtitle: 'Onboard drivers and admins with default credentials',
    columns: ['name', 'email', 'role'],
    sampleRows: [
      ['Alice Driver', 'alice@client.com', 'staff'],
      ['Bob Manager', 'bob@client.com', 'admin'],
      ['Carol Smith', 'carol@client.com', 'staff'],
    ],
    requiredHint: (
      <>
        Required: <code className="bg-white px-1.5 py-0.5 rounded text-slate-800">name</code>,{' '}
        <code className="bg-white px-1.5 py-0.5 rounded text-slate-800">email</code>. Role:{' '}
        <code className="bg-white px-1.5 py-0.5 rounded text-slate-800">staff</code>,{' '}
        <code className="bg-white px-1.5 py-0.5 rounded text-slate-800">admin</code>, or{' '}
        <code className="bg-white px-1.5 py-0.5 rounded text-slate-800">master_admin</code>{' '}
        (defaults to staff).
      </>
    ),
    successWord: (n) => `${n} user account${n === 1 ? '' : 's'} added to the tenant.`,
    errorColumns: ['row', 'name', 'email', 'error'],
    errorRowMap: (e) => [e.row, e.name, e.email, e.error],
    errorTableHead: ['Row', 'Email', 'Error'],
    errorTableRow: (e) => [e.row, e.email || '—', e.error],
  },
};

/* ---------------- Helpers ---------------- */

const buildCsvBlob = (rows) => {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = rows.map((r) => r.map(escape).join(',')).join('\n');
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/* ---------------- Modal ---------------- */

const BulkImportModal = ({ isOpen, onClose, onImported, defaultTab = 'vehicles' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);
  const tab = TABS[activeTab];

  if (!isOpen) return null;

  const reset = () => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (uploading) return;
    reset();
    onClose();
  };

  const switchTab = (tabId) => {
    if (uploading) return;
    setActiveTab(tabId);
    reset();
  };

  const downloadTemplate = () => {
    const blob = buildCsvBlob([tab.columns, ...tab.sampleRows]);
    downloadBlob(blob, tab.templateName);
  };

  const downloadErrorReport = () => {
    if (!result?.errors?.length) return;
    const rows = [tab.errorColumns, ...result.errors.map(tab.errorRowMap)];
    const blob = buildCsvBlob(rows);
    downloadBlob(blob, tab.errorReportName);
  };

  const copyAllCredentials = async () => {
    if (!result?.created_users?.length) return;
    const lines = [
      'email,name,role,temporary_password',
      ...result.created_users.map((u) => [
        u.email, u.name, u.role, u.temporary_password || '(existing account — unchanged)'
      ].join(',')),
    ];
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Credentials copied to clipboard');
    } catch {
      // Fallback — download instead
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, 'quick-wing-staff-credentials.csv');
      toast.success('Downloaded credentials.csv');
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const lower = f.name.toLowerCase();
    // Vehicles tab accepts CSV + Excel; Staff tab is CSV-only for now.
    const allowExcel = activeTab === 'vehicles';
    const ok = lower.endsWith('.csv') || (allowExcel && (lower.endsWith('.xlsx') || lower.endsWith('.xls')));
    if (!ok) {
      toast.error(allowExcel ? 'Please select a .csv, .xlsx or .xls file' : 'Please select a .csv file');
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error(activeTab === 'vehicles' ? 'Please choose a CSV or Excel file first' : 'Please choose a CSV file first');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await axios.post(`${API}${tab.endpoint}`, formData);
      setResult(resp.data);
      if (resp.data.succeeded > 0) {
        toast.success(`Imported ${resp.data.succeeded} of ${resp.data.total_rows} ${tab.label.toLowerCase()}`);
        onImported && onImported(activeTab);
      }
      if (resp.data.failed > 0) {
        toast.warning(`${resp.data.failed} row(s) failed — see details below`);
      }
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Upload failed';
      toast.error(detail);
    } finally {
      setUploading(false);
    }
  };

  const successList = result ? (result[tab.successKey] || []) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      data-testid="bulk-import-modal"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900" data-testid="bulk-import-title">
                {tab.title}
              </h2>
              <p className="text-xs text-slate-500">{tab.subtitle}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            data-testid="bulk-import-close-btn"
            aria-label="Close"
          >
            <X size={20} className="text-slate-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-slate-200 bg-white" data-testid="bulk-import-tabs">
          <div className="flex gap-1">
            {Object.values(TABS).map((t) => {
              const TabIcon = t.icon;
              const isActive = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  onClick={() => switchTab(t.id)}
                  data-testid={`bulk-import-tab-${t.id}`}
                  disabled={uploading}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors disabled:opacity-50 ${
                    isActive
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <TabIcon size={16} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!result && (
            <>
              {/* Step 1 — template */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                    1
                  </span>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">
                      Download the template
                    </h3>
                    <p className="text-xs text-slate-600 mb-3">{tab.requiredHint}</p>
                    <button
                      onClick={downloadTemplate}
                      data-testid="download-template-btn"
                      className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <Download size={14} />
                      Download CSV template
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2 — upload */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                    2
                  </span>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">
                      Upload your filled CSV
                    </h3>
                    <label
                      htmlFor="bulk-import-file"
                      className="block border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer bg-white transition-colors"
                    >
                      <Upload className="mx-auto text-slate-400 mb-2" size={28} />
                      <p className="text-sm font-medium text-slate-700">
                        {file ? file.name : (activeTab === 'vehicles' ? 'Click to choose a CSV or Excel file' : 'Click to choose a CSV file')}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {file ? `${(file.size / 1024).toFixed(1)} KB` : (activeTab === 'vehicles' ? 'CSV, XLSX or XLS \u2014 max 5 MB' : 'Max 5 MB')}
                      </p>
                      <input
                        id="bulk-import-file"
                        ref={fileInputRef}
                        type="file"
                        accept={activeTab === 'vehicles' ? '.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel' : '.csv,text/csv'}
                        onChange={handleFileChange}
                        className="hidden"
                        data-testid="bulk-import-file-input"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Staff-only: notice about default password */}
              {activeTab === 'staff' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-900">
                  <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p>
                    All new accounts will be created with the default password{' '}
                    <code className="bg-white px-1.5 py-0.5 rounded font-mono">QuickWing123!</code>{' '}
                    and will be required to change it on first login.
                  </p>
                </div>
              )}
            </>
          )}

          {result && (
            <div data-testid="bulk-import-result">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-slate-900">{result.total_rows}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Total rows</div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-700">{result.succeeded}</div>
                  <div className="text-xs text-emerald-600 mt-0.5">Imported</div>
                </div>
                <div className={`${result.failed ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'} border rounded-xl p-4 text-center`}>
                  <div className={`text-2xl font-bold ${result.failed ? 'text-rose-700' : 'text-slate-400'}`}>
                    {result.failed}
                  </div>
                  <div className={`text-xs mt-0.5 ${result.failed ? 'text-rose-600' : 'text-slate-500'}`}>Failed</div>
                </div>
              </div>

              {/* Success message */}
              {result.succeeded > 0 && (
                <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
                  <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-emerald-800">{tab.successWord(result.succeeded)}</p>
                </div>
              )}

              {/* Staff-only: invitation email status */}
              {activeTab === 'staff' && (typeof result.emails_sent === 'number' || typeof result.emails_failed === 'number') && (
                <div
                  className={`flex items-start gap-2 border rounded-xl p-3 mb-4 ${
                    (result.emails_failed || 0) > 0
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-blue-50 border-blue-200 text-blue-800'
                  }`}
                  data-testid="bulk-import-email-status"
                >
                  <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
                  <p className="text-sm">
                    Invitation emails — sent <strong>{result.emails_sent || 0}</strong>
                    {(result.emails_failed || 0) > 0 && (
                      <>, failed <strong>{result.emails_failed}</strong> (share credentials below manually)</>
                    )}
                    .
                  </p>
                </div>
              )}

              {/* Staff-only: credentials table */}
              {activeTab === 'staff' && successList.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      New credentials ({successList.length})
                    </h3>
                    <button
                      onClick={copyAllCredentials}
                      data-testid="copy-credentials-btn"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Copy size={12} />
                      Copy all credentials
                    </button>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-600 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Email</th>
                            <th className="px-3 py-2 text-left font-medium">Role</th>
                            <th className="px-3 py-2 text-left font-medium">Temp password</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {successList.map((u, i) => (
                            <tr key={i} className="bg-white">
                              <td className="px-3 py-2 text-slate-700">{u.email}</td>
                              <td className="px-3 py-2 text-slate-500 capitalize">{u.role}</td>
                              <td className="px-3 py-2">
                                {u.temporary_password ? (
                                  <code className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                                    {u.temporary_password}
                                  </code>
                                ) : (
                                  <span className="text-slate-400 italic">existing account</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Users will be required to change their password on first login.
                  </p>
                </div>
              )}

              {/* Errors table */}
              {result.errors && result.errors.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-rose-600" />
                      <h3 className="text-sm font-semibold text-slate-900">
                        {result.errors.length} row{result.errors.length === 1 ? '' : 's'} skipped
                      </h3>
                    </div>
                    <button
                      onClick={downloadErrorReport}
                      data-testid="download-error-report-btn"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Download size={12} />
                      Download error report
                    </button>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 text-slate-600 sticky top-0">
                          <tr>
                            {tab.errorTableHead.map((h, i) => (
                              <th key={i} className="px-3 py-2 text-left font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {result.errors.map((e, i) => {
                            const cells = tab.errorTableRow(e);
                            return (
                              <tr key={i} className="bg-white">
                                <td className="px-3 py-2 font-mono text-slate-500">{cells[0]}</td>
                                <td className="px-3 py-2 text-slate-700">{cells[1]}</td>
                                <td className="px-3 py-2 text-rose-700">{cells[2]}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3 bg-slate-50">
          {!result ? (
            <>
              <button
                onClick={handleClose}
                disabled={uploading}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                data-testid="bulk-import-cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                data-testid="bulk-import-upload-btn"
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Upload &amp; Import
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={reset}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                data-testid="bulk-import-another-btn"
              >
                Import another file
              </button>
              <button
                onClick={handleClose}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                data-testid="bulk-import-done-btn"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Backward-compat export — Admin.js still imports this name.
export const BulkImportVehiclesModal = BulkImportModal;
export default BulkImportModal;
