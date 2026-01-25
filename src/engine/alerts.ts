import type { PatientState } from "./patientState";
import type { ScenarioConfig } from "./scenarioConfig";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export type Alert = {
  id: string;
  label: string;
  severity: AlertSeverity;
};

export const deriveAlerts = (state: PatientState, config: ScenarioConfig): Alert[] => {
  const alerts: Alert[] = [];
  const { vitals, devices } = state;
  const { thresholds } = config;

  if (!devices.ventOn) {
    alerts.push({ id: "vent-off", label: "Ventilator off", severity: "WARNING" });
  }

  if (vitals.spo2Pct <= thresholds.spo2.critical) {
    alerts.push({ id: "spo2-critical", label: "SpO₂ critical", severity: "CRITICAL" });
  } else if (vitals.spo2Pct <= thresholds.spo2.low) {
    alerts.push({ id: "spo2-low", label: "SpO₂ low", severity: "WARNING" });
  }

  if (vitals.mapMmhg <= thresholds.map.critical) {
    alerts.push({ id: "map-critical", label: "MAP critical", severity: "CRITICAL" });
  } else if (vitals.mapMmhg <= thresholds.map.low) {
    alerts.push({ id: "map-low", label: "MAP low", severity: "WARNING" });
  }

  if (vitals.hrBpm >= thresholds.hr.high) {
    alerts.push({ id: "hr-high", label: "HR elevated", severity: "WARNING" });
  }

  if (vitals.respRpm >= thresholds.rr.high) {
    alerts.push({ id: "rr-high", label: "RR elevated", severity: "WARNING" });
  }

  if (state.shockSuspected) {
    alerts.push({ id: "shock", label: "Shock suspected", severity: "WARNING" });
  }

  if (alerts.length === 0) {
    alerts.push({ id: "stable", label: "No active alerts", severity: "INFO" });
  }

  return alerts;
};
