import { useState } from 'react';
import { Crosshair } from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';
import { api } from '../../services/api';
import type { CalibrationInfo, CaseId } from '../../types/telemetry';

interface CalibrationPanelProps {
  caseId: Exclude<CaseId, 'pir'>;
  calibration?: CalibrationInfo | null;
  connected: boolean;
}

const STATE_LABELS = {
  sin_calibrar: { label: 'Sin calibrar', variant: 'warning' },
  esperando: { label: 'Salí de la habitación', variant: 'warning' },
  calibrando: { label: 'Calibrando', variant: 'live' },
  calibrado: { label: 'Calibrado', variant: 'presence' },
} as const;

/** Calibración en el lugar: registra la habitación vacía para fijar los umbrales del detector. */
export function CalibrationPanel({ caseId, calibration, connected }: CalibrationPanelProps) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = calibration?.state ?? 'sin_calibrar';
  const running = state === 'esperando' || state === 'calibrando';
  const { label, variant } = STATE_LABELS[state];

  async function start() {
    setSending(true);
    setError(null);
    try {
      await api.startCsiCalibration(caseId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo iniciar la calibración');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="calibration-panel">
      <div className="calibration-header">
        <StatusBadge
          label={running ? `${label} · ${Math.ceil(calibration?.seconds_remaining ?? 0)} s` : label}
          variant={variant}
          pulsing={running}
        />
        <button className="primary-button" onClick={start} disabled={sending || running || !connected}>
          <Crosshair size={15} /> {state === 'calibrado' ? 'Recalibrar' : 'Calibrar'}
        </button>
      </div>
      <p className="calibration-message">
        {connected ? calibration?.message ?? 'Esperando estado del detector.' : 'Conectá el ESP32 para poder calibrar.'}
      </p>
      {running && (
        <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={Math.round((calibration?.progress ?? 0) * 100)}>
          <div className="progress-fill" style={{ width: `${(calibration?.progress ?? 0) * 100}%` }} />
        </div>
      )}
      {error && <p role="alert" className="form-error">{error}</p>}
    </div>
  );
}
