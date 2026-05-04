import React from 'react';
import { Cookie } from 'lucide-react';
import LegalPageLayout, { LegalSection, LegalDisclaimer } from '../components/LegalPageLayout';

const CookiePolicy = () => {
  return (
    <LegalPageLayout
      title="Cookie Policy"
      subtitle="How Quick Wing uses cookies and similar technologies."
      icon={Cookie}
      effectiveDate="February 2026"
    >
      <LegalDisclaimer />

      <LegalSection title="1. What are cookies?">
        <p>
          Cookies are small text files placed on your device by websites you
          visit. They are widely used to make sites work efficiently and to
          provide information to site owners.
        </p>
      </LegalSection>

      <LegalSection title="2. Cookies we use">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50 text-slate-700 text-left">
              <tr>
                <th className="p-3 font-semibold">Category</th>
                <th className="p-3 font-semibold">Purpose</th>
                <th className="p-3 font-semibold">Required?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-3 font-medium">Strictly necessary</td>
                <td className="p-3">Authentication, session management, security, tenant routing.</td>
                <td className="p-3">Yes</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Preferences</td>
                <td className="p-3">Remember UI choices such as theme and language.</td>
                <td className="p-3">No</td>
              </tr>
              <tr>
                <td className="p-3 font-medium">Analytics</td>
                <td className="p-3">Aggregate, anonymised usage analytics to help us improve the product.</td>
                <td className="p-3">No</td>
              </tr>
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="3. Local storage">
        <p>
          Quick Wing also uses browser local storage to keep you signed in and
          to remember selected tenants. Local storage entries are not sent
          automatically to our servers but may be read by the application when
          you are signed in.
        </p>
      </LegalSection>

      <LegalSection title="4. Managing cookies">
        <p>
          Most browsers allow you to refuse or delete cookies via their
          settings. Disabling strictly necessary cookies will prevent Quick
          Wing from functioning correctly. Where required by law, we will
          request your consent before placing non-essential cookies.
        </p>
      </LegalSection>

      <LegalSection title="5. Changes">
        <p>
          We may update this Cookie Policy as our use of cookies evolves. The
          effective date above will be revised when we do.
        </p>
      </LegalSection>

      <LegalSection title="6. Contact">
        <p>
          Questions: <a className="text-blue-700 underline" href="mailto:Lee.quickwing@gmail.com">Lee.quickwing@gmail.com</a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
};

export default CookiePolicy;
