import type React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function GlassCard({
  children,
  className = '',
  style,
}: GlassCardProps) {
  return (
    <div
      className={`glass-card ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
