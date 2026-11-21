import { useRef, useState } from 'react';
import { SCENARIOS, SCENARIO_LABELS } from '../../config/trials';
import { api } from '../../services/api';
import type { LiveTrialCase, TrialScenario } from '../../types/metrics';
import type { CalibrationInfo, CaseCurrentStatus } from '../../types/telemetry';
import { SensorStateBadge } from '../signal/SensorStateBadge';
import { ObservationReportPanel } from './ObservationReportPanel';

interface LiveTrialControlsProps {
  caseId: LiveTrialCase;
  status?: CaseCurrentStatus;
  environment: string;
  calibration?: CalibrationInfo | null;
  showReport?: boolean;
}

export function LiveTrialControls({ caseId, status, environment, calibration, showReport = false }: LiveTrialControlsProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportRevision, setReportRevision] = useState(0);
  const latestMark = useRef(0);
  const isPir = caseId === 'pir';
  const canShowButtons = isPir || calibration?.state === 'calibrado';
  const hasReading = status?.is_connected && status.can_record_trial;
  const hasEnvironment = Boolean(environment.trim());

  async function record(scenario: TrialScenario | null) {
    if (!hasEnvironment) return;
    const observedAt = new Date().toISOString();
    const markNumber = ++latestMark.current;
    const label = scenario ? SCENARIO_LABELS[scenario] : 'Fin de observación';
    setPendingCount((count) => count + 1);
    setError('');
    setNotice('');
    try {
      const mark = await api.recordObservation({
        case_id: caseId, scenario, environment: environment.trim(), observed_at: observedAt,
      });
      if (latestMark.current === markNumber) setNotice(`Marca #${mark.id} guardada. ${label}.`);
      setReportRevision((revision) => revision + 1);
    } catch {
      setError(`No se pudo guardar la marca «${label}».`);
    } finally {
      setPendingCount((count) => count - 1);
    }
  }

  return (
    <div className="live-trial">
      <div className="live-trial-reading" role="status">
        <strong>Lectura de {isPir ? 'PIR' : 'CSI'}</strong>
        <SensorStateBadge kind={isPir ? 'pir' : 'csi'}
          status={canShowButtons && !hasReading ? undefined : status} calibration={calibration} />
      </div>
      {canShowButtons && (
        <fieldset className="live-trial-method" disabled={!hasEnvironment}>
          <legend>Presencia observada</legend>
          <p>La marca se aplica a las muestras siguientes hasta que la cambies o termines la observación.</p>
          <div className="live-trial-buttons">
            {SCENARIOS[caseId].map((scenario) => (
              <button key={scenario} type="button" className="secondary-button"
                onClick={() => void record(scenario)}>
                {SCENARIO_LABELS[scenario]}
              </button>
            ))}
            <button type="button" className="secondary-button" onClick={() => void record(null)}>
              Terminar observación
            </button>
          </div>
          {!hasEnvironment && <p className="muted">Ingresá el ambiente para habilitar el registro.</p>}
        </fieldset>
      )}
      {pendingCount > 0 && <p role="status">Guardando marcas ({pendingCount})…</p>}
      {notice && <p role="status" className="form-notice">{notice}</p>}
      {error && <p role="alert" className="form-error">{error}</p>}
      {showReport && hasEnvironment && (
        <details onToggle={(event) => setReportOpen(event.currentTarget.open)}>
          <summary>Análisis de observaciones</summary>
          {reportOpen && <ObservationReportPanel caseId={caseId} environment={environment.trim()} revision={reportRevision} />}
        </details>
      )}
    </div>
  );
}
