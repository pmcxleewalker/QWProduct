import React from 'react';

const StatusBadge = ({ status, isBlocked, blockReason }) => {
  // If car is blocked, show blocked status
  if (isBlocked) {
    return (
      <span
        data-testid="status-badge-blocked"
        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-600 text-white"
      >
        🚫 Blocked - {blockReason || 'Maintenance'}
      </span>
    );
  }

  const getStatusClass = () => {
    switch (status) {
      case 'Free':
        return 'bg-green-500 text-white';
      case 'In Use':
        return 'bg-red-500 text-white';
      case 'Needs Cleaning':
        return 'bg-orange-500 text-white';
      case 'Needs Repair':
        return 'bg-orange-600 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <span
      data-testid={`status-badge-${status.toLowerCase().replace(/\s+/g, '-')}`}
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusClass()}`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;