import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, FileText, AlertTriangle, Scale, Lock, Users, Mail } from 'lucide-react';

const TermsOfService = () => {
  const currentYear = new Date().getFullYear();
  const effectiveDate = "February 20, 2026";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Link to="/login" className="inline-flex items-center text-blue-100 hover:text-white mb-4">
            <ArrowLeft size={20} className="mr-2" />
            Back to Login
          </Link>
          <h1 className="text-3xl font-bold flex items-center">
            <Scale className="mr-3" size={32} />
            Terms of Service
          </h1>
          <p className="text-blue-100 mt-2">Quick Wing Fleet Management System</p>
          <p className="text-sm text-blue-200 mt-1">Effective Date: {effectiveDate}</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8 space-y-8">
          
          {/* Introduction */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <FileText className="mr-2 text-blue-600" size={24} />
              1. Introduction
            </h2>
            <p className="text-gray-700 leading-relaxed">
              Welcome to Quick Wing Fleet Management System ("the Software", "the Service", "the Application"). 
              This Software is owned and operated by <strong>Lee Walker</strong> ("Owner", "We", "Us", "Our"). 
              By accessing or using this Software, you ("User", "You", "Your") agree to be bound by these 
              Terms of Service ("Terms"). If you do not agree to these Terms, you must not access or use the Software.
            </p>
          </section>

          {/* License Grant */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Shield className="mr-2 text-blue-600" size={24} />
              2. License Grant
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Subject to your compliance with these Terms, Lee Walker grants you a limited, non-exclusive, 
              non-transferable, revocable license to access and use the Software solely for its intended 
              purpose of fleet management operations within your authorized organization.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-800 mb-2">This license does NOT permit you to:</h3>
              <ul className="list-disc list-inside text-amber-700 space-y-1 text-sm">
                <li>Copy, modify, or distribute the Software or its source code</li>
                <li>Reverse engineer, decompile, or disassemble the Software</li>
                <li>Sublicense, sell, resell, or lease the Software to any third party</li>
                <li>Use the Software to develop competing products or services</li>
                <li>Remove or alter any proprietary notices, labels, or marks</li>
                <li>Use the Software for any unlawful purpose</li>
              </ul>
            </div>
          </section>

          {/* Proprietary Rights */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Lock className="mr-2 text-blue-600" size={24} />
              3. Proprietary Rights & Intellectual Property
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              The Software, including but not limited to its source code, object code, design, structure, 
              organization, user interface, graphics, documentation, and all related intellectual property 
              rights, are and shall remain the exclusive property of <strong>Lee Walker</strong>.
            </p>
            <p className="text-gray-700 leading-relaxed">
              All rights not expressly granted herein are reserved. The Software is protected by copyright 
              laws and international treaty provisions. Unauthorized reproduction, distribution, or use of 
              the Software may result in civil and criminal penalties.
            </p>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 font-medium">
                © {currentYear} Lee Walker. All Rights Reserved.
              </p>
            </div>
          </section>

          {/* User Accounts */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Users className="mr-2 text-blue-600" size={24} />
              4. User Accounts & Responsibilities
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              To access the Software, you must be provided with authorized login credentials by an administrator. 
              You are responsible for:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying the administrator immediately of any unauthorized use</li>
              <li>Ensuring all information you provide is accurate and current</li>
              <li>Complying with all applicable laws and regulations in your use of the Software</li>
            </ul>
          </section>

          {/* Data & Privacy */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Shield className="mr-2 text-blue-600" size={24} />
              5. Data & Privacy
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              The Software collects and processes data necessary for fleet management operations, including 
              but not limited to: user information, vehicle data, booking records, and location information. 
              By using the Software, you consent to such data collection and processing.
            </p>
            <p className="text-gray-700 leading-relaxed">
              We implement reasonable security measures to protect your data. However, no method of electronic 
              transmission or storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          {/* Disclaimer of Warranties */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <AlertTriangle className="mr-2 text-amber-600" size={24} />
              6. Disclaimer of Warranties
            </h2>
            <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
              <p className="text-gray-700 leading-relaxed uppercase text-sm">
                THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, 
                EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, 
                FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. LEE WALKER DOES NOT WARRANT THAT 
                THE SOFTWARE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.
              </p>
            </div>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Scale className="mr-2 text-blue-600" size={24} />
              7. Limitation of Liability
            </h2>
            <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
              <p className="text-gray-700 leading-relaxed uppercase text-sm">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, LEE WALKER SHALL NOT BE LIABLE FOR ANY INDIRECT, 
                INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, 
                DATA, OR USE, ARISING OUT OF OR RELATED TO YOUR USE OF THE SOFTWARE, REGARDLESS OF THE 
                THEORY OF LIABILITY.
              </p>
            </div>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">8. Termination</h2>
            <p className="text-gray-700 leading-relaxed">
              Lee Walker reserves the right to terminate or suspend your access to the Software at any time, 
              with or without cause, with or without notice. Upon termination, your right to use the Software 
              will immediately cease. All provisions of these Terms which by their nature should survive 
              termination shall survive, including ownership provisions, warranty disclaimers, and limitations 
              of liability.
            </p>
          </section>

          {/* Modifications */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">9. Modifications to Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              Lee Walker reserves the right to modify these Terms at any time. Changes will be effective 
              immediately upon posting. Your continued use of the Software after any changes constitutes 
              your acceptance of the new Terms. It is your responsibility to review these Terms periodically.
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">10. Governing Law</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of Ireland, 
              without regard to its conflict of law principles. Any disputes arising from these Terms 
              or your use of the Software shall be subject to the exclusive jurisdiction of the courts 
              of Ireland.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Mail className="mr-2 text-blue-600" size={24} />
              11. Contact Information
            </h2>
            <p className="text-gray-700 leading-relaxed">
              If you have any questions about these Terms of Service, please contact the software owner 
              or your system administrator.
            </p>
          </section>

          {/* Acknowledgment */}
          <section className="border-t pt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <p className="text-blue-800 font-medium">
                By using the Quick Wing Fleet Management System, you acknowledge that you have read, 
                understood, and agree to be bound by these Terms of Service.
              </p>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>© {currentYear} Lee Walker. All Rights Reserved.</p>
          <p className="mt-1">Quick Wing Fleet Management System | Proprietary Software</p>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
