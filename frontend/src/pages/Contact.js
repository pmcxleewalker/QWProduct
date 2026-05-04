import React from 'react';
import { Mail, Building2, Globe, ShieldQuestion, ScrollText } from 'lucide-react';
import LegalPageLayout, { LegalSection, LegalDisclaimer } from '../components/LegalPageLayout';

const ContactCard = ({ icon: Icon, title, lines }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 hover:shadow-sm transition-shadow">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
        <Icon size={16} />
      </div>
      <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
    </div>
    <div className="text-sm text-slate-600 space-y-1">
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  </div>
);

const Contact = () => {
  return (
    <LegalPageLayout
      title="Contact"
      subtitle="The right inbox for the right question — sales, support, privacy, security, or legal."
      icon={Mail}
      effectiveDate="February 2026"
    >
      <LegalDisclaimer />

      <LegalSection title="Get in touch">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ContactCard
            icon={Building2}
            title="Sales & demos"
            lines={[
              <a key="e" className="text-blue-700 underline" href="mailto:sales@quick-wing.com">sales@quick-wing.com</a>,
              'Pricing, demos, partnerships',
            ]}
          />
          <ContactCard
            icon={ScrollText}
            title="Customer support"
            lines={[
              <a key="e" className="text-blue-700 underline" href="mailto:support@quick-wing.com">support@quick-wing.com</a>,
              'In-app help & onboarding',
            ]}
          />
          <ContactCard
            icon={ShieldQuestion}
            title="Privacy & DPA"
            lines={[
              <a key="e" className="text-blue-700 underline" href="mailto:privacy@quick-wing.com">privacy@quick-wing.com</a>,
              'Data subject requests, DPIAs',
            ]}
          />
          <ContactCard
            icon={ShieldQuestion}
            title="Security"
            lines={[
              <a key="e" className="text-blue-700 underline" href="mailto:security@quick-wing.com">security@quick-wing.com</a>,
              'Vulnerability reports',
            ]}
          />
          <ContactCard
            icon={ScrollText}
            title="Legal"
            lines={[
              <a key="e" className="text-blue-700 underline" href="mailto:legal@quick-wing.com">legal@quick-wing.com</a>,
              'Contracts, IP, complaints',
            ]}
          />
          <ContactCard
            icon={Globe}
            title="Online"
            lines={[
              <a key="w" className="text-blue-700 underline" href="https://quick-wing.com">https://quick-wing.com</a>,
              'Product, pricing, status',
            ]}
          />
        </div>
      </LegalSection>

      <LegalSection title="Company details">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700 space-y-1">
          <div><strong>Trading name:</strong> Quick Wing</div>
          <div><strong>Operator:</strong> QuickFleet Limited</div>
          <div><strong>Country of incorporation:</strong> Ireland</div>
          <div><strong>Registered office:</strong> Available on request from legal@quick-wing.com</div>
          <div><strong>General enquiries:</strong> hello@quick-wing.com</div>
        </div>
      </LegalSection>

      <LegalSection title="Office hours">
        <p>
          Our team is generally available Monday–Friday, 09:00–18:00 IST.
          Critical security issues are monitored outside of these hours via{' '}
          <a className="text-blue-700 underline" href="mailto:security@quick-wing.com">
            security@quick-wing.com
          </a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
};

export default Contact;
