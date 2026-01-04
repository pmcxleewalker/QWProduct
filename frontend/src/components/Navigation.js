import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, PhoneCall, Settings, LogOut, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Navigation = () => {
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  
  const isActive = (path) => location.pathname === path;
  
  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/live-sheet', icon: FileSpreadsheet, label: 'Live Sheet' },
    { path: '/bookings', icon: Calendar, label: 'Bookings' },
    { path: '/assistance', icon: PhoneCall, label: 'Assistance' },
  ];

  // Only show Admin for admin users
  if (isAdmin()) {
    navItems.push({ path: '/admin', icon: Settings, label: 'Admin' });
  }

  const handleLogout = () => {
    logout();
  };

  return (
    <>
      {/* Mobile Top Header */}
      <nav className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
        <div className="flex justify-between items-center h-14 px-4">
          <h1 className="text-xl font-bold text-blue-600">Quick Wing</h1>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-600">{user?.email?.split('@')[0]}</span>
            {isAdmin() && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                Admin
              </span>
            )}
            <button
              onClick={handleLogout}
              data-testid="mobile-logout-button"
              className="flex items-center p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase()}`}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive(item.path)
                    ? 'text-blue-600'
                    : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                <Icon size={24} />
                <span className="text-xs mt-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Header Navigation */}
      <nav className="hidden md:block bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-blue-600">Quick Wing</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex space-x-8">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      data-testid={`nav-${item.label.toLowerCase()}`}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                        isActive(item.path)
                          ? 'text-blue-600 bg-blue-50'
                          : 'text-gray-600 hover:text-blue-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon size={20} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
              <div className="flex items-center space-x-3 pl-4 border-l border-gray-200">
                <span className="text-sm text-gray-700">{user?.email}</span>
                {isAdmin() && (
                  <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                    Admin
                  </span>
                )}
                <button
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navigation;