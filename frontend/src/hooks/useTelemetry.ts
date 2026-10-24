import { useTelemetryContext } from '../context/TelemetryContext';
import type { CaseId } from '../types/telemetry';

export function useTelemetry() {
  const { data, connectionState } = useTelemetryContext();
  const statuses = (data?.statuses ?? []).map((status) => ({
    ...status,
    is_connected: connectionState === 'LIVE' && status.is_connected,
  }));
  const casesData = data?.cases ?? {};

  return {
    statuses,
    casesData,
    connectionState,
    loading: data === null,
    getCaseStatus: (caseId: CaseId) => statuses.find((status) => status.case_id === caseId),
    getCaseData: (caseId: CaseId) => casesData[caseId],
  };
}
