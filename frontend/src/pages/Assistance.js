import React, { useState, useEffect } from 'react';
import { assistanceAPI } from '../api/api';
import { Phone, MapPin } from 'lucide-react';

const Assistance = () => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState('All');

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await assistanceAPI.getAll();
      setProviders(response.data);
    } catch (error) {
      console.error('Error fetching providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProviders = selectedRegion === 'All'
    ? providers
    : providers.filter(p => p.region === selectedRegion);

  const regions = ['All', ...new Set(providers.map(p => p.region))];

  const groupedProviders = filteredProviders.reduce((acc, provider) => {
    if (!acc[provider.region]) {
      acc[provider.region] = [];
    }
    acc[provider.region].push(provider);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6" data-testid="assistance-title">
        Breakdown Assistance
      </h1>

      {/* Region Filter */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {regions.map((region) => (
            <button
              key={region}
              data-testid={`region-filter-${region.toLowerCase()}`}
              onClick={() => setSelectedRegion(region)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedRegion === region
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {region}
            </button>
          ))}
        </div>
      </div>

      {/* Providers List */}
      {providers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No assistance providers added yet. Add them from the Admin panel.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedProviders).map(([region, regionProviders]) => (
            <div key={region} data-testid={`region-section-${region.toLowerCase()}`}>
              <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
                <MapPin className="mr-2" size={24} />
                {region}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {regionProviders.map((provider) => (
                  <div
                    key={provider.id}
                    data-testid={`provider-card-${provider.id}`}
                    className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-bold text-gray-900">
                        {provider.name}
                      </h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {provider.service_type}
                      </span>
                    </div>
                    
                    <a
                      href={`tel:${provider.phone}`}
                      data-testid={`call-button-${provider.id}`}
                      className="flex items-center justify-center space-x-2 w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium mt-4"
                    >
                      <Phone size={18} />
                      <span>{provider.phone}</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Assistance;