import type { ImagingFlags, Labs, Vitals } from "../engine/types";
import { Rhythm } from "../engine/types";

export type Diagnosis = {
  id: string;
  name: string;
  shortBlurb: string;
  baselineVitals: Vitals;
  progression: {
    hypoxiaRate: number;
    shockRate: number;
    arrhythmiaRisk: number;
  };
  winConditions: string[];
  lossConditions: {
    asystoleSec: number;
    spo2Below: { threshold: number; durationSec: number };
    mapBelow: { threshold: number; durationSec: number };
  };
  labs: Labs;
  imaging: ImagingFlags;
};

const baseVitals: Vitals = {
  hr: 88,
  rr: 18,
  spo2: 94,
  sbp: 118,
  dbp: 70,
  map: 86,
  tempC: 37.2,
  etco2: 34,
  fio2: 0.3,
  peep: 6,
  ventOn: true,
  rhythm: Rhythm.NSR
};

const baseLabs: Labs = {
  abg: { ph: 7.38, pco2: 42, po2: 78, hco3: 24, lactate: 1.6 },
  bmp: { na: 138, k: 4.2, cl: 101, co2: 24, bun: 14, cr: 0.9 },
  cbc: { hgb: 12.8, wbc: 9.4, plt: 240 },
  trop: 0.02,
  dDimer: 0.4
};

const baseImaging: ImagingFlags = {
  cxrOrdered: false,
  cxrResult: null,
  usFastOrdered: false,
  usFastResult: null
};

export const diagnoses: Diagnosis[] = [
  {
    id: "dx_legionella",
    name: "Legionella Pneumonia",
    shortBlurb: "Worsening hypoxia with fever and rising RR.",
    baselineVitals: {
      ...baseVitals,
      tempC: 39.1,
      spo2: 90,
      rr: 26,
      fio2: 0.35
    },
    progression: { hypoxiaRate: 0.5, shockRate: 0.1, arrhythmiaRisk: 0.05 },
    winConditions: ["MED_ANTIBIOTICS", "VENT_FIO2_UP", "VENT_PEEP_UP"],
    lossConditions: {
      asystoleSec: 20,
      spo2Below: { threshold: 82, durationSec: 18 },
      mapBelow: { threshold: 55, durationSec: 18 }
    },
    labs: {
      ...baseLabs,
      abg: { ph: 7.31, pco2: 48, po2: 52, hco3: 22, lactate: 2.4 },
      bmp: { ...baseLabs.bmp, na: 130, co2: 21 }
    },
    imaging: {
      ...baseImaging,
      cxrResult: "Diffuse patchy opacities, worse RLL"
    }
  },
  {
    id: "dx_volume_overload",
    name: "Iatrogenic Volume Overload",
    shortBlurb: "Pulmonary edema with hypertension then decomp.",
    baselineVitals: {
      ...baseVitals,
      sbp: 150,
      dbp: 92,
      map: 111,
      spo2: 91,
      rr: 24,
      fio2: 0.4
    },
    progression: { hypoxiaRate: 0.4, shockRate: 0.15, arrhythmiaRisk: 0.08 },
    winConditions: ["MED_DIURETIC", "VENT_PEEP_UP", "VENT_FIO2_UP"],
    lossConditions: {
      asystoleSec: 25,
      spo2Below: { threshold: 84, durationSec: 20 },
      mapBelow: { threshold: 58, durationSec: 22 }
    },
    labs: {
      ...baseLabs,
      abg: { ph: 7.34, pco2: 50, po2: 58, hco3: 26, lactate: 1.9 }
    },
    imaging: {
      ...baseImaging,
      cxrResult: "Pulmonary vascular congestion and interstitial edema"
    }
  },
  {
    id: "dx_postop_hemorrhage",
    name: "Post-op Hemorrhage",
    shortBlurb: "Rapid blood loss with shock and rising lactate.",
    baselineVitals: {
      ...baseVitals,
      hr: 118,
      sbp: 94,
      dbp: 52,
      map: 66,
      spo2: 92,
      fio2: 0.35
    },
    progression: { hypoxiaRate: 0.2, shockRate: 0.7, arrhythmiaRisk: 0.15 },
    winConditions: ["BLOOD_TRANSFUSE", "PRESSOR_START", "CALL_OR"],
    lossConditions: {
      asystoleSec: 18,
      spo2Below: { threshold: 80, durationSec: 18 },
      mapBelow: { threshold: 50, durationSec: 15 }
    },
    labs: {
      ...baseLabs,
      cbc: { ...baseLabs.cbc, hgb: 7.4 },
      abg: { ph: 7.28, pco2: 38, po2: 68, hco3: 19, lactate: 4.2 }
    },
    imaging: { ...baseImaging, usFastResult: "Free fluid in RUQ" }
  },
  {
    id: "dx_acute_mi",
    name: "Acute MI",
    shortBlurb: "Chest pain with rising troponin and VT/VF risk.",
    baselineVitals: {
      ...baseVitals,
      hr: 105,
      sbp: 112,
      dbp: 68,
      map: 83,
      spo2: 93,
      fio2: 0.3
    },
    progression: { hypoxiaRate: 0.15, shockRate: 0.35, arrhythmiaRisk: 0.4 },
    winConditions: ["MED_ANTIPLATELET", "CALL_CATHLAB", "DEFIB_SHOCK"],
    lossConditions: {
      asystoleSec: 14,
      spo2Below: { threshold: 82, durationSec: 16 },
      mapBelow: { threshold: 55, durationSec: 16 }
    },
    labs: {
      ...baseLabs,
      trop: 2.4
    },
    imaging: { ...baseImaging, cxrResult: "Mild pulmonary congestion" }
  },
  {
    id: "dx_stroke",
    name: "Acute Stroke",
    shortBlurb: "Airway risk and aspiration concerns with BP management.",
    baselineVitals: {
      ...baseVitals,
      hr: 90,
      sbp: 168,
      dbp: 92,
      map: 117,
      spo2: 92,
      fio2: 0.28
    },
    progression: { hypoxiaRate: 0.3, shockRate: 0.2, arrhythmiaRisk: 0.1 },
    winConditions: ["CALL_NEURO", "AIRWAY_INTUBATE", "VENT_FIO2_UP"],
    lossConditions: {
      asystoleSec: 22,
      spo2Below: { threshold: 84, durationSec: 20 },
      mapBelow: { threshold: 60, durationSec: 20 }
    },
    labs: { ...baseLabs, abg: { ph: 7.33, pco2: 46, po2: 60, hco3: 23, lactate: 2.1 } },
    imaging: { ...baseImaging, cxrResult: "Patchy aspiration changes" }
  }
];

export const getDiagnosis = (id: string) => diagnoses.find((dx) => dx.id === id) ?? diagnoses[0];
