import React from 'react';
import { Shield } from 'lucide-react';
import LegalPageLayout, { LegalSection, LegalDisclaimer } from '../components/LegalPageLayout';

const PrivacyPolicy = () => {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="How QuickFleet Limited collects, uses, and protects information when you use Quick Wing."
      icon={Shield}
      effectiveDate="February 2026"
    >
      <LegalDisclaimer />

      <LegalSection title="1. Who we are">
        <p>
          Quick Wing is operated by <strong>QuickFleet Limited</strong>
          (Ireland). For the purposes of the EU/UK GDPR, QuickFleet Limited
          acts as the <strong>data controller</strong> for the data it collects
          about its customers and prospects, and as a <strong>data
          processor</strong> for personal data uploaded into Quick Wing by
          customer organisations (see the Data Processing Agreement).
        </p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <ul className="list-disc pl-6 space-y-1.5">
          <li><strong>Account data:</strong> name, email, role, organisation, hashed password.</li>
          <li><strong>Usage data:</strong> log events, feature usage, IP address, device, browser.</li>
          <li><strong>Customer content:</strong> vehicle records, bookings, staff profiles, documents, photos, incidents — uploaded by your organisation.</li>
          <li><strong>Billing data:</strong> handled by our payment processor; we do not store full card numbers.</li>
          <li><strong>Communications:</strong> support emails, in-app messages, demo requests.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use your data">
        <ul className="list-disc pl-6 space-y-1.5">
          <li>Provide, operate, and improve Quick Wing.</li>
          <li>Authenticate users and protect account security.</li>
          <li>Send service notifications, billing notices, and (with consent) marketing.</li>
          <li>Comply with legal obligations.</li>
          <li>Aggregate, anonymised analytics for product improvement.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Legal bases (GDPR)">
        <p>
          We process personal data on the basis of (a) performance of a contract,
          (b) legitimate interests (operating and improving the Service),
          (c) consent (e.g. marketing emails, optional cookies), and
          (d) legal obligation.
        </p>
      </LegalSection>

      <LegalSection title="5. Sharing your data">
        <p>
          We share data only with vetted sub-processors listed in the Data
          Processing Agreement (e.g. cloud hosting, database hosting, email
          delivery, AI providers when enabled). We do not sell personal data.
        </p>
      </LegalSection>

      <LegalSection title="6. International transfers">
        <p>
          Where data is transferred outside the EEA, we rely on appropriate
          safeguards including Standard Contractual Clauses and adequacy
          decisions where applicable.
        </p>
      </LegalSection>

      <LegalSection title="7. Retention">
        <p>
          Customer content is retained for as long as the subscription is active,
          plus a reasonable wind-down period (typically 30 days). Account and
          billing records may be retained for up to 7 years to satisfy Irish
          tax and accounting law.
        </p>
      </LegalSection>

      <LegalSection title="8. Your rights">
        <p>
          You have the right to access, rectify, erase, restrict, port, and
          object to processing of your personal data, and to withdraw consent
          at any time. To exercise these rights, contact{' '}
          <a className="text-blue-700 underline" href="mailto:Lee.quickwing@gmail.com">
            Lee.quickwing@gmail.com
          </a>.
        </p>
      </LegalSection>

      <LegalSection title="9. Security">
        <p>
          We use industry-standard safeguards including encryption in transit
          (TLS), hashed passwords, role-based access controls, tenant data
          isolation, and continuous logging. See the Security & Compliance page
          for more.
        </p>
      </LegalSection>

      <LegalSection title="10. Children">
        <p>
          Quick Wing is a B2B service and is not directed at children under 16.
          We do not knowingly collect personal data from children.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes">
        <p>
          We may update this Privacy Policy. Material changes will be notified
          by email or in-app notice. Continued use after the effective date
          constitutes acceptance.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact & complaints">
        <p>
          Privacy questions: <a className="text-blue-700 underline" href="mailto:Lee.quickwing@gmail.com">Lee.quickwing@gmail.com</a>.
          You also have the right to lodge a complaint with the Irish Data
          Protection Commission (dataprotection.ie).
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
};

export default PrivacyPolicy;
