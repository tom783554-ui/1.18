import type { ScenarioConfig } from "./scenarioConfig";
import { createEventLog, type EventLog } from "./eventLog";
import { createObjectiveState, type ObjectiveState } from "./objectives";

export type Vitals = {
  hrBpm: number;
  spo2Pct: number;
  respRpm: number;
  mapMmhg: number;
  bpSys: number;
  bpDia: number;
  tempC: number;
};

export type Devices = {
  ventOn: boolean;
};

export type Interventions = {
  fio2: number;
  bagEffect: number;
  bagRemainingSec: number;
  bolusEffect: number;
  bolusCooldownSec: number;
  pressorDose: number;
  lastPressorLogged: number;
};

export type TrendDirection = "up" | "down" | "steady";

export type TrendState = {
  hr: TrendDirection;
  spo2: TrendDirection;
  rr: TrendDirection;
  map: TrendDirection;
};

export type TrendSample = {
  tSec: number;
  hrBpm: number;
  spo2Pct: number;
  respRpm: number;
  mapMmhg: number;
};

export type PatientState = {
  scenarioId: string;
  scenarioName: string;
  tSec: number;
  vitals: Vitals;
  devices: Devices;
  interventions: Interventions;
  objectiveState: ObjectiveState;
  shockDetectionSec: number;
  shockSuspected: boolean;
  trendSamples: TrendSample[];
  trendState: TrendState;
  eventLog: EventLog;
  silenceUntilSec: number;
  lastUpdatedMs: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const createInitialState = (config: ScenarioConfig): PatientState => {
  const { baseline } = config;
  const fio2 = clamp(baseline.fio2, config.fio2.min, config.fio2.max);
  const pulsePressure = config.pulsePressure;
  const map = baseline.vitals.mapMmhg;
  const bpSys = map + pulsePressure / 2;
  const bpDia = map - pulsePressure / 2;
  return {
    scenarioId: config.id,
    scenarioName: config.name,
    tSec: 0,
    vitals: {
      hrBpm: baseline.vitals.hrBpm,
      spo2Pct: baseline.vitals.spo2Pct,
      respRpm: baseline.vitals.respRpm,
      mapMmhg: map,
      bpSys,
      bpDia,
      tempC: baseline.vitals.tempC
    },
    devices: {
      ventOn: baseline.devices.ventOn
    },
    interventions: {
      fio2,
      bagEffect: 0,
      bagRemainingSec: 0,
      bolusEffect: 0,
      bolusCooldownSec: 0,
      pressorDose: baseline.pressorDose ?? 0,
      lastPressorLogged: baseline.pressorDose ?? 0
    },
    objectiveState: createObjectiveState(config),
    shockDetectionSec: 0,
    shockSuspected: false,
    trendSamples: [],
    trendState: {
      hr: "steady",
      spo2: "steady",
      rr: "steady",
      map: "steady"
    },
    eventLog: createEventLog(config.debug.eventLogSize),
    silenceUntilSec: 0,
    lastUpdatedMs: Date.now()
  };
};
