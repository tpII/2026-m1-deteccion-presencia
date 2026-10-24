import type React from 'react';

interface StatusBadgeProps {
  label: string;
  variant?: 'presence' | 'absence' | 'live' | 'warning' | 'error' | 'neutral';
  icon?: React.ReactNode;
  pulsing?: boolean;
}

export function StatusBadge({
  label,
  variant = 'neutral',
  icon,
  pulsing = false,
}: StatusBadgeProps) {
  const variantClasses = {
    presence: 'presence-active',
    absence: 'presence-inactive',
    live: 'status-live',
    warning: 'status-reconnecting',
    error: 'status-offline',
    neutral: '',
  };

  return (
    <span className={`glass-badge ${variantClasses[variant]}`}>
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
}
