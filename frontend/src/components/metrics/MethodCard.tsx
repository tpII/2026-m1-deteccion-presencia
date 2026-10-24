import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { PresenceBadge } from '../ui/PresenceBadge';
import type { CaseCurrentStatus } from '../../types/telemetry';

interface MethodCardProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  accent: string;
  status?: CaseCurrentStatus;
  path: string;
}

export function MethodCard({ title, subtitle, icon, accent, status, path }: MethodCardProps) {
  const latency = status?.current_latency_ms ?? 0;
  return (
    <Link to={path} className="glass-card glass-card-interactive method-card">
      <div className="overview-card-heading">
        <div className="method-heading">
          <div className="method-icon" style={{ color: accent }}>{icon}</div>
          <div><h3>{title}</h3><p>{subtitle}</p></div>
        </div>
        <PresenceBadge presence={status?.presence ?? false} connected={status?.is_connected ?? false} />
      </div>
      <dl className="method-readings">
        <div><dt>Latencia</dt><dd>{latency > 0 ? `${latency} ms` : 'Sin medir'}</dd></div>
        <div><dt>Muestras</dt><dd>{status?.total_samples ?? 0}</dd></div>
      </dl>
      <div className="method-link"><span>Ver análisis detallado</span><ArrowRight size={16} /></div>
    </Link>
  );
}
