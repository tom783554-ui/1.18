import { applyAction } from "./actions";
import { createInitialState, type PatientState } from "./patientState";
import { loadScenarioConfig, type ScenarioConfig } from "./scenarioConfig";
import { updatePatient } from "./updatePatient";

export class Engine {
  private state: PatientState;
  private config: ScenarioConfig;

  constructor(scenarioId?: string) {
    this.config = loadScenarioConfig(scenarioId ?? "respFailure");
    this.state = createInitialState(this.config);
  }

  getState(): PatientState {
    return this.state;
  }

  setScenario(scenarioId: string) {
    this.config = loadScenarioConfig(scenarioId);
    this.state = createInitialState(this.config);
  }

  setVentOn(on: boolean) {
    this.state = applyAction(this.state, this.config, { type: "SET_VENT", on });
  }

  tick(dtSec: number) {
    this.state = updatePatient(this.state, this.config, dtSec);
  }
}
