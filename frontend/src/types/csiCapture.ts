export const CSI_ACTIVITIES = {
  empty: 'Vacío',
  walking: 'Caminando',
  seated: 'Sentado quieto',
};

export type CsiActivity = keyof typeof CSI_ACTIVITIES;

export interface CsiCapture {
  id: number;
  environment: string;
  activity: CsiActivity;
  starts_at: string;
  ends_at: string;
}

export interface CsiHeatmap {
  capture: CsiCapture;
  step_seconds: number;
  column_count: number;
  columns: { index: number; relative_amplitudes: number[] }[];
}

export interface CsiCaptureComparison {
  as_of: string;
  active_capture: CsiCapture | null;
  heatmaps: CsiHeatmap[];
}

export interface CsiCapturePreview {
  active: boolean;
  heatmap: CsiHeatmap;
}
