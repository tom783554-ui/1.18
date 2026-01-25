export enum AlertSeverity {
  INFO,
  WARNING,
  CRITICAL
}

export type Alert = {
  id: string;
  label: string;
  severity: AlertSeverity;
};

export type Objective = {
  id: string;
  label: string;
  done: boolean;
  progressSec?: number;
  targetSec?: number;
};

export interface PatientState {
  timeSec: number;

  spo2: number;
  hr: number;
  rr: number;
  map: number;

  ventOn: boolean;
  fio2: number;
  bvmActive: boolean;
  bvmBoostUntil: number | null;
  defibCharged: boolean;
  defibShockAtSec: number | null;

  alerts: Alert[];
  objectives: Objective[];

  dx: string | null;
  steps: string[];
  roleFocus: string | null;
}
