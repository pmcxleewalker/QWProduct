import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Scale, Save, Lock, Building, Hash, MapPin, FileText, Globe, Github, Server, Calendar, Rocket, Users, ShieldCheck, FileSignature, AlertTriangle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const FIELDS = [
  { key: 'company_legal_name', label: 'Company legal name', icon: Building, placeholder: 'QuickFleet Limited' },
  { key: 'company_registration_number', label: 'Company registration number', icon: Hash, placeholder: 'e.g. IE123456' },
  { key: 'registered_address', label: 'Registered address', icon: MapPin, placeholder: 'Street, City, County, Eircode', textarea: true },
  { key: 'trading_product_name', label: 'Trading / product name', icon: FileText, placeholder: 'Quick Wing' },
  { key: 'trademark_status', label: 'Trademark status', icon: ShieldCheck, placeholder: 'e.g. Pending / Registered / Not filed' },
  { key: 'trademark_reference_number', label: 'Trademark application / reference number', icon: Hash, placeholder: 'e.g. EUIPO 0123456789' },
  { key: 'domain_name_records', label: 'Domain name records', icon: Globe, placeholder: 'quick-wing.com (registrar, expiry)…', textarea: true },
  { key: 'github_repository_link', label: 'GitHub repository link', icon: Github, placeholder: 'https://github.com/…' },
  { key: 'hosting_provider', label: 'Hosting provider', icon: Server, placeholder: 'Render + MongoDB Atlas' },
  { key: 'date_of_first_creation', label: 'Date of first creation', icon: Calendar, placeholder: 'YYYY-MM-DD' },
  { key: 'date_of_first_launch', label: 'Date of first launch', icon: Rocket, placeholder: 'YYYY-MM-DD' },
  { key: 'developer_contributor_records', label: 'Developer / contributor records', icon: Users, placeholder: 'Names, roles, dates of contribution', textarea: true },
  { key: 'ip_assignment_status', label: 'IP assignment status', icon: ShieldCheck, placeholder: 'e.g. All IP assigned to QuickFleet Limited (signed YYYY-MM-DD)', textarea: true },
  { key: 'contract_upload_reference_notes', label: 'Contract upload / reference notes', icon: FileSignature, placeholder: 'Reference numbers, drive links, or notes', textarea: true },
];

const emptyRecord = FIELDS.reduce((a, f) => ({ ...a, [f.key]: '' }), {});

const LegalRecordsSection = ({ token, isSuperAdmin }) => {
  const [record, setRecord] = useState(emptyRecord);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API}/platform/legal-records`, { headers });
        setRecord({ ...emptyRecord, ...res.data });
        setError('');
      } catch (err) {
        const detail = err.response?.data?.detail || 'Failed to load legal records';
        setError(detail);
      } finally {
        setLoading(false);
      }
    };
    if (isSuperAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isSuperAdmin]);

  const handleChange = (key, value) => {
    setRecord((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`${API}/platform/legal-records`, record, { headers });
      toast.success('Legal records saved');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to save legal records';
      toast.error(detail);
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="bg-white border border-amber-200 rounded-xl p-6 flex items-start gap-3">
        <Lock className="text-amber-600 mt-0.5" size={20} />
        <div>
          <h3 className="font-semibold text-slate-900">Restricted area</h3>
          <p className="text-sm text-slate-600 mt-1">
            Legal Records are accessible to Super Admins only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="legal-records-section">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
              <Scale size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Legal Records</h2>
              <p className="text-sm text-slate-300 mt-0.5 max-w-xl">
                Confidential, super-admin-only ledger of QuickFleet Limited's
                corporate, IP, and contractual records. Used for due diligence
                and audits.
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            data-testid="legal-records-save-btn"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-900 rounded-lg font-medium text-sm hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            <Save size={16} />
            {saving ? 'Saving…' : 'Save records'}
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex items-start gap-3">
        <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold">Disclaimer: </strong>
          This content is a template and should be reviewed by a qualified
          solicitor before being used as final legal documentation.
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FIELDS.map(({ key, label, icon: Icon, placeholder, textarea }) => (
              <div
                key={key}
                className={textarea ? 'md:col-span-2' : ''}
                data-testid={`legal-record-field-${key}`}
              >
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                  <Icon size={14} className="text-slate-400" />
                  {label}
                </label>
                {textarea ? (
                  <textarea
                    rows={3}
                    value={record[key] || ''}
                    onChange={(e) => handleChange(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : (
                  <input
                    type="text"
                    value={record[key] || ''}
                    onChange={(e) => handleChange(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 text-center">
        © 2026 QuickFleet Limited. Quick Wing is a product of QuickFleet
        Limited. All rights reserved.
      </p>
    </div>
  );
};

export default LegalRecordsSection;
