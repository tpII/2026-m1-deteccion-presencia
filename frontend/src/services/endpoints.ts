import { ENV } from '../config/env';

export const ENDPOINTS = {
  HEALTH: `${ENV.API_URL}/api/v1/health`,
  PIR_USB_READINGS: `${ENV.API_URL}/api/v1/pir-usb/readings`,
  TELEMETRY_STATUS: `${ENV.API_URL}/api/v1/telemetry/status`,
  TELEMETRY_CASE: (caseId: string) => `${ENV.API_URL}/api/v1/telemetry/${caseId}`,
  TELEMETRY_PIPELINE: (caseId: string) => `${ENV.API_URL}/api/v1/telemetry/${caseId}/pipeline`,
  METRICS_CASE: (caseId: string) => `${ENV.API_URL}/api/v1/metrics/${caseId}`,
  METRICS_COMPARISON: `${ENV.API_URL}/api/v1/metrics/comparison`,
  METRICS_TRIALS: (caseId: string) => `${ENV.API_URL}/api/v1/metrics/${caseId}/trials`,
  RECORD_TRIAL: `${ENV.API_URL}/api/v1/metrics/trial`,
  CASES_LIST: `${ENV.API_URL}/api/v1/cases`,
  CASE_DETAIL: (caseId: string) => `${ENV.API_URL}/api/v1/cases/${caseId}`,
  CONFIG_NODES: `${ENV.API_URL}/api/v1/config/nodes`,
  CONFIG_HEADER: (nodeId: string) => `${ENV.API_URL}/api/v1/config/header/${nodeId}`,
  WS_TELEMETRY: ENV.WS_URL,
};
