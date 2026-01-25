import type { PatientState } from "./patientState";
import type { ScenarioConfig } from "./scenarioConfig";

export type ObjectiveDefinition = {
  id: string;
  label: string;
  durationSec: number | null;
  evaluate: (state: PatientState) => boolean;
};

export type ObjectiveProgress = {
  id: string;
  label: string;
  done: boolean;
  durationSec: number | null;
  progressSec: number;
};

export type ObjectiveState = {
  objectives: ObjectiveProgress[];
};

export const createObjectiveDefinitions = (config: ScenarioConfig): ObjectiveDefinition[] => {
  const shared = [
    {
      id: "vent",
      label: "Ventilator running",
      durationSec: null,
      evaluate: (state: PatientState) => state.devices.ventOn
    },
    {
      id: "spo2",
      label: `Maintain SpO₂ ≥ ${config.thresholds.spo2.low}% for ${config.objectives.maintainSpo2Sec}s`,
      durationSec: config.objectives.maintainSpo2Sec,
      evaluate: (state: PatientState) => state.vitals.spo2Pct >= config.thresholds.spo2.low
    },
    {
      id: "hr",
      label: `Stabilize HR ${config.objectives.hrRange.min}–${config.objectives.hrRange.max} for ${config.objectives.maintainHrSec}s`,
      durationSec: config.objectives.maintainHrSec,
      evaluate: (state: PatientState) =>
        state.vitals.hrBpm >= config.objectives.hrRange.min &&
        state.vitals.hrBpm <= config.objectives.hrRange.max
    }
  ];

  if (config.id === "shock") {
    shared.push({
      id: "map",
      label: `Maintain MAP ≥ ${config.thresholds.map.low} for ${config.objectives.maintainMapSec}s`,
      durationSec: config.objectives.maintainMapSec,
      evaluate: (state: PatientState) => state.vitals.mapMmhg >= config.thresholds.map.low
    });
  }

  return shared;
};

export const createObjectiveState = (config: ScenarioConfig): ObjectiveState => {
  const definitions = createObjectiveDefinitions(config);
  return {
    objectives: definitions.map((definition) => ({
      id: definition.id,
      label: definition.label,
      durationSec: definition.durationSec,
      progressSec: 0,
      done: false
    }))
  };
};

export const updateObjectives = (
  state: PatientState,
  config: ScenarioConfig,
  dtSec: number
): ObjectiveState => {
  const definitions = createObjectiveDefinitions(config);
  const nextObjectives = definitions.map((definition) => {
    const existing = state.objectiveState.objectives.find((entry) => entry.id === definition.id);
    const wasProgress = existing?.progressSec ?? 0;
    const meets = definition.evaluate(state);
    if (definition.durationSec === null) {
      return {
        id: definition.id,
        label: definition.label,
        durationSec: definition.durationSec,
        progressSec: meets ? definition.durationSec ?? 0 : 0,
        done: meets
      };
    }
    const nextProgress = meets ? Math.min(definition.durationSec, wasProgress + dtSec) : 0;
    return {
      id: definition.id,
      label: definition.label,
      durationSec: definition.durationSec,
      progressSec: nextProgress,
      done: nextProgress >= definition.durationSec
    };
  });

  return { objectives: nextObjectives };
};
