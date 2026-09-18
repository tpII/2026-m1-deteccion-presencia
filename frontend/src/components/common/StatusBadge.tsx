import React from 'react';

interface StatusBadgeProps {
  label: string;
  variant?: 'presence' | 'absence' | 'live' | 'warning' | 'error' | 'neutral';
  icon?: React.ReactNode;
  pulsing?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  icon,
  pulsing = false,
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'presence':
        return 'presence-active';
      case 'absence':
        return 'presence-inactive';
      case 'live':
        return 'status-live';
      case 'warning':
        return 'status-reconnecting';
      case 'error':
        return 'status-offline';
      default:
        return '';
    }
  };

  return (
    <span className={`glass-badge ${getVariantClass()}`}>
      {pulsing ? (
        <span className="pulse-dot pulsing" />
      ) : icon ? (
        icon
      ) : (
        <span className="pulse-dot" />
      )}
      {label}
    </span>
  );
};
