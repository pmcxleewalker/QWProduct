import React from 'react';
import { FileText } from 'lucide-react';
import LegalPageLayout, { LegalSection, LegalQuote, LegalDisclaimer } from '../components/LegalPageLayout';

const TermsOfService = () => {
  return (
    <LegalPageLayout
      title="Terms of Service"
      subtitle="The agreement between you and QuickFleet Limited for using the Quick Wing platform."
      icon={FileText}
      effectiveDate="February 2026"
    >
      <LegalDisclaimer />

      <LegalSection title="1. Introduction">
        <p>
          These Terms of Service ("Terms") govern your access to and use of the
          Quick Wing platform ("Quick Wing", "the Service"). Quick Wing is owned
          and operated by <strong>QuickFleet Limited</strong>. By creating an
          account, accessing, or using Quick Wing, you ("Customer", "you")
          agree to be bound by these Terms, the Privacy Policy, the Data
          Processing Agreement, the Cookie Policy, and the Legal Terms.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility & Accounts">
        <p>
          You must be authorised to bind your organisation and be at least 18
          years of age. You are responsible for the accuracy of information
          provided, the security of your credentials, and all activity that
          occurs under your account.
        </p>
      </LegalSection>

      <LegalSection title="3. Licence Grant">
        <LegalQuote>
          Customers are granted a limited, non-exclusive, non-transferable right
          to access and use Quick Wing for their internal business operations
          during the term of their subscription or trial. No ownership rights are
          transferred.
        </LegalQuote>
      </LegalSection>

      <LegalSection title="4. Restrictions">
        <LegalQuote>
          Customers, users, contractors, and third parties must not copy, modify,
          reproduce, resell, sublicense, reverse engineer, scrape, decompile,
          distribute, or use Quick Wing to create a competing product or service.
        </LegalQuote>
        <p>
          Any breach of these restrictions may result in immediate suspension or
          termination of your account and may give rise to legal action.
        </p>
      </LegalSection>

      <LegalSection title="5. Subscriptions, Fees & Renewals">
        <p>
          Fees are set out on the order form or invoice. Subscriptions renew
          automatically for successive periods unless cancelled in accordance
          with these Terms. All fees are non-refundable except where required by
          law or where expressly stated otherwise. Late payments may incur
          interest at the statutory rate.
        </p>
      </LegalSection>

      <LegalSection title="6. Customer Data & Confidentiality">
        <p>
          You retain ownership of your data. QuickFleet Limited will process
          customer data in line with the Privacy Policy and Data Processing
          Agreement. Each party will treat the other's confidential information
          with reasonable care and will not disclose it except as required by
          law or to perform under these Terms.
        </p>
      </LegalSection>

      <LegalSection title="7. Intellectual Property">
        <p>
          All rights, title, and interest in Quick Wing remain with QuickFleet
          Limited. No code, design, or other intellectual property is transferred
          to the customer. Feedback, suggestions, and ideas you submit may be
          used by QuickFleet Limited without restriction or compensation.
        </p>
      </LegalSection>

      <LegalSection title="8. Service Availability">
        <p>
          QuickFleet Limited will use reasonable efforts to keep Quick Wing
          available, subject to scheduled maintenance, emergency maintenance,
          and events outside of our reasonable control. We do not guarantee
          uninterrupted or error-free operation unless explicitly agreed in a
          separate Service Level Agreement.
        </p>
      </LegalSection>

      <LegalSection title="9. Acceptable Use">
        <p>
          You must not use Quick Wing to: (a) violate any law; (b) upload
          malicious code or attempt to compromise our systems; (c) infringe any
          intellectual property rights; (d) harass, defame, or harm others; or
          (e) attempt to gain unauthorised access to other tenants' data.
        </p>
      </LegalSection>

      <LegalSection title="10. Suspension & Termination">
        <p>
          QuickFleet Limited may suspend or terminate access for non-payment,
          material breach, or where required by law. You may cancel your
          subscription as described in your order form. Termination does not
          relieve the customer of accrued payment obligations.
        </p>
      </LegalSection>

      <LegalSection title="11. Warranties & Disclaimers">
        <p className="uppercase text-sm tracking-wide text-slate-700 bg-slate-100 rounded-lg p-4">
          Quick Wing is provided "as is" and "as available". To the maximum extent
          permitted by law, QuickFleet Limited disclaims all warranties, express
          or implied, including merchantability, fitness for a particular
          purpose, and non-infringement.
        </p>
      </LegalSection>

      <LegalSection title="12. Limitation of Liability">
        <p className="uppercase text-sm tracking-wide text-slate-700 bg-slate-100 rounded-lg p-4">
          To the maximum extent permitted by law, QuickFleet Limited will not be
          liable for any indirect, incidental, special, consequential, or
          punitive damages, or for loss of profits, revenue, data, or use.
          QuickFleet Limited's aggregate liability under these Terms will not
          exceed the fees paid by the customer in the 12 months preceding the
          claim.
        </p>
      </LegalSection>

      <LegalSection title="13. Indemnification">
        <p>
          You agree to indemnify and hold harmless QuickFleet Limited from any
          third-party claim arising out of your data, your misuse of Quick Wing,
          or your breach of these Terms.
        </p>
      </LegalSection>

      <LegalSection title="14. Changes to the Terms">
        <p>
          QuickFleet Limited may update these Terms from time to time. Material
          changes will be notified to active customers by email or in-app
          notice. Continued use after the effective date constitutes acceptance
          of the updated Terms.
        </p>
      </LegalSection>

      <LegalSection title="15. Governing Law & Jurisdiction">
        <p>
          These Terms are governed by the laws of Ireland. The parties submit
          to the exclusive jurisdiction of the courts of Ireland.
        </p>
      </LegalSection>

      <LegalSection title="16. Contact">
        <p>
          Questions about these Terms can be sent to{' '}
          <a className="text-blue-700 underline" href="mailto:legal@quick-wing.com">
            legal@quick-wing.com
          </a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
};

export default TermsOfService;
