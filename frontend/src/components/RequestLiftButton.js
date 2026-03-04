import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Car } from 'lucide-react';

const RequestLiftButton = ({ tenantSlug }) => {
  const navigate = useNavigate();

  return (
    <div 
      className="fixed bottom-16 left-0 right-0 bg-white border-t shadow-lg z-50 p-3 md:hidden"
      data-testid="request-lift-sticky"
    >
      <button
        onClick={() => navigate(`/${tenantSlug}/request-lift`)}
        className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center space-x-3 shadow-lg active:scale-[0.98] transition-transform"
        data-testid="request-lift-btn-sticky"
      >
        <div className="bg-white/20 p-2 rounded-lg">
          <Car size={24} />
        </div>
        <span>Request a Lift</span>
        <Plus size={24} />
      </button>
    </div>
  );
};

export default RequestLiftButton;
