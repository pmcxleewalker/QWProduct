import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  FileText, Fuel, ClipboardList, ChevronRight, X, Loader2, Camera, Send,
  Upload, AlertCircle, CheckCircle2
} from 'lucide-react';
import IncidentReportsSection from './IncidentReportsSection';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ICON_MAP = { FileText, Fuel, ClipboardList };

const getAuthHeaders = () => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Compress an image File to base64 data-URL (max ~1280px wide, jpeg quality 0.8)
const fileToCompressedDataUrl = (file, maxDim = 1280, quality = 0.8) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        const ratio = Math.min(maxDim / Math.max(width, height), 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

const SubmitDocumentForm = ({ template, vehicles, onClose, onSubmitted }) => {
  const [data, setData] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const setField = (key, value) => setData((prev) => ({ ...prev, [key]: value }));

  const handleImage = async (key, fileList, multiple = false, cap = 1) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;
    try {
      const urls = await Promise.all(files.map((f) => fileToCompressedDataUrl(f)));
      if (multiple) {
        const current = Array.isArray(data[key]) ? data[key] : (data[key] ? [data[key]] : []);
        setField(key, [...current, ...urls].slice(0, cap));
      } else {
        setField(key, urls[0]);
      }
    } catch (err) {
      toast.error('Failed to read image');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Convert vehicle field — staff can pick from a dropdown of registrations.
      const payloadData = { ...data };
      const vehField = template.fields.find((f) => f.type === 'vehicle');
      if (vehField && payloadData[vehField.key]) {
        const v = vehicles.find((x) => x.id === payloadData[vehField.key]);
        if (v) payloadData[vehField.key] = { id: v.id, registration: v.registration };
      }
      await axios.post(
        `${API}/documents/submissions`,
        { template_id: template.id, data: payloadData },
        { headers: getAuthHeaders() }
      );
      toast.success(`${template.name} submitted`);
      onSubmitted?.();
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to submit';
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-end sm:items-center justify-center" data-testid="submit-document-modal">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{template.name}</h2>
            {template.description && <p className="text-xs text-slate-500 mt-0.5">{template.description}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X size={18} className="text-slate-600" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {(template.fields || []).map((field) => {
            const v = data[field.key];
            return (
              <div key={field.key} data-testid={`field-${field.key}`}>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {field.label}
                  {field.required && <span className="text-rose-600 ml-0.5">*</span>}
                </label>
                {field.help_text && <p className="text-xs text-slate-500 mb-1.5">{field.help_text}</p>}

                {field.type === 'text' && (
                  <input
                    type="text"
                    value={v || ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={field.placeholder || ''}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                )}
                {field.type === 'textarea' && (
                  <textarea
                    value={v || ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    rows={3}
                    placeholder={field.placeholder || ''}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                )}
                {field.type === 'number' && (
                  <input
                    type="number"
                    inputMode="decimal"
                    value={v ?? ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={field.placeholder || ''}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                )}
                {field.type === 'date' && (
                  <input
                    type="date"
                    value={v || ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                )}
                {field.type === 'time' && (
                  <input
                    type="time"
                    value={v || ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                )}
                {field.type === 'select' && (
                  <select
                    value={v || ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose…</option>
                    {(field.options || []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
                {field.type === 'checkbox' && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!v}
                      onChange={(e) => setField(field.key, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">Yes</span>
                  </label>
                )}
                {field.type === 'vehicle' && (
                  <select
                    value={v || ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose vehicle…</option>
                    {vehicles.map((vh) => (
                      <option key={vh.id} value={vh.id}>
                        {vh.registration} {vh.make ? `· ${vh.make} ${vh.model || ''}` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {field.type === 'image' && (() => {
                  const cap = Math.max(1, Math.min(5, parseInt(field.max_images ?? 1, 10) || 1));
                  const multi = cap > 1;
                  const imgs = multi
                    ? (Array.isArray(v) ? v : (v ? [v] : []))
                    : (v ? [v] : []);
                  const canAddMore = imgs.length < cap;
                  return (
                    <div className="flex flex-col gap-2">
                      {canAddMore && (
                        <label className="inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 cursor-pointer">
                          <Camera size={16} />
                          {imgs.length === 0
                            ? (multi ? `Take or upload photo (up to ${cap})` : 'Take or upload photo')
                            : `Add another photo (${imgs.length}/${cap})`}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/jpg,image/webp"
                            capture="environment"
                            multiple={multi}
                            className="hidden"
                            onChange={(e) => handleImage(field.key, e.target.files, multi, cap)}
                            data-testid={`field-${field.key}-input`}
                          />
                        </label>
                      )}
                      {imgs.length > 0 && (
                        <div className={multi ? 'grid grid-cols-2 gap-2' : ''}>
                          {imgs.map((src, i) => (
                            <div key={i} className="relative">
                              <img src={src} alt="preview" className={multi ? 'w-full h-28 object-cover rounded-lg border border-slate-200' : 'w-full h-40 object-cover rounded-lg border border-slate-200'} />
                              <button
                                onClick={() => {
                                  if (multi) {
                                    const next = imgs.filter((_, j) => j !== i);
                                    setField(field.key, next);
                                  } else {
                                    setField(field.key, null);
                                  }
                                }}
                                className="absolute top-1.5 right-1.5 p-1 bg-white/90 rounded-md hover:bg-white shadow"
                                title="Remove"
                                data-testid={`field-${field.key}-remove-${i}`}
                              >
                                <X size={12} className="text-slate-700" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
            data-testid="submit-document-btn"
          >
            {submitting ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
};

const CustomDocumentsStaff = () => {
  const [templates, setTemplates] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [tplRes, vehRes] = await Promise.all([
        axios.get(`${API}/documents/templates`, { headers: getAuthHeaders() }),
        axios.get(`${API}/vehicles`, { headers: getAuthHeaders() }).catch(() => ({ data: [] })),
      ]);
      setTemplates(tplRes.data || []);
      setVehicles(vehRes.data || []);
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  if (loading) {
    return <div className="py-6 text-center text-sm text-slate-500"><Loader2 className="animate-spin inline mr-2" size={14} />Loading documents…</div>;
  }

  return (
    <div className="space-y-3" data-testid="staff-documents-list">
      {/* Incident report — always shown so staff can log damage/accidents/breakdowns */}
      <IncidentReportsSection mode="staff" />

      {/* Section divider when there are also custom templates */}
      {templates.length > 0 && (
        <div className="pt-2 pb-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Other documents
          </p>
        </div>
      )}

      {templates.map((tpl) => {
        const Icon = ICON_MAP[tpl.icon] || FileText;
        return (
          <button
            key={tpl.id}
            onClick={() => setActive(tpl)}
            className="w-full flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all text-left"
            data-testid={`staff-document-${tpl.id}`}
          >
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
              <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-slate-900 truncate">{tpl.name}</div>
              <div className="text-xs text-slate-500 truncate">
                {tpl.description || `${tpl.fields?.length || 0} fields to fill in`}
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400 flex-shrink-0" />
          </button>
        );
      })}

      {active && (
        <SubmitDocumentForm
          template={active}
          vehicles={vehicles}
          onClose={() => setActive(null)}
          onSubmitted={load}
        />
      )}
    </div>
  );
};

export default CustomDocumentsStaff;
