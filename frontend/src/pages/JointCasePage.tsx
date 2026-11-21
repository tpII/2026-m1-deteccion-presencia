import { Activity, Radio, Share2, Wifi } from 'lucide-react';
import { GlassPanel } from '../components/ui/GlassPanel';
import { SectionHeader } from '../components/ui/SectionHeader';
import { DigitalSignalChart } from '../components/charts/DigitalSignalChart';
import { IndicatorChart } from '../components/charts/IndicatorChart';
import { CsiRawSignalChart } from '../components/charts/CsiRawSignalChart';
import { CalibrationPanel } from '../components/signal/CalibrationPanel';
import { CsiCapturePanel } from '../components/signal/CsiCapturePanel';
import { EnvironmentField, useTrialEnvironment } from '../components/system/EnvironmentField';
import { LiveTrialControls } from '../components/system/LiveTrialControls';
import { SensorTopicStatus } from '../components/system/SensorTopicStatus';
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

function JointMeanAmplitude() {
  const { getCaseData } = useTelemetry();
  return (
    <section className="joint-mean-amplitude" aria-label="Amplitud media de las subportadoras">
      <CsiRawSignalChart title="Amplitud media" points={getCaseData('csi_router')?.raw_points}
        height="var(--csi-heatmap-height)" />
    </section>
  );
}

const meanAmplitudePlot = <JointMeanAmplitude />;

export function JointCasePage() {
  const { getCaseStatus, getCaseData } = useTelemetry();
  const [environment, setEnvironment] = useTrialEnvironment('combined');
  const pirStatus = getCaseStatus('pir');
  const csiStatus = getCaseStatus('csi_router');
  const pir = getCaseData('pir');
  const csi = getCaseData('csi_router');
  const features = csi?.features;
  const connectedCount = Number(Boolean(pirStatus?.is_connected)) + Number(Boolean(csiStatus?.is_connected));

  return (
    <div className="page-stack joint-page">
      <GlassPanel className="joint-overview">
        <div className="joint-overview-heading">
          <h1><Share2 size={16} /> Caso 3 — PIR + CSI</h1>
          <span className="glass-badge">{connectedCount} de 2 sensores en línea</span>
        </div>
        <div className="sensor-topics">
          <SensorTopicStatus caseId="pir" connected={pirStatus?.is_connected ?? false} />
          <SensorTopicStatus caseId="csi_router" connected={csiStatus?.is_connected ?? false} />
        </div>
        <nav className="joint-chart-links" aria-label="Gráficos de la prueba conjunta">
          <a href="#senales-en-vivo">Señales en vivo</a>
          <a href="#mapas-csi">Subportadoras de CSI</a>
        </nav>
      </GlassPanel>

      <GlassPanel className="joint-preparation">
        <div className="joint-preparation-heading">
          <h2>Preparar la prueba conjunta</h2>
          <p>PIR y CSI comparten el ambiente de esta prueba.</p>
        </div>
        <div className="grid-2 joint-preparation-controls">
          <div className="trial-form trial-environment">
            <EnvironmentField value={environment} onChange={setEnvironment} required={false} />
          </div>
          <section className="joint-calibration" aria-label="Calibración CSI de la prueba conjunta">
            <h3>Calibración CSI</h3>
            <CalibrationPanel calibration={csi?.calibration}
              connected={csiStatus?.is_connected ?? false} environment={environment.trim()} />
          </section>
        </div>
      </GlassPanel>

      <div className="joint-sensors joint-chart-section" id="senales-en-vivo">
        <section className="glass-panel joint-sensor" aria-label="PIR en la prueba conjunta">
          <header className="joint-sensor-heading">
            <h2><Radio size={18} /> PIR — Movimiento</h2>
            <SensorReadings status={pirStatus} />
          </header>
          <LiveTrialControls caseId="pir" status={pirStatus} environment={environment} showObservationHelp={false}>
            <div className="joint-signal">
              <DigitalSignalChart points={pir?.raw_points ?? []} title="Salida digital del PIR" height="var(--joint-signal-height)" />
            </div>
          </LiveTrialControls>
        </section>

        <section className="glass-panel joint-sensor" aria-label="CSI en la prueba conjunta">
          <header className="joint-sensor-heading">
            <h2><Wifi size={18} /> CSI — Presencia</h2>
            <SensorReadings status={csiStatus} />
          </header>
          <LiveTrialControls caseId="csi_router" status={csiStatus} calibration={csi?.calibration}
            environment={environment} showObservationHelp={false}>
            <div className="joint-signal joint-csi-indicators">
              <IndicatorChart title="Movimiento del canal" points={csi?.movement_points ?? []}
                threshold={features?.movement_threshold} height="var(--joint-signal-height)" />
              <IndicatorChart title="Forma del canal" points={csi?.shape_points ?? []}
                threshold={features?.shape_threshold} height="var(--joint-signal-height)" />
            </div>
          </LiveTrialControls>
          {csi?.calibration?.state !== 'calibrado' && (
            <p className="muted">Las marcas de CSI se habilitan al terminar la calibración.</p>
          )}
        </section>
      </div>

      <section id="mapas-csi" className="glass-panel joint-chart-section joint-subcarriers" aria-labelledby="joint-subcarriers-heading">
        <h2 id="joint-subcarriers-heading">Subportadoras de CSI</h2>
        <CsiCapturePanel environment={environment.trim()} connected={csiStatus?.is_connected ?? false}>
          {meanAmplitudePlot}
        </CsiCapturePanel>
      </section>

      <GlassPanel>
        <SectionHeader title="Cómo realizar la prueba conjunta" icon={<Activity size={18} />} />
        <ol className="joint-steps">
          <li>Ingresá el ambiente, encendé ambas placas y comprobá que reciben muestras.</li>
          <li>Calibrá CSI y dejá la habitación vacía durante el tiempo indicado.</li>
          <li>Probá caminando, sentado quieto y con el ambiente vacío. Observá cada respuesta por separado.</li>
          <li>Marcá la presencia observada en cada sensor. La marca se aplica a las muestras siguientes hasta que la cambies o termines la observación.</li>
        </ol>
        <p className="muted">Un 0 del PIR significa que no detectó movimiento. Una persona quieta puede seguir presente.</p>
        <p className="muted">El PIR se lee cada 500 ms nominales y CSI usa una ventana de 4 s. Son adquisiciones independientes; sus respuestas pueden cambiar en momentos diferentes.</p>
      </GlassPanel>
    </div>
  );
}
