import React from 'react';
import { UserCheck, UserX } from 'lucide-react';

interface PresenceBadgeProps {
  presence: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const PresenceBadge: React.FC<PresenceBadgeProps> = ({ presence, size = 'md' }) => {
  const iconSize = size === 'lg' ? 18 : size === 'sm' ? 12 : 14;

  const styleBySize = {
    sm: { padding: '0.2rem 0.55rem', fontSize: '0.72rem' },
    md: { padding: '0.35rem 0.8rem', fontSize: '0.82rem' },
    lg: { padding: '0.55rem 1.1rem', fontSize: '0.95rem' },
  }[size];

  if (presence) {
    return (
      <span
        className="glass-badge presence-active"
        style={{ ...styleBySize, fontWeight: 600 }}
      >
        <UserCheck size={iconSize} />
        <span>PRESENCIA</span>
      </span>
    );
  }

  return (
    <span
      className="glass-badge presence-inactive"
      style={{ ...styleBySize, fontWeight: 500 }}
    >
      <UserX size={iconSize} />
      <span>AUSENCIA</span>
    </span>
  );
};
