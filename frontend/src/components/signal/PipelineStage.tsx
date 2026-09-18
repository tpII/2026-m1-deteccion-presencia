import React from 'react';
import { GlassCard } from '../common/GlassCard';

interface PipelineStageProps {
  stepNumber: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const PipelineStage: React.FC<PipelineStageProps> = ({
  stepNumber,
  title,
  subtitle,
  children,
  icon,
}) => {
  return (
    <GlassCard className="pipeline-stage-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'var(--accent-blue)',
              color: '#ffffff',
              fontSize: '0.7rem',
              fontWeight: 700,
            }}
          >
            {stepNumber}
          </span>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {title}
          </span>
        </div>
        {icon && <span style={{ color: 'var(--accent-blue)', opacity: 0.8 }}>{icon}</span>}
      </div>

      {subtitle && (
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{subtitle}</span>
      )}

      <div style={{ flex: 1, marginTop: '0.4rem' }}>{children}</div>
    </GlassCard>
  );
};
