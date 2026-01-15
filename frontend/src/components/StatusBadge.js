import React from 'react';

const StatusBadge = ({ status, isBlocked, blockReason, compact = false }) => {
  // If car is blocked, show blocked status
  if (isBlocked) {
    return (
      <span
        data-testid="status-badge-blocked"
        className={`inline-flex items-center rounded-full font-medium bg-gray-600 text-white ${
          compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
        }`}
      >
        {compact ? '🚫' : `🚫 Blocked - ${blockReason || 'Maintenance'}`}
      </span>
    );
  }

  const getStatusClass = () => {
    switch (status) {
      case 'Free':
        return 'bg-green-500 text-white';
      case 'In Use':
        return 'bg-red-500 text-white';
      case 'Booked':
        return 'bg-red-500 text-white';
      case 'Recurring':
        return 'bg-purple-500 text-white';
      case 'Maintenance':
        return 'bg-orange-500 text-white';
      case 'Out of Service':
        return 'bg-red-600 text-white';
      case 'Needs Cleaning':
        return 'bg-orange-500 text-white';
      case 'Needs Repair':
        return 'bg-orange-600 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  // Get compact emoji for status
  const getStatusEmoji = () => {
    switch (status) {
      case 'Free':
        return '🟢';
      case 'In Use':
        return '🔵';
      case 'Booked':
        return '🔴';
      case 'Recurring':
        return '🟣';
      case 'Maintenance':
        return '🔧';
      case 'Out of Service':
        return '🔴';
      default:
        return '⚪';
    }
  };

  return (
    <span
      data-testid={`status-badge-${status?.toLowerCase().replace(/\s+/g, '-')}`}
      className={`inline-flex items-center rounded-full font-medium ${getStatusClass()} ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}
    >
      {compact ? getStatusEmoji() : status}
    </span>
  );
};

export default StatusBadge;