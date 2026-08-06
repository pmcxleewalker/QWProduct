import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  FileText, ClipboardList, ClipboardCheck, Plus, Edit2, Trash2, Eye, X, GripVertical,
  Save, FileDown, Image as ImageIcon, Loader2, AlertCircle, Search, ChevronRight,
  Power, PowerOff
} from 'lucide-react';
import EmptyState from './EmptyState';
import { useConfirm } from './ConfirmDialog';
import { useEscapeClose } from '../hooks/useEscapeClose';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ICON_MAP = { FileText, ClipboardList, ClipboardCheck };
const FIELD_TYPES = [
  { value: 'text', label: 'Single line text' },
  { value: 'textarea', label: 'Multi-line text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'vehicle', label: 'Vehicle (auto)' },
  { value: 'image', label: 'Image upload (JPG/PNG)' },
];

const getAuthHeaders = () => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const slugifyKey = (label) =>
  (label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'field';

// ============== Template Editor Modal ==============
const TemplateEditorModal = ({ template, onClose, onSaved }) => {
  useEscapeClose(true, onClose);
  const isEdit = Boolean(template?.id);
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [icon, setIcon] = useState(template?.icon || 'FileText');
  const [fields, setFields] = useState(
    template?.fields?.length
      ? template.fields.map((f) => ({ ...f, _id: f.key }))
      : []
  );
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const addField = () => {
    setFields((prev) => [
      ...prev,
      { _id: `tmp_${Date.now()}`, key: '', label: '', type: 'text', required: false, placeholder: '', options: [] },
    ]);
  };
  const updateField = (idx, patch) =>
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  const removeField = (idx) =>
    setFields((prev) => prev.filter((_, i) => i !== idx));
  const moveField = (idx, dir) =>
    setFields((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Give the document a name.');
      return;
    }
    if (fields.length === 0) {
      toast.error('Add at least one field.');
      return;
    }

    const cleanedFields = fields.map((f) => ({
      key: f.key?.trim() || slugifyKey(f.label),
      label: f.label?.trim(),
      type: f.type,
      required: !!f.required,
      placeholder: f.placeholder || '',
      help_text: f.help_text || '',
      options: f.type === 'select'
        ? (Array.isArray(f.options) ? f.options : (f.options || '').split(',').map((s) => s.trim()).filter(Boolean))
        : [],
      max_images: f.type === 'image'
        ? Math.max(1, Math.min(5, parseInt(f.max_images ?? 1, 10) || 1))
        : undefined,
    }));

    try {
      setSaving(true);
      const body = { name: name.trim(), description: description.trim(), icon, fields: cleanedFields, is_active: isActive };
      if (isEdit) {
        await axios.put(`${API}/documents/templates/${template.id}`, body, { headers: getAuthHeaders() });
        toast.success('Template updated');
      } else {
        await axios.post(`${API}/documents/templates`, body, { headers: getAuthHeaders() });
        toast.success('Template created');
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full my-8 overflow-hidden flex flex-col max-h-[90vh]" data-testid="template-editor-modal">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isEdit ? 'Edit document template' : 'New document template'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Design a form for your staff to submit.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100" data-testid="template-editor-close">
            <X size={18} className="text-slate-600" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pre-trip vehicle check"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                data-testid="template-name-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Icon</label>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="FileText">Document</option>
                <option value="ClipboardList">Checklist</option>
                <option value="ClipboardCheck">Inspection</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this form for?"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2 pt-1">
              <input
                id="tpl-is-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="tpl-is-active" className="text-sm text-slate-700">
                Visible to staff
              </label>
            </div>
          </div>

          {/* Fields */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-900">Form fields</h3>
              <button
                onClick={addField}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
                data-testid="template-add-field-btn"
              >
                <Plus size={14} /> Add field
              </button>
            </div>

            {fields.length === 0 && (
              <div className="text-center py-8 border border-dashed border-slate-300 rounded-xl">
                <p className="text-sm text-slate-500">No fields yet. Click &ldquo;Add field&rdquo; to start.</p>
              </div>
            )}

            <div className="space-y-3">
              {fields.map((f, idx) => (
                <div key={f._id || idx} className="border border-slate-200 rounded-xl p-3 bg-slate-50" data-testid={`template-field-${idx}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col gap-0.5 pt-1.5">
                      <button onClick={() => moveField(idx, -1)} className="text-slate-400 hover:text-slate-700" title="Move up">
                        <GripVertical size={14} />
                      </button>
                    </div>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
                        <input
                          type="text"
                          value={f.label}
                          onChange={(e) => updateField(idx, { label: e.target.value, key: f.key || slugifyKey(e.target.value) })}
                          placeholder="e.g. Tyre pressure"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Field type</label>
                        <select
                          value={f.type}
                          onChange={(e) => updateField(idx, { type: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          {FIELD_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      {f.type === 'select' && (
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Options (comma-separated)</label>
                          <input
                            type="text"
                            value={Array.isArray(f.options) ? f.options.join(', ') : (f.options || '')}
                            onChange={(e) => updateField(idx, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                            placeholder="Option 1, Option 2, Option 3"
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}
                      {f.type === 'image' && (
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Max photos (1–5)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={5}
                            value={f.max_images ?? 1}
                            onChange={(e) => {
                              const n = Math.max(1, Math.min(5, parseInt(e.target.value, 10) || 1));
                              updateField(idx, { max_images: n });
                            }}
                            className="w-24 px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                            data-testid={`template-field-max-images-${idx}`}
                          />
                          <p className="text-[11px] text-slate-500 mt-1">
                            Staff can attach up to this many photos for this field.
                          </p>
                        </div>
                      )}
                      {!['checkbox', 'vehicle', 'image'].includes(f.type) && (
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Placeholder</label>
                          <input
                            type="text"
                            value={f.placeholder || ''}
                            onChange={(e) => updateField(idx, { placeholder: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          id={`req-${idx}`}
                          type="checkbox"
                          checked={f.required}
                          onChange={(e) => updateField(idx, { required: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor={`req-${idx}`} className="text-xs text-slate-700">Required</label>
                      </div>
                    </div>
                    <button
                      onClick={() => removeField(idx)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md"
                      title="Remove field"
                      data-testid={`template-field-remove-${idx}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
            data-testid="template-save-btn"
          >
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create template')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============== Submissions Drawer ==============
const SubmissionsView = ({ template, onBack }) => {
  const confirm = useConfirm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/documents/submissions`, {
        headers: getAuthHeaders(),
        params: { template_id: template.id, limit: 200 },
      });
      setItems(res.data.items || []);
    } catch (err) {
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [template.id]);

  const filtered = items.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (s.vehicle_registration || '').toLowerCase().includes(q) ||
      (s.submitted_by_name || '').toLowerCase().includes(q) ||
      (s.submitted_by_email || '').toLowerCase().includes(q)
    );
  });

  const handleDelete = async (id) => {
    if (!await confirm({
      title: 'Delete submission?',
      description: 'This permanently removes this entry. Cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })) return;
    try {
      await axios.delete(`${API}/documents/submissions/${id}`, { headers: getAuthHeaders() });
      toast.success('Submission deleted');
      setSelected(null);
      load();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-4" data-testid="submissions-view">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <button onClick={onBack} className="text-blue-700 hover:underline">← All documents</button>
          <ChevronRight size={14} className="text-slate-400" />
          <span className="font-medium text-slate-900">{template.name}</span>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vehicle / staff…"
            className="pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 w-56"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500"><Loader2 className="animate-spin inline mr-2" size={14} />Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              compact
              icon={Eye}
              title="No submissions yet"
              description="Submissions from staff using this template will appear here."
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Vehicle</th>
                <th className="px-4 py-2.5">Staff</th>
                <th className="px-4 py-2.5">Photos</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-700">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-slate-700">{s.vehicle_registration || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-700">{s.submitted_by_name || s.submitted_by_email}</td>
                  <td className="px-4 py-2.5 text-slate-500">{(s.photos || []).length}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => setSelected(s)} className="text-blue-700 hover:underline text-xs font-medium">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <SubmissionDetailModal
          submission={selected}
          template={template}
          onClose={() => setSelected(null)}
          onDelete={() => handleDelete(selected.id)}
        />
      )}
    </div>
  );
};

const SubmissionDetailModal = ({ submission, template, onClose, onDelete }) => {
  useEscapeClose(true, onClose);
  return (
  <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" data-testid="submission-detail-modal">
      <div className="p-5 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{template.name} — submission</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {new Date(submission.created_at).toLocaleString()} · {submission.submitted_by_name || submission.submitted_by_email}
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
          <X size={18} className="text-slate-600" />
        </button>
      </div>
      <div className="p-5 overflow-y-auto space-y-3">
        {(template.fields || []).map((field) => {
          const value = submission.data?.[field.key];
          let display = value;
          if (field.type === 'image') {
            const imgs = Array.isArray(value) ? value : (value ? [value] : []);
            if (imgs.length === 0) {
              display = <span className="text-slate-400">No image</span>;
            } else {
              display = (
                <div className="grid grid-cols-2 gap-2">
                  {imgs.map((src, i) => (
                    <img key={i} src={src} alt={field.label} className="w-full h-32 object-cover rounded-lg border border-slate-200" />
                  ))}
                </div>
              );
            }
          } else if (field.type === 'checkbox') {
            display = value ? 'Yes' : 'No';
          } else if (field.type === 'vehicle') {
            display = submission.vehicle_registration || (typeof value === 'object' ? value?.registration : value) || '—';
          } else if (value === null || value === undefined || value === '') {
            display = <span className="text-slate-400">—</span>;
          }
          return (
            <div key={field.key} className="border-b border-slate-100 pb-2.5 last:border-0">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">{field.label}</div>
              <div className="text-sm text-slate-800">{display}</div>
            </div>
          );
        })}
      </div>
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between">
        <button onClick={onDelete} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50 rounded-lg">
          <Trash2 size={14} /> Delete
        </button>
        <button onClick={onClose} className="px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg">
          Close
        </button>
      </div>
    </div>
  </div>
  );
};

// ============== Documents Inbox (all submissions, all templates) ==============

const dateBucket = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const y = new Date(t.getTime() - 24 * 60 * 60 * 1000);
  const weekStart = new Date(t.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dOnly.getTime() === t.getTime()) return { key: 'today', label: 'Today' };
  if (dOnly.getTime() === y.getTime()) return { key: 'yesterday', label: 'Yesterday' };
  if (dOnly >= weekStart) return { key: 'this-week', label: 'Earlier this week' };
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  if (dOnly >= thisMonth) return { key: 'this-month', label: 'Earlier this month' };
  const y2 = d.getFullYear();
  return { key: `older-${y2}-${d.getMonth()}`, label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
};

const DocumentsInbox = ({ templates, onOpen }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [templateFilter, setTemplateFilter] = useState(''); // template_id

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (templateFilter) params.template_id = templateFilter;
      if (search.trim()) params.q = search.trim();
      const res = await axios.get(`${API}/documents/submissions`, {
        headers: getAuthHeaders(),
        params,
      });
      setItems(res.data.items || []);
    } catch (err) {
      // silent — inbox is best-effort
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateFilter]);

  // Debounced search
  useEffect(() => {
    const h = setTimeout(load, 250);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const grouped = React.useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const b = dateBucket(it.created_at);
      if (!map.has(b.key)) map.set(b.key, { label: b.label, rows: [] });
      map.get(b.key).rows.push(it);
    }
    return Array.from(map.entries()); // preserves insertion order (newest first)
  }, [items]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden" data-testid="documents-inbox">
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FileText size={16} className="text-blue-600" /> Documents Inbox
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Every submission from your team, newest first.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={templateFilter}
            onChange={(e) => setTemplateFilter(e.target.value)}
            className="px-2.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
            data-testid="inbox-template-filter"
          >
            <option value="">All document types</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff, vehicle, doc…"
              className="pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 w-56"
              data-testid="inbox-search-input"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-slate-500">
          <Loader2 className="animate-spin inline mr-2" size={14} /> Loading inbox…
        </div>
      ) : items.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500" data-testid="inbox-empty">
          {search || templateFilter
            ? 'No submissions match your filter.'
            : 'No submissions yet. Staff submissions will land here.'}
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {grouped.map(([key, group]) => (
            <div key={key} data-testid={`inbox-group-${key}`}>
              <div className="px-4 py-2 bg-slate-50/60 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {group.label} · {group.rows.length}
              </div>
              <ul>
                {group.rows.map((s) => {
                  const time = new Date(s.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                  const dateShort = new Date(s.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
                  const photos = Array.isArray(s.photos) ? s.photos.length : 0;
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => onOpen(s)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50/40 transition-colors flex items-center gap-3"
                        data-testid={`inbox-item-${s.id}`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
                          <FileText size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-sm text-slate-900 truncate">{s.template_name || 'Document'}</span>
                            {photos > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                                <ImageIcon size={10} /> {photos}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 truncate">
                            {(s.submitted_by_name || s.submitted_by_email || 'Someone')}
                            {s.vehicle_registration ? <> · <span className="font-mono">{s.vehicle_registration}</span></> : null}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 flex-shrink-0 text-right">
                          <div>{time}</div>
                          <div className="text-[10px] text-slate-400">{dateShort}</div>
                        </div>
                        <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============== Top-level Admin Component ==============
const CustomDocumentsAdmin = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [viewingSubmissionsFor, setViewingSubmissionsFor] = useState(null);
  const [selectedInboxSubmission, setSelectedInboxSubmission] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/documents/templates?include_inactive=true`, {
        headers: getAuthHeaders(),
      });
      setTemplates(res.data || []);
    } catch (err) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async (tpl) => {
    if (!await confirm({
      title: `Delete "${tpl.name}"?`,
      description: 'Existing submissions for this template will be kept and remain visible.',
      confirmLabel: 'Delete template',
      tone: 'danger',
    })) return;
    try {
      await axios.delete(`${API}/documents/templates/${tpl.id}`, { headers: getAuthHeaders() });
      toast.success('Template deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleToggleActive = async (tpl) => {
    try {
      await axios.put(`${API}/documents/templates/${tpl.id}`, { is_active: !tpl.is_active }, { headers: getAuthHeaders() });
      toast.success(`${tpl.is_active ? 'Hidden from' : 'Shown to'} staff`);
      load();
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  if (viewingSubmissionsFor) {
    return <SubmissionsView template={viewingSubmissionsFor} onBack={() => setViewingSubmissionsFor(null)} />;
  }

  return (
    <div className="space-y-4" data-testid="documents-admin">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Custom Documents</h2>
          <p className="text-sm text-slate-500">Design forms for your staff to submit (e.g. Car Inspection Sheet, Pre-trip check).</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          data-testid="documents-new-btn"
        >
          <Plus size={14} /> New template
        </button>
      </div>

      {/* Documents Inbox — all recent submissions across all templates */}
      <DocumentsInbox
        templates={templates}
        onOpen={(s) => setSelectedInboxSubmission(s)}
      />

      {loading ? (
        <div className="text-center py-10 text-sm text-slate-500"><Loader2 className="animate-spin inline mr-2" size={14} />Loading…</div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No templates yet"
          description="Build a custom form for your staff (e.g. pre-trip check, mileage log) and it'll appear here."
          action={
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={14} /> Create your first template
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => {
            const Icon = ICON_MAP[tpl.icon] || FileText;
            return (
              <div
                key={tpl.id}
                className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                data-testid={`template-card-${tpl.id}`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tpl.is_active ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-slate-900 truncate">{tpl.name}</h3>
                      {!tpl.is_active && (
                        <span className="text-[10px] uppercase tracking-wider font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Hidden</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{tpl.description || `${tpl.fields?.length || 0} fields`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setViewingSubmissionsFor(tpl)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md"
                    data-testid={`template-view-submissions-${tpl.id}`}
                  >
                    <Eye size={13} /> Submissions
                  </button>
                  <button
                    onClick={() => setEditing(tpl)}
                    className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md"
                    title="Edit"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleToggleActive(tpl)}
                    className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md"
                    title={tpl.is_active ? 'Hide from staff' : 'Show to staff'}
                  >
                    {tpl.is_active ? <PowerOff size={13} /> : <Power size={13} />}
                  </button>
                  <button
                    onClick={() => handleDelete(tpl)}
                    className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-md"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <TemplateEditorModal
          template={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={load}
        />
      )}

      {/* Inbox item detail — reuse the existing detail modal */}
      {selectedInboxSubmission && (() => {
        const tpl = templates.find((t) => t.id === selectedInboxSubmission.template_id) || {
          name: selectedInboxSubmission.template_name || 'Document',
          fields: [],
        };
        return (
          <SubmissionDetailModal
            submission={selectedInboxSubmission}
            template={tpl}
            onClose={() => setSelectedInboxSubmission(null)}
            onDelete={async () => {
              try {
                await axios.delete(
                  `${API}/documents/submissions/${selectedInboxSubmission.id}`,
                  { headers: getAuthHeaders() }
                );
                toast.success('Submission deleted');
                setSelectedInboxSubmission(null);
                load();
              } catch (err) {
                toast.error('Failed to delete');
              }
            }}
          />
        );
      })()}
    </div>
  );
};

export default CustomDocumentsAdmin;
