import React from 'react';
import { GlassCard } from '../common/GlassCard';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accentColor?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  subtitle,
  icon,
  accentColor,
}) => {
  return (
    <GlassCard>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span className="metric-card-label">{label}</span>
        {icon && (
          <div
            style={{
              color: accentColor || 'var(--accent-blue)',
              opacity: 0.85,
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="metric-card-value-row" style={{ marginTop: '0.4rem' }}>
        <span
          className="metric-card-value"
          style={{ color: accentColor || 'var(--text-primary)' }}
        >
          {value}
        </span>
        {unit && <span className="metric-card-unit">{unit}</span>}
      </div>

      {subtitle && (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
          {subtitle}
        </p>
      )}
    </GlassCard>
  );
};
