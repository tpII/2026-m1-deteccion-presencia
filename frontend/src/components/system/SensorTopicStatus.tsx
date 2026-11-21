import { CASE_LABELS } from '../../config/cases';
import type { LiveTrialCase } from '../../types/metrics';
import { StatusBadge } from '../ui/StatusBadge';

const TOPICS: Record<LiveTrialCase, string> = {
  pir: 'sensores/pir/estado_esp32',
  csi_router: 'sensores/csi/estado_esp32',
};

export function SensorTopicStatus({ caseId, connected }: { caseId: LiveTrialCase; connected: boolean }) {
  return (
    <div className="sensor-topic" role="status">
      <StatusBadge label={`${CASE_LABELS[caseId]} · ${connected ? 'Online' : 'Offline'}`}
        variant={connected ? 'live' : 'error'} />
      <code>{TOPICS[caseId]}</code>
    </div>
  );
}
