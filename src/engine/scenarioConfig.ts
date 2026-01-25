import respFailure from "./scenarios/respFailure.json";
import shock from "./scenarios/shock.json";

export type ScenarioVitals = {
  hrBpm: number;
  spo2Pct: number;
  respRpm: number;
  mapMmhg: number;
  tempC: number;
};

export type ScenarioTargets = {
  hrBpm: number;
  spo2Pct: number;
  respRpm: number;
  mapMmhg: number;
};

export type ScenarioConfig = {
  id: string;
  name: string;
  description: string;
  pulsePressure: number;
  baseline: {
    vitals: ScenarioVitals;
    devices: {
      ventOn: boolean;
    };
    fio2: number;
    pressorDose?: number;
  };
  fio2: {
    min: number;
    max: number;
    spo2BoostPerPoint: number;
    spo2MaxBonus: number;
  };
  targets: {
    ventOn: ScenarioTargets;
    ventOff: ScenarioTargets;
    hypoxiaHrGain: number;
    hypoxiaRrGain: number;
  };
  timeConstants: {
    spo2Sec: number;
    hrSec: number;
    rrSec: number;
    mapSec: number;
  };
  noise: {
    enabled: boolean;
    amplitude: ScenarioTargets;
  };
  thresholds: {
    spo2: { low: number; critical: number };
    map: { low: number; critical: number };
    hr: { high: number };
    rr: { high: number };
  };
  interventions: {
    bag: { boost: number; decaySec: number; durationSec: number };
    fluids: { mapBoost: number; decaySec: number; cooldownSec: number; residualFraction: number };
    pressor: { mapBoost: number; hrDelta: number };
  };
  shock?: {
    mapDriftTarget: number;
    hrDriftTarget: number;
    spo2DriftTarget?: number;
    detection: { mapLow: number; hrHigh: number; durationSec: number };
  };
  objectives: {
    maintainSpo2Sec: number;
    maintainMapSec: number;
    maintainHrSec: number;
    hrRange: { min: number; max: number };
  };
  alarms: {
    silenceDurationSec: number;
  };
  trend: {
    windowSec: number;
    slopeThresholds: {
      hrBpm: number;
      spo2Pct: number;
      respRpm: number;
      mapMmhg: number;
    };
  };
  debug: {
    eventLogSize: number;
  };
};

const scenarioList = [respFailure, shock] as const;

export type ScenarioId = (typeof scenarioList)[number]["id"];

export const getScenarioOptions = () => scenarioList.map((scenario) => ({
  id: scenario.id,
  name: scenario.name,
  description: scenario.description
}));

export const loadScenarioConfig = (id: string): ScenarioConfig => {
  const scenario = scenarioList.find((entry) => entry.id === id) ?? respFailure;
  return scenario as ScenarioConfig;
};

export const DEFAULT_SCENARIO_ID: ScenarioId = respFailure.id;
