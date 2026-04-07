import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Mail, Database, Trash2, Download, Clock, Lock } from 'lucide-react';

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const lastUpdated = "April 2026";
  const companyName = "Quick Wing Fleet Management";
  const contactEmail = "Lee.quickwing@gmail.com";
  const country = "Ireland";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center">
          <button 
            onClick={() => navigate(-1)}
            className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Privacy Policy</h1>
            <p className="text-sm text-gray-500">Last updated: {lastUpdated}</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8 space-y-8">
          
          {/* Introduction */}
          <section>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Shield className="text-blue-600" size={24} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Introduction</h2>
            </div>
            <p className="text-gray-600 leading-relaxed">
              {companyName} ("we", "our", or "us") is committed to protecting your privacy and ensuring 
              the security of your personal data. This Privacy Policy explains how we collect, use, store, 
              and protect your information when you use our fleet management platform.
            </p>
            <p className="text-gray-600 leading-relaxed mt-3">
              We are based in {country} and comply with the General Data Protection Regulation (GDPR) 
              and the Irish Data Protection Acts 1988-2018.
            </p>
          </section>

          {/* Data We Collect */}
          <section>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Database className="text-purple-600" size={24} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Data We Collect</h2>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Personal Information</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li>Name and email address</li>
                  <li>Phone number (optional)</li>
                  <li>Role within your organisation</li>
                  <li>Login credentials (password stored securely hashed)</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Business Data</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li>Vehicle information (registration, make, model)</li>
                  <li>Booking records and schedules</li>
                  <li>Mileage logs</li>
                  <li>Compliance documents (NCT, tax, insurance dates)</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Technical Data</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li>IP address and browser type</li>
                  <li>Device information</li>
                  <li>Usage logs and timestamps</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Your Data */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">How We Use Your Data</h2>
            <p className="text-gray-600 mb-3">We use your data to:</p>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Provide and maintain the fleet management service</li>
              <li>Authenticate your identity and manage your account</li>
              <li>Process vehicle bookings and track fleet usage</li>
              <li>Generate reports and analytics for your organisation</li>
              <li>Send service-related notifications and updates</li>
              <li>Improve our platform and user experience</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          {/* Legal Basis */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Legal Basis for Processing</h2>
            <p className="text-gray-600 leading-relaxed">
              We process your personal data based on the following legal grounds:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1 mt-3">
              <li><strong>Contract:</strong> Processing necessary to provide our services to you</li>
              <li><strong>Legitimate Interest:</strong> To improve our services and ensure security</li>
              <li><strong>Consent:</strong> Where you have given explicit consent</li>
              <li><strong>Legal Obligation:</strong> To comply with applicable laws</li>
            </ul>
          </section>

          {/* Data Retention */}
          <section>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="text-amber-600" size={24} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Data Retention</h2>
            </div>
            <p className="text-gray-600 leading-relaxed">
              We retain your personal data only for as long as necessary to provide our services 
              and fulfil the purposes described in this policy. Typically:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1 mt-3">
              <li>Active account data: Retained while your account is active</li>
              <li>Booking history: Retained for 7 years for business records</li>
              <li>Deleted accounts: Data removed within 30 days of deletion request</li>
            </ul>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Your Rights Under GDPR</h2>
            <p className="text-gray-600 mb-4">You have the following rights regarding your personal data:</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-1">Right to Access</h3>
                <p className="text-sm text-gray-600">Request a copy of all personal data we hold about you</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-1">Right to Rectification</h3>
                <p className="text-sm text-gray-600">Request correction of inaccurate personal data</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-1">Right to Erasure</h3>
                <p className="text-sm text-gray-600">Request deletion of your personal data</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-1">Right to Portability</h3>
                <p className="text-sm text-gray-600">Receive your data in a machine-readable format</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-1">Right to Restrict Processing</h3>
                <p className="text-sm text-gray-600">Request limitation of how we use your data</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-1">Right to Object</h3>
                <p className="text-sm text-gray-600">Object to processing based on legitimate interests</p>
              </div>
            </div>
            <p className="text-gray-600 mt-4">
              To exercise any of these rights, please use the settings in your account dashboard 
              or contact us at <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline">{contactEmail}</a>.
            </p>
          </section>

          {/* Data Security */}
          <section>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <Lock className="text-green-600" size={24} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Data Security</h2>
            </div>
            <p className="text-gray-600 leading-relaxed">
              We implement appropriate technical and organisational measures to protect your data:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1 mt-3">
              <li>All data encrypted in transit (HTTPS/TLS)</li>
              <li>Passwords hashed using industry-standard bcrypt</li>
              <li>Role-based access controls</li>
              <li>Multi-tenant data isolation</li>
              <li>Regular security updates and monitoring</li>
            </ul>
          </section>

          {/* Third Parties */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Third-Party Services</h2>
            <p className="text-gray-600 leading-relaxed">
              We use the following third-party services to operate our platform:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1 mt-3">
              <li><strong>MongoDB Atlas:</strong> Database hosting (EU region)</li>
              <li><strong>Cloud Hosting Provider:</strong> Application hosting</li>
            </ul>
            <p className="text-gray-600 mt-3">
              All third-party providers are GDPR compliant and process data under appropriate 
              Data Processing Agreements.
            </p>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Cookies</h2>
            <p className="text-gray-600 leading-relaxed">
              We use essential cookies to operate our service (authentication tokens). 
              We do not use tracking or advertising cookies. You can manage cookie 
              preferences through your browser settings.
            </p>
          </section>

          {/* Contact */}
          <section>
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="text-blue-600" size={24} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Contact Us</h2>
            </div>
            <p className="text-gray-600 leading-relaxed">
              If you have questions about this Privacy Policy or wish to exercise your rights, 
              please contact us:
            </p>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="font-semibold text-gray-900">{companyName}</p>
              <p className="text-gray-600">Data Controller</p>
              <p className="text-gray-600 mt-2">
                Email: <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline">{contactEmail}</a>
              </p>
            </div>
          </section>

          {/* Complaints */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Complaints</h2>
            <p className="text-gray-600 leading-relaxed">
              If you believe we have not handled your data correctly, you have the right to 
              lodge a complaint with the Irish Data Protection Commission:
            </p>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="font-semibold text-gray-900">Data Protection Commission</p>
              <p className="text-gray-600">21 Fitzwilliam Square South, Dublin 2, D02 RD28</p>
              <p className="text-gray-600">
                Website: <a href="https://www.dataprotection.ie" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">www.dataprotection.ie</a>
              </p>
            </div>
          </section>

          {/* Updates */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Changes to This Policy</h2>
            <p className="text-gray-600 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any 
              significant changes by email or through a notice on our platform. We encourage 
              you to review this policy periodically.
            </p>
          </section>

        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
