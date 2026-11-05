import { PresenceBadge } from '../ui/PresenceBadge';
import { StatusBadge } from '../ui/StatusBadge';
import type { CalibrationInfo, CaseCurrentStatus } from '../../types/telemetry';

interface SensorStateBadgeProps {
  kind: 'pir' | 'csi';
  status?: CaseCurrentStatus;
  calibration?: CalibrationInfo | null;
}

export function SensorStateBadge({ kind, status, calibration }: SensorStateBadgeProps) {
  if (!status?.is_connected) return <StatusBadge label="SIN LECTURA" />;
  if (kind === 'pir') {
    return <StatusBadge label={status.presence ? 'MOVIMIENTO' : 'SIN MOVIMIENTO'} variant={status.presence ? 'presence' : 'absence'} />;
  }
  if (calibration?.state !== 'calibrado') {
    const label = calibration?.state === 'calibrando' ? 'CALIBRANDO'
      : calibration?.state === 'esperando' ? 'ESPERANDO CALIBRACIÓN' : 'SIN CALIBRAR';
    return <StatusBadge label={label} variant="warning" />;
  }
  return <PresenceBadge presence={status.presence} />;
}
