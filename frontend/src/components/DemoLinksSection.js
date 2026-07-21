import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Zap, Plus, Copy, Trash2, Clock, ExternalLink, User, Mail, Loader2 } from 'lucide-react';
import { demoAPI } from '../api/api';

/**
 * DemoLinksSection
 * ----------------
 * Super/master admin console for magic-link demo URLs.
 *
 *  - Left column: "Generate new link" form (prospect name, optional email,
 *    validity in days) → creates a shareable URL a prospect can open with no
 *    signup, no password. Lands them straight in the seeded Quick Wing Demo
 *    Ltd tenant.
 *  - Right column: table of every link ever created + status (Active /
 *    Expired / Revoked), use count, last used, and Copy / Revoke actions.
 */
const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};
const fmtRelative = (iso) => {
  if (!iso) return '—';
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  if (diff < 0) return 'in the future';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return fmtDate(iso);
};

const rowStatus = (row) => {
  if (row.revoked_at) return { label: 'Revoked', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return { label: 'Expired', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
  }
  return { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
};

const DemoLinksSection = () => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ prospect_name: '', prospect_email: '', expires_in_days: 14 });
  const [justCreated, setJustCreated] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await demoAPI.list();
      setLinks(res.data || []);
    } catch (e) {
      toast.error('Could not load demo links');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onCreate = async (e) => {
    e.preventDefault();
    if (!form.prospect_name.trim()) {
      toast.error('Please enter a prospect name');
      return;
    }
    setCreating(true);
    try {
      const res = await demoAPI.create({
        prospect_name: form.prospect_name.trim(),
        prospect_email: form.prospect_email.trim(),
        expires_in_days: Number(form.expires_in_days) || 14,
      });
      setJustCreated(res.data);
      setForm({ prospect_name: '', prospect_email: '', expires_in_days: 14 });
      await load();
      toast.success('Demo link created — copied to clipboard');
      try {
        await navigator.clipboard.writeText(res.data.url);
      } catch { /* clipboard may be blocked; user can copy manually */ }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to create demo link');
    } finally {
      setCreating(false);
    }
  };

  const onCopy = async (row) => {
    try {
      await navigator.clipboard.writeText(row.url);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy — select and copy manually');
    }
  };

  const onRevoke = async (row) => {
    if (!window.confirm(`Revoke the demo link for "${row.prospect_name}"? It will stop working immediately.`)) return;
    try {
      await demoAPI.revoke(row.id);
      toast.success('Link revoked');
      await load();
    } catch {
      toast.error('Could not revoke link');
    }
  };

  return (
    <div className="grid lg:grid-cols-5 gap-6" data-testid="demo-links-section">
      {/* Left — creator */}
      <div className="lg:col-span-2">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-9 w-9 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center">
              <Zap size={18} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">New demo link</h3>
              <p className="text-xs text-slate-500">One-click, no signup, no password</p>
            </div>
          </div>

          <form onSubmit={onCreate} className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <User size={12} /> Prospect name *
              </span>
              <input
                type="text"
                value={form.prospect_name}
                onChange={(e) => setForm((f) => ({ ...f, prospect_name: e.target.value }))}
                required
                placeholder="e.g. Acme Fleet — Jane Doyle"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                data-testid="demo-links-prospect-name"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Mail size={12} /> Prospect email (optional)
              </span>
              <input
                type="email"
                value={form.prospect_email}
                onChange={(e) => setForm((f) => ({ ...f, prospect_email: e.target.value }))}
                placeholder="jane@acme.ie"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                data-testid="demo-links-prospect-email"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Clock size={12} /> Expires in
              </span>
              <select
                value={form.expires_in_days}
                onChange={(e) => setForm((f) => ({ ...f, expires_in_days: e.target.value }))}
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                data-testid="demo-links-expires"
              >
                <option value={3}>3 days</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
              </select>
            </label>
            <button
              type="submit"
              disabled={creating}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="demo-links-create"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Generate link
            </button>
          </form>

          {justCreated && (
            <div className="mt-4 p-3 border border-emerald-200 bg-emerald-50 rounded-lg" data-testid="demo-links-just-created">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800 mb-1">
                Link ready — send to {justCreated.prospect_name}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white border border-emerald-200 rounded px-2 py-1.5 truncate font-mono text-slate-800">
                  {justCreated.url}
                </code>
                <button
                  type="button"
                  onClick={() => onCopy(justCreated)}
                  className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded"
                  title="Copy link"
                >
                  <Copy size={14} />
                </button>
                <a
                  href={justCreated.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded"
                  title="Open in new tab"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 p-4 bg-blue-50/50 border border-blue-100 rounded-lg text-xs text-blue-900">
          <p className="font-semibold mb-1">What the prospect sees</p>
          <p className="text-blue-800">
            Opening the link drops them straight into a pre-seeded Quick Wing Demo Ltd tenant
            with 8 realistic cars, a team of 4 drivers and live bookings across yesterday /
            today / tomorrow. A yellow banner reminds them it&apos;s a demo and links back to a
            real booking.
          </p>
        </div>
      </div>

      {/* Right — table */}
      <div className="lg:col-span-3">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">All demo links</h3>
            <span className="text-xs text-slate-500">{links.length} total</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
          ) : links.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 italic">
              No demo links yet. Generate one on the left to get started.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {links.map((row) => {
                const st = rowStatus(row);
                const isActive = st.label === 'Active';
                return (
                  <li key={row.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3" data-testid={`demo-link-row-${row.id}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900 truncate">{row.prospect_name || 'Untitled'}</p>
                        <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>
                      {row.prospect_email && (
                        <p className="text-xs text-slate-500 truncate">{row.prospect_email}</p>
                      )}
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Created {fmtDate(row.created_at)} · expires {fmtDate(row.expires_at)} · used {row.use_count || 0}× · last {fmtRelative(row.last_used_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onCopy(row)}
                        disabled={!isActive}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        data-testid={`demo-link-copy-${row.id}`}
                      >
                        <Copy size={12} /> Copy
                      </button>
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 ${isActive ? '' : 'opacity-40 pointer-events-none'}`}
                        title="Open in new tab"
                      >
                        <ExternalLink size={12} /> Open
                      </a>
                      {!row.revoked_at && (
                        <button
                          type="button"
                          onClick={() => onRevoke(row)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50"
                          data-testid={`demo-link-revoke-${row.id}`}
                        >
                          <Trash2 size={12} /> Revoke
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default DemoLinksSection;
