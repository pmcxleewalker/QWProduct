import React from 'react';
import { Shield } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gray-50 border-t border-gray-200 py-4 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Shield size={16} className="text-blue-600" />
            <span>© {currentYear} Lee Walker. All Rights Reserved.</span>
          </div>
          <div className="text-xs text-gray-500">
            Quick Wing Fleet Management System | Proprietary Software
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
