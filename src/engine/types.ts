export enum Rhythm {
  NSR = "NSR",
  VF = "VF",
  PEA = "PEA",
  ASYSTOLE = "ASYSTOLE",
  VT = "VT"
}

export type Vitals = {
  hr: number;
  rr: number;
  spo2: number;
  sbp: number;
  dbp: number;
  map: number;
  tempC: number;
  etco2: number;
  fio2: number;
  peep: number;
  ventOn: boolean;
  rhythm: Rhythm;
};

export type Interventions = {
  cpr: boolean;
  defib: boolean;
  epi: boolean;
  amio: boolean;
  fluids: boolean;
  pressors: boolean;
  intubated: boolean;
  suction: boolean;
  bagging: boolean;
  o2Flow: number;
  antibiotics: boolean;
  blood: boolean;
  cathLab: boolean;
  thrombolysis: boolean;
  needleDecomp: boolean;
  chestTube: boolean;
};

export type Labs = {
  abg: { ph: number; pco2: number; po2: number; hco3: number; lactate: number };
  bmp: { na: number; k: number; cl: number; co2: number; bun: number; cr: number };
  cbc: { hgb: number; wbc: number; plt: number };
  trop: number;
  dDimer: number;
};

export type ImagingFlags = {
  cxrOrdered: boolean;
  cxrResult: string | null;
  usFastOrdered: boolean;
  usFastResult: string | null;
};

export type SimState = {
  timeMs: number;
  phase: string;
  diagnosisId: string;
  score: number;
  notes: string[];
  alerts: string[];
  lastActions: string[];
};

export type ActionKind =
  | "VENT_TOGGLE"
  | "VENT_FIO2_UP"
  | "VENT_FIO2_DOWN"
  | "VENT_PEEP_UP"
  | "VENT_PEEP_DOWN"
  | "AIRWAY_BAGVALVE"
  | "AIRWAY_INTUBATE"
  | "AIRWAY_SUCTION"
  | "MONITOR_CHECK_RHYTHM"
  | "DEFIB_CHARGE"
  | "DEFIB_SHOCK"
  | "CPR_START"
  | "CPR_STOP"
  | "MED_EPI"
  | "MED_AMIO"
  | "MED_ANTIBIOTICS"
  | "MED_DIURETIC"
  | "MED_ANTIPLATELET"
  | "IV_FLUID_BOLUS"
  | "PRESSOR_START"
  | "PRESSOR_TITRATE_UP"
  | "BLOOD_TRANSFUSE"
  | "LABS_ABG"
  | "LABS_CBC_BMP_TROP"
  | "IMAGING_CXR"
  | "IMAGING_FAST"
  | "CALL_RRT"
  | "CALL_CATHLAB"
  | "CALL_OR"
  | "CALL_NEURO"
  | "CHECK_GLUCOSE"
  | "CHECK_TEMP";

export type ActionEvent = {
  id: string;
  tMs: number;
  sourceHotspotId: HotspotId;
  kind: ActionKind;
  payload?: Record<string, unknown>;
};

export type HotspotId =
  | "H_AIRWAY_BAGVALVE"
  | "H_AIRWAY_INTUBATE"
  | "H_AIRWAY_SUCTION"
  | "H_VENT_POWER"
  | "H_VENT_FIO2_UP"
  | "H_VENT_FIO2_DOWN"
  | "H_VENT_PEEP_UP"
  | "H_VENT_PEEP_DOWN"
  | "H_MONITOR_CHECK_RHYTHM"
  | "H_DEFIB_SHOCK"
  | "H_DEFIB_CHARGE"
  | "H_CPR_START"
  | "H_CPR_STOP"
  | "H_MED_EPI"
  | "H_MED_AMIO"
  | "H_MED_ANTIBIOTICS"
  | "H_MED_DIURETIC"
  | "H_MED_ANTIPLATELET"
  | "H_IV_FLUID_BOLUS"
  | "H_PRESSOR_START"
  | "H_PRESSOR_TITRATE_UP"
  | "H_BLOOD_TRANSFUSE"
  | "H_LABS_ABG"
  | "H_LABS_CBC_BMP_TROP"
  | "H_IMAGING_CXR"
  | "H_IMAGING_FAST"
  | "H_CALL_RRT"
  | "H_CALL_CATHLAB"
  | "H_CALL_OR"
  | "H_CALL_NEURO"
  | "H_CHECK_GLUCOSE"
  | "H_CHECK_TEMP";
