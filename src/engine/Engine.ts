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
      defibCharged: false,
      defibShockAtSec: null,
      alerts: [],
      objectives: createInitialObjectives(scenarioConfig)
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

  setDefibCharged(charged: boolean) {
    if (this.state.defibCharged === charged) {
      return;
    }
    const nextState = {
      ...this.state,
      defibCharged: charged
    };
    this.state = {
      ...nextState,
      objectives: updateObjectives(nextState, scenarioConfig, 0),
      alerts: deriveAlerts(nextState, scenarioConfig)
    };
  }

  applyDefibShock() {
    if (!this.state.defibCharged) {
      return;
    }
    const nextState = {
      ...this.state,
      defibCharged: false,
      defibShockAtSec: this.state.timeSec,
      hr: scenarioConfig.baseline.hr,
      map: scenarioConfig.baseline.map
    };
    this.state = {
      ...nextState,
      objectives: updateObjectives(nextState, scenarioConfig, 0),
      alerts: deriveAlerts(nextState, scenarioConfig)
    };
  }

  tick(dtSec: number) {
    const updated = updatePatient(this.state, dtSec, scenarioConfig);
    const shockWindowSec = 12;
    const defibShockAtSec =
      updated.defibShockAtSec !== null && updated.timeSec - updated.defibShockAtSec > shockWindowSec
        ? null
        : updated.defibShockAtSec;
    const withObjectives = {
      ...updated,
      defibShockAtSec,
      objectives: updateObjectives(updated, scenarioConfig, dtSec)
    };
    this.state = {
      ...withObjectives,
      alerts: deriveAlerts(withObjectives, scenarioConfig)
    };
  }
}
