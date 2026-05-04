import React from 'react';
import { Scale, Mail } from 'lucide-react';
import LegalPageLayout, { LegalSection, LegalQuote, LegalDisclaimer } from '../components/LegalPageLayout';

const Legal = () => {
  return (
    <LegalPageLayout
      title="Legal"
      subtitle="Ownership, intellectual property, and licence terms governing the use of Quick Wing."
      icon={Scale}
      effectiveDate="February 2026"
    >
      <LegalDisclaimer />

      <LegalSection title="1. Ownership Statement">
        <LegalQuote>
          Quick Wing is owned and operated by QuickFleet Limited. All rights, title,
          and interest in the Quick Wing platform, including its software, design,
          workflows, database structure, user interface, branding, logo,
          documentation, and related materials, are owned by QuickFleet Limited
          unless expressly agreed otherwise in writing.
        </LegalQuote>
      </LegalSection>

      <LegalSection title="2. Intellectual Property">
        <p>
          Quick Wing and all associated intellectual property — including source
          code, object code, application architecture, schemas, APIs, screen
          designs, copy, illustrations, marketing assets, and the Quick Wing name
          and logo — are the exclusive intellectual property of QuickFleet Limited.
        </p>
        <p>
          The platform is protected by copyright, database rights, trademark law,
          trade secret law, and applicable international treaties. No rights are
          granted by implication, estoppel, or otherwise, other than those
          expressly described in this Legal page and the accompanying Terms of
          Service.
        </p>
      </LegalSection>

      <LegalSection title="3. Client Licence Terms">
        <LegalQuote>
          Customers are granted a limited, non-exclusive, non-transferable right
          to access and use Quick Wing for their internal business operations
          during the term of their subscription or trial. No ownership rights are
          transferred.
        </LegalQuote>
        <p>
          The licence is conditional on full and ongoing compliance with the
          Terms of Service, the Privacy Policy, the Data Processing Agreement,
          and these Legal Terms. The licence terminates automatically upon expiry
          or termination of the subscription, or upon material breach by the
          customer.
        </p>
      </LegalSection>

      <LegalSection title="4. Restrictions on Use">
        <LegalQuote>
          Customers, users, contractors, and third parties must not copy, modify,
          reproduce, resell, sublicense, reverse engineer, scrape, decompile,
          distribute, or use Quick Wing to create a competing product or service.
        </LegalQuote>
        <p>Without limiting the foregoing, the following are expressly prohibited:</p>
        <ul className="list-disc pl-6 space-y-1.5">
          <li>Copying or reproducing any part of the platform, including UI, code, schema, or documentation.</li>
          <li>Modifying, translating, or creating derivative works based on the platform.</li>
          <li>Reselling, sublicensing, leasing, or making the platform available to any third party not authorised under the subscription.</li>
          <li>Reverse engineering, decompiling, disassembling, or otherwise attempting to derive source code or underlying logic.</li>
          <li>Scraping, mass-downloading, or systematically extracting data from the platform.</li>
          <li>Using Quick Wing — directly or indirectly — to design, build, train, or operate a competing fleet management product or service.</li>
          <li>Removing, obscuring, or altering any copyright, trademark, or proprietary notices.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Access vs. Ownership">
        <p>
          Customers receive <strong>access rights only</strong>. No ownership
          rights, source code rights, or transferable interests in Quick Wing are
          granted under any subscription, trial, free tier, partnership, or
          professional services arrangement.
        </p>
        <p>
          QuickFleet Limited retains all rights, title, and interest in the
          Quick Wing platform, including all improvements, enhancements,
          customisations, integrations, and feedback, regardless of who suggested
          or contributed to them.
        </p>
      </LegalSection>

      <LegalSection title="6. Customer Data">
        <p>
          The customer retains ownership of the data they upload to Quick Wing
          (vehicle records, bookings, staff profiles, documents, etc.).
          QuickFleet Limited processes that data on the customer's behalf in
          accordance with the Data Processing Agreement and applicable data
          protection laws.
        </p>
      </LegalSection>

      <LegalSection title="7. Trademarks">
        <p>
          "Quick Wing", the Quick Wing logo, and any related names, marks, and
          designs are trademarks of QuickFleet Limited. Use of these marks
          without prior written permission is strictly prohibited.
        </p>
      </LegalSection>

      <LegalSection title="8. Enforcement">
        <p>
          QuickFleet Limited reserves the right to enforce its rights to the
          fullest extent permitted by law, including by seeking injunctive relief
          and damages, and may suspend or terminate access to Quick Wing
          immediately upon any actual or suspected breach of these Legal Terms.
        </p>
      </LegalSection>

      <LegalSection title="9. Governing Law">
        <p>
          These Legal Terms are governed by the laws of Ireland, without regard
          to conflict of law principles. The parties submit to the exclusive
          jurisdiction of the courts of Ireland.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact Details">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <p className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <Mail size={16} className="text-blue-600" />
            QuickFleet Limited — Legal Enquiries
          </p>
          <ul className="text-sm text-slate-700 space-y-1">
            <li><strong>Trading name:</strong> Quick Wing</li>
            <li><strong>Operator:</strong> QuickFleet Limited (Ireland)</li>
            <li><strong>Email:</strong> legal@quick-wing.com</li>
            <li><strong>Website:</strong> https://quick-wing.com</li>
          </ul>
        </div>
      </LegalSection>
    </LegalPageLayout>
  );
};

export default Legal;
