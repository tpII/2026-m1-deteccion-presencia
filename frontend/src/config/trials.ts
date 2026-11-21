import type { LiveTrialCase, TrialScenario } from '../types/metrics';

export const SCENARIO_LABELS: Record<TrialScenario, string> = {
  present: 'Presencia',
  absent: 'Sin presencia',
  left_of_pir: 'Presencia a la izquierda del PIR',
  right_of_pir: 'Presencia a la derecha del PIR',
  near_router: 'Presencia cerca del router Wi-Fi',
};

export const SCENARIOS: Record<LiveTrialCase, TrialScenario[]> = {
  pir: ['present', 'absent'],
  csi_router: ['present', 'left_of_pir', 'right_of_pir', 'near_router', 'absent'],
};
