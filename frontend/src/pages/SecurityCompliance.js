import React from 'react';
import { Lock, ShieldCheck, Server, Eye, AlertTriangle } from 'lucide-react';
import LegalPageLayout, { LegalSection, LegalDisclaimer } from '../components/LegalPageLayout';

const Pillar = ({ icon: Icon, title, children }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5">
    <div className="flex items-center gap-2 mb-2">
      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
        <Icon size={16} />
      </div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
    </div>
    <p className="text-sm text-slate-600 leading-relaxed">{children}</p>
  </div>
);

const SecurityCompliance = () => {
  return (
    <LegalPageLayout
      title="Security & Compliance"
      subtitle="How QuickFleet Limited protects your data and the controls behind Quick Wing."
      icon={Lock}
      effectiveDate="February 2026"
    >
      <LegalDisclaimer />

      <LegalSection title="Our security pillars">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Pillar icon={ShieldCheck} title="Tenant Isolation">
            Every tenant's data is segregated at the database query level. Cross-tenant access is prevented by enforced tenant-scoped queries on every request.
          </Pillar>
          <Pillar icon={Lock} title="Encryption">
            All traffic is encrypted in transit using TLS 1.2+. Passwords are hashed with bcrypt; database backups are encrypted at rest.
          </Pillar>
          <Pillar icon={Server} title="Infrastructure">
            Application hosting on Render and database hosting on MongoDB Atlas, both with EU regions available. Daily snapshot backups with point-in-time recovery on supported tiers.
          </Pillar>
          <Pillar icon={Eye} title="Auditability">
            Sensitive actions (logins, role changes, deletions, data exports) are recorded in an audit log scoped per tenant.
          </Pillar>
        </div>
      </LegalSection>

      <LegalSection title="Access control">
        <ul className="list-disc pl-6 space-y-1.5">
          <li>Role-based access (Super Admin, Master Admin, Admin, Manager, Staff/Driver).</li>
          <li>Force-password-change on first login for staff onboarded via bulk import.</li>
          <li>JWT-based sessions with configurable expiry and rotation.</li>
          <li>Production access for engineers is least-privilege and reviewed periodically.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Data protection">
        <ul className="list-disc pl-6 space-y-1.5">
          <li>GDPR-aligned roles: Controller (you) / Processor (us) — see the DPA.</li>
          <li>Customer-initiated data export and account deletion endpoints.</li>
          <li>Sub-processors disclosed in the DPA. Notice provided before changes.</li>
          <li>EU hosting available on request for customers with data residency requirements.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Application security">
        <ul className="list-disc pl-6 space-y-1.5">
          <li>OWASP-aligned development practices.</li>
          <li>Server-side input validation; tenant-scoped query enforcement.</li>
          <li>Rate limiting and brute-force protection on authentication endpoints.</li>
          <li>Dependency monitoring and timely patching.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Incident response">
        <p>
          We aim to detect, contain, and notify customers of any confirmed
          personal data breach without undue delay (and in any case within 72
          hours where required by GDPR). Notifications include the nature of
          the breach, the categories of data affected, and the remedial steps
          taken.
        </p>
      </LegalSection>

      <LegalSection title="Compliance posture">
        <ul className="list-disc pl-6 space-y-1.5">
          <li><strong>GDPR (EU/UK):</strong> Privacy Policy, DPA, and data subject rights workflows in place.</li>
          <li><strong>Irish company law:</strong> Operated by QuickFleet Limited under Irish law.</li>
          <li><strong>SOC 2 / ISO 27001:</strong> Aligned controls; formal certification on the roadmap.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Reporting a vulnerability">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 flex gap-3">
          <AlertTriangle className="flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm">
            If you believe you've discovered a security issue in Quick Wing,
            please email{' '}
            <a className="underline" href="mailto:Lee.quickwing@gmail.com">
              Lee.quickwing@gmail.com
            </a>{' '}
            with reproduction steps. We will acknowledge within 2 business days.
          </div>
        </div>
      </LegalSection>
    </LegalPageLayout>
  );
};

export default SecurityCompliance;
