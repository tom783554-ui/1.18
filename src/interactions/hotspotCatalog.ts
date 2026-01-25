import type { ActionKind, HotspotId } from "../engine/types";

export type HotspotEntryConfig = {
  id: HotspotId;
  label: string;
  meshNameHints: string[];
  kind: "airway" | "vent" | "monitor" | "cpr" | "med" | "hemodynamic" | "diagnostic" | "consult" | "safety";
  onActivateActionKind: ActionKind;
};

export const hotspotCatalog: HotspotEntryConfig[] = [
  {
    id: "H_AIRWAY_BAGVALVE",
    label: "Bag-Valve",
    meshNameHints: ["HP__AIRWAY_BAGVALVE", "HP__BagValve", "HS__AIRWAY_BAG"],
    kind: "airway",
    onActivateActionKind: "AIRWAY_BAGVALVE"
  },
  {
    id: "H_AIRWAY_INTUBATE",
    label: "Intubate",
    meshNameHints: ["HP__AIRWAY_INTUBATE", "HP__Intubate", "HS__AIRWAY_TUBE"],
    kind: "airway",
    onActivateActionKind: "AIRWAY_INTUBATE"
  },
  {
    id: "H_AIRWAY_SUCTION",
    label: "Suction",
    meshNameHints: ["HP__AIRWAY_SUCTION", "HP__Suction", "HS__AIRWAY_SUCTION"],
    kind: "airway",
    onActivateActionKind: "AIRWAY_SUCTION"
  },
  {
    id: "H_VENT_POWER",
    label: "Vent Power",
    meshNameHints: ["HP__VENT_POWER", "HP__Ventilator", "HS__VENT"],
    kind: "vent",
    onActivateActionKind: "VENT_TOGGLE"
  },
  {
    id: "H_VENT_FIO2_UP",
    label: "FiO2 +",
    meshNameHints: ["HP__VENT_FIO2_UP", "HP__FiO2Up"],
    kind: "vent",
    onActivateActionKind: "VENT_FIO2_UP"
  },
  {
    id: "H_VENT_FIO2_DOWN",
    label: "FiO2 -",
    meshNameHints: ["HP__VENT_FIO2_DOWN", "HP__FiO2Down"],
    kind: "vent",
    onActivateActionKind: "VENT_FIO2_DOWN"
  },
  {
    id: "H_VENT_PEEP_UP",
    label: "PEEP +",
    meshNameHints: ["HP__VENT_PEEP_UP", "HP__PeepUp"],
    kind: "vent",
    onActivateActionKind: "VENT_PEEP_UP"
  },
  {
    id: "H_VENT_PEEP_DOWN",
    label: "PEEP -",
    meshNameHints: ["HP__VENT_PEEP_DOWN", "HP__PeepDown"],
    kind: "vent",
    onActivateActionKind: "VENT_PEEP_DOWN"
  },
  {
    id: "H_MONITOR_CHECK_RHYTHM",
    label: "Check Rhythm",
    meshNameHints: ["HP__MONITOR", "HP__Monitor", "HS__MONITOR"],
    kind: "monitor",
    onActivateActionKind: "MONITOR_CHECK_RHYTHM"
  },
  {
    id: "H_DEFIB_SHOCK",
    label: "Defib Shock",
    meshNameHints: ["HP__DEFIB_SHOCK", "HP__DefibShock", "HS__DEFIB"],
    kind: "monitor",
    onActivateActionKind: "DEFIB_SHOCK"
  },
  {
    id: "H_DEFIB_CHARGE",
    label: "Charge Defib",
    meshNameHints: ["HP__DEFIB_CHARGE", "HP__DefibCharge"],
    kind: "monitor",
    onActivateActionKind: "DEFIB_CHARGE"
  },
  {
    id: "H_CPR_START",
    label: "Start CPR",
    meshNameHints: ["HP__CPR_START", "HP__CPR"],
    kind: "cpr",
    onActivateActionKind: "CPR_START"
  },
  {
    id: "H_CPR_STOP",
    label: "Stop CPR",
    meshNameHints: ["HP__CPR_STOP"],
    kind: "cpr",
    onActivateActionKind: "CPR_STOP"
  },
  {
    id: "H_MED_EPI",
    label: "Epinephrine",
    meshNameHints: ["HP__MED_EPI", "HP__Epi"],
    kind: "med",
    onActivateActionKind: "MED_EPI"
  },
  {
    id: "H_MED_AMIO",
    label: "Amiodarone",
    meshNameHints: ["HP__MED_AMIO", "HP__Amio"],
    kind: "med",
    onActivateActionKind: "MED_AMIO"
  },
  {
    id: "H_MED_ANTIBIOTICS",
    label: "Antibiotics",
    meshNameHints: ["HP__MED_ANTIBIOTICS", "HP__Antibiotics"],
    kind: "med",
    onActivateActionKind: "MED_ANTIBIOTICS"
  },
  {
    id: "H_MED_DIURETIC",
    label: "Diuretic",
    meshNameHints: ["HP__MED_DIURETIC", "HP__Diuretic"],
    kind: "med",
    onActivateActionKind: "MED_DIURETIC"
  },
  {
    id: "H_MED_ANTIPLATELET",
    label: "Aspirin/Heparin",
    meshNameHints: ["HP__MED_ANTIPLATELET", "HP__Aspirin"],
    kind: "med",
    onActivateActionKind: "MED_ANTIPLATELET"
  },
  {
    id: "H_IV_FLUID_BOLUS",
    label: "IV Fluids",
    meshNameHints: ["HP__IV_FLUIDS", "HP__IV"],
    kind: "hemodynamic",
    onActivateActionKind: "IV_FLUID_BOLUS"
  },
  {
    id: "H_PRESSOR_START",
    label: "Start Pressors",
    meshNameHints: ["HP__PRESSOR_START", "HP__Pressors"],
    kind: "hemodynamic",
    onActivateActionKind: "PRESSOR_START"
  },
  {
    id: "H_PRESSOR_TITRATE_UP",
    label: "Titrate Pressors",
    meshNameHints: ["HP__PRESSOR_TITRATE"],
    kind: "hemodynamic",
    onActivateActionKind: "PRESSOR_TITRATE_UP"
  },
  {
    id: "H_BLOOD_TRANSFUSE",
    label: "Transfuse Blood",
    meshNameHints: ["HP__BLOOD", "HP__Transfuse"],
    kind: "hemodynamic",
    onActivateActionKind: "BLOOD_TRANSFUSE"
  },
  {
    id: "H_LABS_ABG",
    label: "Order ABG",
    meshNameHints: ["HP__LAB_ABG", "HP__ABG"],
    kind: "diagnostic",
    onActivateActionKind: "LABS_ABG"
  },
  {
    id: "H_LABS_CBC_BMP_TROP",
    label: "Order Labs",
    meshNameHints: ["HP__LABS", "HP__CBC_BMP_TROP"],
    kind: "diagnostic",
    onActivateActionKind: "LABS_CBC_BMP_TROP"
  },
  {
    id: "H_IMAGING_CXR",
    label: "Order CXR",
    meshNameHints: ["HP__IMAGING_CXR", "HP__CXR"],
    kind: "diagnostic",
    onActivateActionKind: "IMAGING_CXR"
  },
  {
    id: "H_IMAGING_FAST",
    label: "FAST US",
    meshNameHints: ["HP__IMAGING_FAST", "HP__FAST"],
    kind: "diagnostic",
    onActivateActionKind: "IMAGING_FAST"
  },
  {
    id: "H_CALL_RRT",
    label: "Call RRT",
    meshNameHints: ["HP__CALL_RRT", "HP__RRT"],
    kind: "consult",
    onActivateActionKind: "CALL_RRT"
  },
  {
    id: "H_CALL_CATHLAB",
    label: "Call Cath Lab",
    meshNameHints: ["HP__CALL_CATHLAB", "HP__CATH"],
    kind: "consult",
    onActivateActionKind: "CALL_CATHLAB"
  },
  {
    id: "H_CALL_OR",
    label: "Call OR",
    meshNameHints: ["HP__CALL_OR", "HP__OR"],
    kind: "consult",
    onActivateActionKind: "CALL_OR"
  },
  {
    id: "H_CALL_NEURO",
    label: "Call Neuro",
    meshNameHints: ["HP__CALL_NEURO", "HP__NEURO"],
    kind: "consult",
    onActivateActionKind: "CALL_NEURO"
  },
  {
    id: "H_CHECK_GLUCOSE",
    label: "Check Glucose",
    meshNameHints: ["HP__CHECK_GLUCOSE", "HP__GLUCOSE"],
    kind: "safety",
    onActivateActionKind: "CHECK_GLUCOSE"
  },
  {
    id: "H_CHECK_TEMP",
    label: "Check Temp",
    meshNameHints: ["HP__CHECK_TEMP", "HP__TEMP"],
    kind: "safety",
    onActivateActionKind: "CHECK_TEMP"
  }
];
