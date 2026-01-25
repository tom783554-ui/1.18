import { applyAction, type PatientAction } from "./actions";
import { createInitialState, type PatientState } from "./patientState";
import {
  DEFAULT_SCENARIO_ID,
  loadScenarioConfig,
  type ScenarioConfig
} from "./scenarioConfig";
import { updatePatient } from "./updatePatient";

const subscribers = new Set<() => void>();
let loopTimer: number | null = null;
let engineState: PatientState = createInitialState(loadScenarioConfig(DEFAULT_SCENARIO_ID));
let scenarioConfig: ScenarioConfig = loadScenarioConfig(DEFAULT_SCENARIO_ID);
let initialized = false;

export const TICK_DT_SEC = 0.1;

const notify = () => {
  subscribers.forEach((listener) => listener());
};

const getScenarioFromLocation = () => {
  if (typeof window === "undefined") {
    return DEFAULT_SCENARIO_ID;
  }
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("scenario") ?? "";
  const fromStorage = window.localStorage.getItem("m3d-scenario") ?? "";
  const candidate = fromQuery || fromStorage || DEFAULT_SCENARIO_ID;
  return candidate;
};

const initializeScenario = () => {
  if (initialized) {
    return;
  }
  initialized = true;
  const scenarioId = getScenarioFromLocation();
  scenarioConfig = loadScenarioConfig(scenarioId);
  engineState = createInitialState(scenarioConfig);
};

export const getEngineSnapshot = () => ({ state: engineState, config: scenarioConfig });

export const getEngineState = (): PatientState => engineState;

export const getScenarioConfig = (): ScenarioConfig => scenarioConfig;

export const subscribe = (listener: () => void) => {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
};

export const dispatchAction = (action: PatientAction) => {
  engineState = applyAction(engineState, scenarioConfig, action);
  notify();
};

export const setScenario = (scenarioId: string) => {
  scenarioConfig = loadScenarioConfig(scenarioId);
  engineState = createInitialState(scenarioConfig);
  notify();
};

export const startEngineLoop = () => {
  if (loopTimer !== null || typeof window === "undefined") {
    return;
  }
  initializeScenario();
  loopTimer = window.setInterval(() => {
    engineState = updatePatient(engineState, scenarioConfig, TICK_DT_SEC);
    notify();
  }, TICK_DT_SEC * 1000);
};

export const stopEngineLoop = () => {
  if (loopTimer === null) {
    return;
  }
  window.clearInterval(loopTimer);
  loopTimer = null;
};
