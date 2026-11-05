import { Activity, ArrowRight, Radio, Share2, Wifi, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlassPanel } from '../components/ui/GlassPanel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { MethodCard } from '../components/metrics/MethodCard';
import { SignalProcessingPipeline } from '../components/signal/SignalProcessingPipeline';
import { useTelemetry } from '../hooks/useTelemetry';
import { SensorStateBadge } from '../components/signal/SensorStateBadge';
import { ACTIVE_CASES } from '../config/cases';

export function OverviewPage() {
  const { statuses, getCaseStatus, getCaseData } = useTelemetry();
  return (
    <div className="page-stack">
      <GlassPanel>
        <div className="page-heading">
          <div>
            <p className="page-eyebrow"><Zap size={14} />Proyecto de Ingeniería · Taller II</p>
            <h1>Detección de Presencia</h1>
            <p>Plataforma experimental para comparar sensores PIR y detección mediante Channel State Information (CSI) en redes Wi-Fi.</p>
          </div>
          <span className="glass-badge">{statuses.some((status) => status.is_connected && ACTIVE_CASES.some((id) => id === status.case_id)) ? 'Recibiendo hardware' : 'Esperando hardware'}</span>
        </div>
      </GlassPanel>
      <section>
        <SectionHeader title="Casos experimentales" subtitle="PIR, CSI con router y prueba conjunta" icon={<Activity size={18} />} />
        <div className="grid-3">
          <MethodCard title="Caso 1 — PIR" subtitle="Sensor infrarrojo pasivo" icon={<Radio size={22} />} accent="#10b981" status={getCaseStatus('pir')} path="/case/pir" />
          <MethodCard title="Caso 2 — CSI + Router" subtitle="Red Wi-Fi comercial" icon={<Wifi size={22} />} accent="#0284c7" status={getCaseStatus('csi_router')} path="/case/csi_router" />
          <Link to="/case/combined" className="glass-card glass-card-interactive method-card">
            <div className="method-heading">
              <div className="method-icon" style={{ color: '#6366f1' }}><Share2 size={22} /></div>
              <div><h3>Caso 3 — PIR + CSI</h3><p>Ambos sensores en tiempo real</p></div>
            </div>
            <dl className="joint-card-states">
              <div><dt>PIR</dt><dd><SensorStateBadge kind="pir" status={getCaseStatus('pir')} /></dd></div>
              <div><dt>CSI</dt><dd><SensorStateBadge kind="csi" status={getCaseStatus('csi_router')} calibration={getCaseData('csi_router')?.calibration} /></dd></div>
            </dl>
            <div className="method-link"><span>Ver prueba conjunta</span><ArrowRight size={16} /></div>
          </Link>
        </div>
      </section>
      <section>
        <SectionHeader title="Procesamiento CSI en tiempo real" subtitle="Señal cruda → Normalización → Indicadores → Umbrales → Detección" icon={<Activity size={18} />} />
        <SignalProcessingPipeline data={getCaseData('csi_router')} />
      </section>
    </div>
  );
}
