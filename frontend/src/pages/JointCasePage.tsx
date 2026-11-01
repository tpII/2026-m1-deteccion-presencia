import { Activity, Radio, Share2, Wifi } from 'lucide-react';
import { GlassPanel } from '../components/ui/GlassPanel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { DigitalSignalChart } from '../components/charts/DigitalSignalChart';
import { IndicatorChart } from '../components/charts/IndicatorChart';
import { CalibrationPanel } from '../components/signal/CalibrationPanel';
import { SensorStateBadge } from '../components/signal/SensorStateBadge';
import { useTelemetry } from '../hooks/useTelemetry';
import type { CaseCurrentStatus } from '../types/telemetry';

function SensorReadings({ status }: { status?: CaseCurrentStatus }) {
  const latency = status?.current_latency_ms ?? 0;
  return (
    <dl className="method-readings">
      <div><dt>Muestras recibidas</dt><dd>{status?.total_samples ?? 0}</dd></div>
      <div><dt>Latencia</dt><dd>{status?.is_connected && latency > 0 ? `${latency} ms` : 'Sin medir'}</dd></div>
    </dl>
  );
}

export function JointCasePage() {
  const { getCaseStatus, getCaseData } = useTelemetry();
  const pirStatus = getCaseStatus('pir');
  const csiStatus = getCaseStatus('csi_router');
  const pir = getCaseData('pir');
  const csi = getCaseData('csi_router');
  const features = csi?.features;
  const connectedCount = Number(Boolean(pirStatus?.is_connected)) + Number(Boolean(csiStatus?.is_connected));

  return (
    <div className="page-stack">
      <GlassPanel>
        <div className="page-heading">
          <div>
            <p className="page-eyebrow"><Share2 size={14} />Prueba conjunta en tiempo real</p>
            <h1>Caso 3 — PIR + CSI</h1>
            <p>Observá al mismo tiempo el movimiento detectado por el PIR y la presencia estimada mediante CSI con router.</p>
          </div>
          <span className="glass-badge" role="status">{connectedCount} de 2 sensores con lecturas</span>
        </div>
        <p className="joint-explanation">Cada sensor conserva su estado y sus gráficos. Compará sus respuestas al caminar, permanecer quieto y dejar el ambiente vacío.</p>
      </GlassPanel>

      <div className="grid-2 joint-sensors">
        <section className="joint-sensor" aria-label="PIR en la prueba conjunta">
          <GlassPanel>
            <SectionHeader title="PIR — Movimiento" subtitle="Caso 1 · Sensor infrarrojo pasivo" icon={<Radio size={18} />}
              action={<SensorStateBadge kind="pir" status={pirStatus} />} />
            <SensorReadings status={pirStatus} />
            <DigitalSignalChart points={pir?.raw_points ?? []} title="Salida PIR · 0 sin movimiento / 1 movimiento" height={280} />
            {!pirStatus?.is_connected && <p role="status" className="muted">Esperando nuevas lecturas del PIR.</p>}
            <p className="muted">Una salida baja indica ausencia de movimiento; puede haber una persona quieta.</p>
          </GlassPanel>
        </section>

        <section className="joint-sensor" aria-label="CSI en la prueba conjunta">
          <GlassPanel>
            <SectionHeader title="CSI — Presencia" subtitle="Caso 2 · ESP32 y router Wi-Fi" icon={<Wifi size={18} />}
              action={<SensorStateBadge kind="csi" status={csiStatus} calibration={csi?.calibration} />} />
            <SensorReadings status={csiStatus} />
            <CalibrationPanel caseId="csi_router" calibration={csi?.calibration} connected={csiStatus?.is_connected ?? false} />
            <IndicatorChart title="Movimiento del canal" points={csi?.movement_points ?? []} threshold={features?.movement_threshold} />
            <IndicatorChart title="Forma respecto del ambiente vacío" points={csi?.shape_points ?? []} threshold={features?.shape_threshold} />
            {!csiStatus?.is_connected && <p role="status" className="muted">Esperando nuevas lecturas del ESP32 CSI.</p>}
            <p className="muted">Calibrá con la habitación vacía antes de evaluar la detección. La calibración es la misma que en el Caso 2.</p>
          </GlassPanel>
        </section>
      </div>

      <GlassPanel>
        <SectionHeader title="Cómo realizar la prueba conjunta" icon={<Activity size={18} />} />
        <ol className="joint-steps">
          <li>Encendé las placas de PIR y CSI con router y comprobá que ambas reciben muestras.</li>
          <li>Calibrá CSI y dejá la habitación vacía durante el tiempo indicado.</li>
          <li>Probá caminando, sentado quieto y con el ambiente vacío. Observá cada respuesta por separado.</li>
          <li>Registrá los resultados de PIR y CSI en Sistema &amp; Hardware para compararlos.</li>
        </ol>
        <p className="muted">El PIR se lee cada 500 ms nominales y CSI usa una ventana de 4 s. Son adquisiciones independientes; sus respuestas pueden cambiar en momentos diferentes.</p>
      </GlassPanel>
    </div>
  );
}
