export type Vitals = {
  hrBpm: number;
  spo2Pct: number;
  respRpm: number;
  tempC: number;
  bpSys: number;
  bpDia: number;
};

export type Devices = {
  ventOn: boolean;
};

export type EngineState = {
  tSec: number;
  vitals: Vitals;
  devices: Devices;
  lastUpdatedMs: number;
};
