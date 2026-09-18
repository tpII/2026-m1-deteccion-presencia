import React from 'react';
import { MetricCard } from './MetricCard';
import { CaseMetrics } from '../../types/metrics';
import { Target, AlertTriangle, Clock } from 'lucide-react';

interface MetricsGridProps {
  metrics: CaseMetrics | null;
  loading?: boolean;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics, loading = false }) => {
  if (loading || !metrics) {
    return (
      <div className="grid-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="glass-card"
            style={{ height: '110px', opacity: 0.5, animation: 'pulse 1.5s infinite' }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid-4">
      <MetricCard
        label="Tasa de Detección"
        value={metrics.detection_rate}
        unit="%"
        subtitle={`${metrics.correct_detections} de ${metrics.total_tests} ensayos válidos`}
        icon={<Target size={18} />}
        accentColor="#059669"
      />

      <MetricCard
        label="Falsos Positivos"
        value={metrics.false_positives}
        unit="ensayos"
        subtitle="Alarmas espurias sin presencia real"
        icon={<AlertTriangle size={18} />}
        accentColor="#d97706"
      />

      <MetricCard
        label="Falsos Negativos"
        value={metrics.false_negatives}
        unit="ensayos"
        subtitle="Omisión de presencia humana real"
        icon={<AlertTriangle size={18} />}
        accentColor="#dc2626"
      />

      <MetricCard
        label="Latencia Media"
        value={metrics.average_latency_ms}
        unit="ms"
        subtitle="Tiempo de respuesta extremo a extremo"
        icon={<Clock size={18} />}
        accentColor="#0284c7"
      />
    </div>
  );
};
