import scenario from "./scenarios/respFailure.json";
import type { PatientState } from "./patientState";
import { deriveAlerts } from "./alerts";
import { createInitialObjectives, updateObjectives } from "./objectives";
import { updatePatient, type ScenarioConfig } from "./updatePatient";

const scenarioConfig = scenario as ScenarioConfig;

export class Engine {
  private state: PatientState;

  constructor() {
    this.state = this.initializeState();
  }

  private initializeState(): PatientState {
    const initial: PatientState = {
      timeSec: 0,
      spo2: scenarioConfig.baseline.spo2,
      hr: scenarioConfig.baseline.hr,
      rr: scenarioConfig.baseline.rr,
      map: scenarioConfig.baseline.map,
      ventOn: true,
      fio2: scenarioConfig.fio2Effect.min,
      bvmActive: false,
      bvmBoostUntil: null,
      alerts: [],
      objectives: createInitialObjectives(scenarioConfig),
      dx: null,
      steps: [],
      roleFocus: null
    };
    const withObjectives = {
      ...initial,
      objectives: updateObjectives(initial, scenarioConfig, 0)
    };
    return {
      ...withObjectives,
      alerts: deriveAlerts(withObjectives, scenarioConfig)
    };
  }

  getState(): PatientState {
    return this.state;
  }

  setVentOn(on: boolean) {
    if (this.state.ventOn === on) {
      return;
    }
    const nextState = {
      ...this.state,
      ventOn: on
    };
    this.state = {
      ...nextState,
      objectives: updateObjectives(nextState, scenarioConfig, 0),
      alerts: deriveAlerts(nextState, scenarioConfig)
    };
  }

  setFio2(fio2: number) {
    if (!Number.isFinite(fio2)) {
      return;
    }
    const clamped = Math.min(
      Math.max(fio2, scenarioConfig.fio2Effect.min),
      scenarioConfig.fio2Effect.max
    );
    const nextState = {
      ...this.state,
      fio2: clamped
    };
    this.state = {
      ...nextState,
      objectives: updateObjectives(nextState, scenarioConfig, 0),
      alerts: deriveAlerts(nextState, scenarioConfig)
    };
  }

  applyBvm() {
    const boostUntil = this.state.timeSec + scenarioConfig.bvm.durationSec;
    const nextState = {
      ...this.state,
      bvmActive: true,
      bvmBoostUntil: boostUntil
    };
    this.state = {
      ...nextState,
      objectives: updateObjectives(nextState, scenarioConfig, 0),
      alerts: deriveAlerts(nextState, scenarioConfig)
    };
  }

  tick(dtSec: number) {
    const updated = updatePatient(this.state, dtSec, scenarioConfig);
    const withObjectives = {
      ...updated,
      objectives: updateObjectives(updated, scenarioConfig, dtSec)
    };
    this.state = {
      ...withObjectives,
      alerts: deriveAlerts(withObjectives, scenarioConfig)
    };
  }
}
