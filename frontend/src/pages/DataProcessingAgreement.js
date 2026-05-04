import React from 'react';
import { Database } from 'lucide-react';
import LegalPageLayout, { LegalSection, LegalDisclaimer } from '../components/LegalPageLayout';

const DataProcessingAgreement = () => {
  return (
    <LegalPageLayout
      title="Data Processing Agreement"
      subtitle="The terms governing QuickFleet Limited's processing of personal data on behalf of its customers."
      icon={Database}
      effectiveDate="February 2026"
    >
      <LegalDisclaimer />

      <LegalSection title="1. Parties & Roles">
        <p>
          This Data Processing Agreement ("DPA") forms part of the Terms of
          Service between the customer ("Controller") and{' '}
          <strong>QuickFleet Limited</strong> ("Processor"). It applies whenever
          QuickFleet Limited processes personal data on the Controller's behalf
          in the course of providing Quick Wing.
        </p>
      </LegalSection>

      <LegalSection title="2. Subject Matter & Duration">
        <p>
          The Processor processes personal data for the duration of the
          subscription, plus any reasonable wind-down period required to return
          or delete the data. Processing concerns the operation of a fleet
          management platform, including booking, compliance, document storage,
          and reporting.
        </p>
      </LegalSection>

      <LegalSection title="3. Categories of Data Subjects & Data">
        <p><strong>Data subjects:</strong> the Controller's employees,
        contractors, drivers, fleet managers, and authorised third parties.</p>
        <p><strong>Categories of personal data:</strong> name, email, role,
        contact details, login credentials, photographs (where uploaded),
        booking records, vehicle assignments, mileage logs, incident reports,
        and uploaded documents.</p>
      </LegalSection>

      <LegalSection title="4. Processor Obligations">
        <ul className="list-disc pl-6 space-y-1.5">
          <li>Process personal data only on documented instructions from the Controller.</li>
          <li>Ensure persons authorised to process the data are bound by confidentiality.</li>
          <li>Implement appropriate technical and organisational measures (Article 32 GDPR).</li>
          <li>Assist the Controller with data subject requests and DPIAs where applicable.</li>
          <li>Notify the Controller of any personal data breach without undue delay.</li>
          <li>At the end of the contract, return or delete personal data at the Controller's choice.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Sub-processors">
        <p>
          The Controller authorises QuickFleet Limited to engage sub-processors
          to deliver the Service. The current list includes:
        </p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>Render (application hosting) — EU/US</li>
          <li>MongoDB Atlas (database hosting) — EU</li>
          <li>Email delivery providers (transactional email) — EU/US</li>
          <li>AI providers — only when AI features are enabled by the Controller</li>
        </ul>
        <p>
          QuickFleet Limited will give the Controller reasonable notice of any
          intended changes to sub-processors so the Controller can object on
          reasonable grounds.
        </p>
      </LegalSection>

      <LegalSection title="6. International Transfers">
        <p>
          Where personal data is transferred outside the EEA, the parties rely
          on Standard Contractual Clauses adopted by the European Commission,
          adequacy decisions, or another lawful transfer mechanism.
        </p>
      </LegalSection>

      <LegalSection title="7. Security Measures">
        <p>
          The Processor implements: encryption in transit (TLS 1.2+), hashed
          passwords (bcrypt), tenant-level data isolation, role-based access
          controls, audit logging, regular backups, and least-privilege
          administrative access. See the Security & Compliance page for full
          details.
        </p>
      </LegalSection>

      <LegalSection title="8. Audits">
        <p>
          The Controller may, no more than once per year and on reasonable
          notice, request information necessary to demonstrate compliance with
          this DPA. The Processor will respond to reasonable requests in a
          confidential manner.
        </p>
      </LegalSection>

      <LegalSection title="9. Liability">
        <p>
          Liability under this DPA is subject to the limitation of liability
          set out in the Terms of Service.
        </p>
      </LegalSection>

      <LegalSection title="10. Governing Law">
        <p>
          This DPA is governed by the laws of Ireland and disputes are subject
          to the exclusive jurisdiction of the courts of Ireland.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          DPA queries: <a className="text-blue-700 underline" href="mailto:Lee.quickwing@gmail.com">Lee.quickwing@gmail.com</a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
};

export default DataProcessingAgreement;
