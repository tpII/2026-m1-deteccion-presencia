import { Activity, Radio, Share2, Wifi, Zap } from 'lucide-react';
import { GlassPanel } from '../components/ui/GlassPanel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { MethodCard } from '../components/metrics/MethodCard';
import { SignalProcessingPipeline } from '../components/signal/SignalProcessingPipeline';
import { useTelemetry } from '../hooks/useTelemetry';

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
          <span className="glass-badge">{statuses.some((status) => status.is_connected) ? 'Recibiendo hardware' : 'Esperando hardware'}</span>
        </div>
      </GlassPanel>
      <section>
        <SectionHeader title="Métodos experimentales" subtitle="Presencia, muestras y latencia de cada método" icon={<Activity size={18} />} />
        <div className="grid-3">
          <MethodCard title="Caso 1 — PIR" subtitle="Sensor infrarrojo pasivo" icon={<Radio size={22} />} accent="#10b981" status={getCaseStatus('pir')} path="/case/pir" />
          <MethodCard title="Caso 2 — CSI + Router" subtitle="Red Wi-Fi comercial" icon={<Wifi size={22} />} accent="#0284c7" status={getCaseStatus('csi_router')} path="/case/csi_router" />
          <MethodCard title="Caso 3 — CSI Dedicado" subtitle="Enlace AP-STA con ESP32" icon={<Share2 size={22} />} accent="#6366f1" status={getCaseStatus('csi_dedicated')} path="/case/csi_dedicated" />
        </div>
      </section>
      <section>
        <SectionHeader title="Procesamiento CSI en tiempo real" subtitle="Señal cruda → Filtros → Características → Detección" icon={<Activity size={18} />} />
        <SignalProcessingPipeline data={getCaseData('csi_router')} />
      </section>
    </div>
  );
}
