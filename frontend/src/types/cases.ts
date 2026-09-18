import { CaseId } from './telemetry';

export interface CaseStudyDetail {
  id: CaseId;
  name: string;
  short_name: string;
  description: string;
  technology: string;
  hardware: string;
  signal_nature: string;
  advantages: string[];
  limitations: string[];
}
