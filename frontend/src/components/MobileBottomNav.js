import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Calendar, Settings, User, BarChart3, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const MobileBottomNav = ({ tenantSlug }) => {
  const location = useLocation();
  const { user, activeTenant, isTenantAdmin } = useAuth();
  
  // Get the base path for tenant-scoped navigation
  const basePath = tenantSlug ? `/${tenantSlug}` : (activeTenant?.tenant_slug ? `/${activeTenant.tenant_slug}` : '');
  
  // Helper function to build tenant-scoped paths
  const getTenantPath = (path) => {
    if (path === '/') return basePath || '/';
    return `${basePath}${path}`;
  };
  
  const isActive = (path) => {
    const fullPath = getTenantPath(path);
    return location.pathname === fullPath || location.pathname === path || location.pathname.endsWith(path);
  };
  
  const isAdmin = isTenantAdmin ? isTenantAdmin() : (
    activeTenant?.role === 'admin' || 
    activeTenant?.role === 'master_admin' || 
    user?.role === 'super_admin' || 
    user?.role === 'master_admin'
  );
  
  const navItems = [
    { path: getTenantPath('/'), icon: LayoutDashboard, label: 'Home' },
    { path: getTenantPath('/live-sheet'), icon: FileSpreadsheet, label: 'Live' },
    { path: getTenantPath('/bookings'), icon: Calendar, label: 'Bookings' },
  ];
  
  // Add Admin link for admin users
  if (isAdmin) {
    navItems.push({ path: getTenantPath('/reports'), icon: BarChart3, label: 'Reports' });
    navItems.push({ path: getTenantPath('/admin'), icon: Settings, label: 'Admin' });
  }

  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-inset-bottom">
      <div className="flex justify-around items-center h-16">
        {navItems.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
              isActive(path)
                ? 'text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={22} strokeWidth={isActive(path) ? 2.5 : 2} />
            <span className="text-xs font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default MobileBottomNav;
