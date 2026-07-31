import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * ContactFormModal
 * ----------------
 * Landing-page lead form. `type` controls the copy:
 *   - "pricing"  → "Request pricing" (asks for fleet size)
 *   - "general"  → "Contact us"
 *
 * POSTs to /api/public/contact — leads are stored in `contact_requests`.
 * No auth required.
 */
const ContactFormModal = ({ open, onOpenChange, type = 'general' }) => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    fleet_size: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const isPricing = type === 'pricing';
  const heading = isPricing ? 'Get pricing for your fleet' : 'Talk to us';
  const subtitle = isPricing
    ? 'Tell us about your fleet and we\'ll send tailored pricing within one business day.'
    : 'Have a question or want a demo? Drop us a note and we\'ll get back to you.';

  const close = () => {
    if (submitting) return;
    onOpenChange(false);
    // reset after close animation
    setTimeout(() => {
      setForm({ name: '', email: '', company: '', phone: '', fleet_size: '', message: '' });
      setSubmitted(false);
    }, 300);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Name and email are required');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${API}/public/contact`, { ...form, type });
      setSubmitted(true);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not send — please try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={close}
      data-testid="contact-form-modal"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="text-xl font-bold text-slate-900">{heading}</h3>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <button
            onClick={close}
            disabled={submitting}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 disabled:opacity-50"
            aria-label="Close"
            data-testid="contact-form-close"
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center" data-testid="contact-form-success">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <Send className="h-6 w-6 text-emerald-600" />
            </div>
            <h4 className="text-lg font-semibold text-slate-900">Thanks — we&apos;ve got it.</h4>
            <p className="mt-1 text-sm text-slate-500">
              We&apos;ll be in touch at <span className="font-medium text-slate-700">{form.email}</span> within one business day.
            </p>
            <Button onClick={close} className="mt-6 bg-slate-900 hover:bg-slate-800">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-4">
            <Field label="Your name" required>
              <input
                type="text"
                autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
                data-testid="contact-form-name"
              />
            </Field>
            <Field label="Work email" required>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
                data-testid="contact-form-email"
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Company">
                <input
                  type="text"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  data-testid="contact-form-company"
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  data-testid="contact-form-phone"
                />
              </Field>
            </div>

            {isPricing && (
              <Field label="Fleet size">
                <select
                  value={form.fleet_size}
                  onChange={(e) => setForm({ ...form, fleet_size: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  data-testid="contact-form-fleet-size"
                >
                  <option value="">Select…</option>
                  <option value="1-10">1–10 vehicles</option>
                  <option value="11-25">11–25 vehicles</option>
                  <option value="26-50">26–50 vehicles</option>
                  <option value="51-100">51–100 vehicles</option>
                  <option value="100+">100+ vehicles</option>
                </select>
              </Field>
            )}

            <Field label={isPricing ? 'Anything else we should know?' : 'Your message'}>
              <textarea
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                placeholder={isPricing ? 'Timeline, current setup, must-haves…' : 'Tell us a little about what you\'re looking for…'}
                data-testid="contact-form-message"
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={close}
                disabled={submitting}
                className="border-slate-300 text-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-slate-900 hover:bg-slate-800 text-white"
                data-testid="contact-form-submit"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {isPricing ? 'Request pricing' : 'Send message'}
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, required, children }) => (
  <label className="block">
    <span className="block text-xs font-semibold text-slate-700 mb-1">
      {label}
      {required && <span className="text-rose-500 ml-0.5">*</span>}
    </span>
    {children}
  </label>
);

export default ContactFormModal;
