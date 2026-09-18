import React from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  action,
  icon,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.1rem',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {icon && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-blue-light)',
              color: 'var(--accent-blue)',
            }}
          >
            {icon}
          </div>
        )}
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{title}</h2>
          {subtitle && (
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
};
