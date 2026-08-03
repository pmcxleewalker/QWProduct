import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Mail, Phone, Building2, User, MessageSquare, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const InputField = ({ id, label, icon: Icon, error, required, children }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-semibold text-slate-700 mb-1.5">
      {label}
      {required && <span className="text-blue-600 ml-1">*</span>}
    </label>
    <div className="relative">
      {Icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Icon size={16} />
        </span>
      )}
      {children}
    </div>
    {error && (
      <p className="mt-1 text-xs text-red-600" data-testid={`contact-error-${id}`}>{error}</p>
    )}
  </div>
);

const Contact = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    message: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const setField = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Please enter your full name.';
    if (!form.company.trim()) errs.company = 'Please enter your company name.';
    if (!form.email.trim()) {
      errs.email = 'Please enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errs.email = 'That email address looks invalid.';
    }
    if (!form.phone.trim()) errs.phone = 'Please enter a contact phone number.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await axios.post(`${API}/public/contact`, {
        name: form.name.trim(),
        company: form.company.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        message: form.message.trim() || null,
        type: 'general',
      });
      navigate('/thank-you');
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Something went wrong. Please try again.';
      toast.error(msg);
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" data-testid="contact-page">
      {/* Top bar */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center" data-testid="contact-nav-home">
            <img src="/quick-wing-logo.png" alt="Quick Wing" className="h-9 w-auto" />
          </Link>
          <Link
            to="/login"
            className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
            data-testid="contact-nav-login"
          >
            Login
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16 grid lg:grid-cols-5 gap-10">
        {/* Left column: pitch */}
        <div className="lg:col-span-2">
          <p className="text-blue-600 font-bold uppercase tracking-widest text-xs mb-3">
            Contact us
          </p>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
            Let&apos;s talk about your fleet.
          </h1>
          <p className="text-slate-500 mb-8 leading-relaxed">
            Whether you&apos;re looking for a demo, a quote, or just have a quick question —
            drop your details in the form and Lee will personally get back to you.
          </p>

          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <span className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <Mail size={16} />
              </span>
              <a
                href="mailto:lee@quick-wing.com"
                className="hover:text-blue-600"
                data-testid="contact-email-link"
              >
                lee@quick-wing.com
              </a>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <span className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <Building2 size={16} />
              </span>
              Ireland — Kerry &amp; West Cork
            </div>
          </div>
        </div>

        {/* Right column: form card */}
        <div className="lg:col-span-3">
          <form
            onSubmit={submit}
            noValidate
            className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-5"
            data-testid="contact-form"
          >
            <InputField id="name" label="Full name" icon={User} error={errors.name} required>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                className={inputCls}
                placeholder="Jane Doe"
                data-testid="contact-input-name"
                required
              />
            </InputField>

            <InputField id="company" label="Company name" icon={Building2} error={errors.company} required>
              <input
                id="company"
                type="text"
                autoComplete="organization"
                value={form.company}
                onChange={(e) => setField('company', e.target.value)}
                className={inputCls}
                placeholder="Bluebird Care · Kerry"
                data-testid="contact-input-company"
                required
              />
            </InputField>

            <div className="grid sm:grid-cols-2 gap-5">
              <InputField id="email" label="Email" icon={Mail} error={errors.email} required>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  className={inputCls}
                  placeholder="jane@company.ie"
                  data-testid="contact-input-email"
                  required
                />
              </InputField>

              <InputField id="phone" label="Phone number" icon={Phone} error={errors.phone} required>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  className={inputCls}
                  placeholder="+353 87 000 0000"
                  data-testid="contact-input-phone"
                  required
                />
              </InputField>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Message <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-slate-400"><MessageSquare size={16} /></span>
                <textarea
                  id="message"
                  value={form.message}
                  onChange={(e) => setField('message', e.target.value)}
                  rows={4}
                  className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none"
                  placeholder="Tell us a bit about your fleet — size, current pain points, and anything specific we can help with."
                  data-testid="contact-input-message"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-100"
              data-testid="contact-submit"
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> Sending…
                </>
              ) : (
                <>
                  Send Message <ArrowRight size={18} />
                </>
              )}
            </button>

            <p className="text-xs text-slate-400 text-center">
              We&apos;ll only use your details to reply to this enquiry.
            </p>
          </form>
        </div>
      </main>

      <footer className="py-10 border-t border-slate-100 text-center">
        <p className="text-slate-400 text-xs">© {new Date().getFullYear()} Quick Wing LTD.</p>
      </footer>
    </div>
  );
};

export default Contact;
