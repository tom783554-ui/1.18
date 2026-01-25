import type { PatientState } from "./patientState";
import { AlertSeverity } from "./patientState";
import type { ScenarioConfig } from "./updatePatient";

export const deriveAlerts = (state: PatientState, scenario: ScenarioConfig): PatientState["alerts"] => {
  const alerts: PatientState["alerts"] = [];

  if (!state.ventOn) {
    alerts.push({
      id: "vent-off",
      label: "Ventilator off",
      severity: AlertSeverity.WARNING
    });
  }

  if (state.defibCharged) {
    alerts.push({
      id: "defib-charged",
      label: "Defibrillator charged",
      severity: AlertSeverity.INFO
    });
  }

  if (state.defibShockAtSec !== null && state.timeSec - state.defibShockAtSec <= 12) {
    alerts.push({
      id: "defib-shock",
      label: "Defibrillation delivered",
      severity: AlertSeverity.INFO
    });
  }

  if (state.bvmActive) {
    alerts.push({
      id: "bvm-active",
      label: "Manual ventilation applied",
      severity: AlertSeverity.INFO
    });
  }

  if (state.spo2 < scenario.thresholds.spo2Critical) {
    alerts.push({
      id: "spo2-critical",
      label: "SpO₂ critical",
      severity: AlertSeverity.CRITICAL
    });
  } else if (state.spo2 < scenario.thresholds.spo2Low) {
    alerts.push({
      id: "spo2-low",
      label: "SpO₂ low",
      severity: AlertSeverity.WARNING
    });
  }

  if (state.hr > scenario.thresholds.hrHigh) {
    alerts.push({
      id: "hr-high",
      label: "HR elevated",
      severity: AlertSeverity.WARNING
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "stable",
      label: "No active alerts",
      severity: AlertSeverity.INFO
    });
  }

  return alerts;
};
