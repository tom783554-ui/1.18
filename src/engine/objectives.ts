import type { Objective, PatientState } from "./patientState";
import type { ScenarioConfig } from "./updatePatient";

const objectiveLabel = (scenario: ScenarioConfig) => ({
  vent: "Ventilator running",
  spo2: `Maintain SpO₂ ≥ ${scenario.objectives.spo2MaintainMin}% for ${scenario.objectives.spo2MaintainSec}s`,
  hr: `Stabilize HR ${scenario.objectives.hrMin}–${scenario.objectives.hrMax}`
});

export const createInitialObjectives = (scenario: ScenarioConfig): Objective[] => {
  const labels = objectiveLabel(scenario);
  return [
    { id: "vent", label: labels.vent, done: false },
    {
      id: "spo2",
      label: labels.spo2,
      done: false,
      progressSec: 0,
      targetSec: scenario.objectives.spo2MaintainSec
    },
    { id: "hr", label: labels.hr, done: false }
  ];
};

export const updateObjectives = (
  state: PatientState,
  scenario: ScenarioConfig,
  dtSec: number
): Objective[] => {
  const labels = objectiveLabel(scenario);
  return state.objectives.map((objective) => {
    switch (objective.id) {
      case "vent": {
        return {
          ...objective,
          label: labels.vent,
          done: objective.done || state.ventOn
        };
      }
      case "spo2": {
        if (objective.done) {
          return { ...objective, label: labels.spo2 };
        }
        const targetSec = scenario.objectives.spo2MaintainSec;
        const threshold = scenario.objectives.spo2MaintainMin;
        const progressSec = state.spo2 >= threshold ? (objective.progressSec ?? 0) + dtSec : 0;
        return {
          ...objective,
          label: labels.spo2,
          targetSec,
          progressSec,
          done: progressSec >= targetSec
        };
      }
      case "hr": {
        const inRange =
          state.hr >= scenario.objectives.hrMin && state.hr <= scenario.objectives.hrMax;
        return {
          ...objective,
          label: labels.hr,
          done: objective.done || inRange
        };
      }
      default:
        return objective;
    }
  });
};
