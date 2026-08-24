import React, { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const CookieConsent = () => {
  const [showBanner, setShowBanner] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      // Delay showing banner slightly for better UX
      const timer = setTimeout(() => setShowBanner(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Hide cookie banner inside franchise dashboards (authenticated areas)
  // Only show on public pages like landing, login, privacy policy
  const isPublicPage = () => {
    const path = location.pathname;
    // Public pages where cookie banner should show
    const publicPaths = ['/', '/login', '/privacy-policy', '/terms'];
    
    // Check if it's a tenant login page
    if (path.match(/^\/[^/]+\/login$/)) return true;
    
    // Check if it's a public mileage page
    if (path.includes('/vehicle/') && path.includes('/mileage')) return true;
    
    // Check if it's the root or other public paths
    if (publicPaths.includes(path)) return true;
    
    // All other paths are considered authenticated/franchise areas
    return false;
  };

  const acceptCookies = () => {
    localStorage.setItem('cookieConsent', JSON.stringify({
      accepted: true,
      timestamp: new Date().toISOString(),
      essential: true,
      analytics: false
    }));
    setShowBanner(false);
  };

  const declineCookies = () => {
    localStorage.setItem('cookieConsent', JSON.stringify({
      accepted: false,
      timestamp: new Date().toISOString(),
      essential: true,
      analytics: false
    }));
    setShowBanner(false);
  };

  // Don't show banner if already consented, or if inside franchise dashboard
  if (!showBanner || !isPublicPage()) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Icon and Text */}
          <div className="flex items-start space-x-3 flex-1">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <Cookie className="text-blue-600" size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Cookie Notice</h3>
              <p className="text-sm text-gray-600">
                We use essential cookies to make our site work. We do not use tracking or advertising cookies. 
                By continuing to use this site, you agree to our use of essential cookies.{' '}
                <Link to="/privacy-policy" className="text-blue-600 hover:underline">
                  Learn more in our Privacy Policy
                </Link>
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            <button
              onClick={declineCookies}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Decline
            </button>
            <button
              onClick={acceptCookies}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Accept
            </button>
          </div>

          {/* Close button (mobile) */}
          <button
            onClick={declineCookies}
            className="absolute top-2 right-2 md:hidden p-1 text-gray-400 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
