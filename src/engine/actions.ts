import type { PatientState } from "./patientState";
import type { ScenarioConfig } from "./scenarioConfig";
import { appendEvent } from "./eventLog";
import { createInitialState } from "./patientState";
import { updatePatient } from "./updatePatient";

export type PatientAction =
  | { type: "SET_VENT"; on: boolean }
  | { type: "SET_FIO2"; fio2: number }
  | { type: "BAG" }
  | { type: "BOLUS" }
  | { type: "SET_PRESSOR"; dose: number }
  | { type: "SILENCE_ALARMS"; durationSec: number }
  | { type: "RUN_SIM_CHECK" };

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const applyAction = (
  state: PatientState,
  config: ScenarioConfig,
  action: PatientAction
): PatientState => {
  switch (action.type) {
    case "SET_VENT": {
      if (state.devices.ventOn === action.on) {
        return state;
      }
      const eventLog = appendEvent(state.eventLog, {
        id: "vent",
        label: action.on ? "VENT ON" : "VENT OFF",
        tSec: state.tSec
      });
      return {
        ...state,
        devices: { ...state.devices, ventOn: action.on },
        eventLog
      };
    }
    case "SET_FIO2": {
      const fio2 = clamp(action.fio2, config.fio2.min, config.fio2.max);
      if (Math.abs(state.interventions.fio2 - fio2) < 0.001) {
        return state;
      }
      const eventLog = appendEvent(state.eventLog, {
        id: "fio2",
        label: `FIO2=${fio2.toFixed(2)}`,
        tSec: state.tSec
      });
      return {
        ...state,
        interventions: { ...state.interventions, fio2 },
        eventLog
      };
    }
    case "BAG": {
      const boost = config.interventions.bag.boost;
      const updatedSpo2 = clamp(state.vitals.spo2Pct + boost, 50, 100);
      const eventLog = appendEvent(state.eventLog, {
        id: "bag",
        label: "BAG",
        tSec: state.tSec
      });
      return {
        ...state,
        vitals: {
          ...state.vitals,
          spo2Pct: updatedSpo2
        },
        interventions: {
          ...state.interventions,
          bagEffect: boost,
          bagRemainingSec: config.interventions.bag.durationSec
        },
        eventLog
      };
    }
    case "BOLUS": {
      if (state.interventions.bolusCooldownSec > 0) {
        return state;
      }
      const eventLog = appendEvent(state.eventLog, {
        id: "bolus",
        label: "BOLUS 500 mL",
        tSec: state.tSec
      });
      return {
        ...state,
        interventions: {
          ...state.interventions,
          bolusEffect: config.interventions.fluids.mapBoost,
          bolusCooldownSec: config.interventions.fluids.cooldownSec
        },
        eventLog
      };
    }
    case "SET_PRESSOR": {
      const dose = clamp(action.dose, 0, 1);
      const shouldLog = Math.abs(state.interventions.lastPressorLogged - dose) >= 0.05;
      const eventLog = shouldLog
        ? appendEvent(state.eventLog, {
            id: "pressor",
            label: `NOREPI ${Math.round(dose * 100)}%`,
            tSec: state.tSec
          })
        : state.eventLog;
      return {
        ...state,
        interventions: {
          ...state.interventions,
          pressorDose: dose,
          lastPressorLogged: shouldLog ? dose : state.interventions.lastPressorLogged
        },
        eventLog
      };
    }
    case "SILENCE_ALARMS": {
      const eventLog = appendEvent(state.eventLog, {
        id: "silence",
        label: `Silence ${action.durationSec}s`,
        tSec: state.tSec
      });
      return {
        ...state,
        silenceUntilSec: state.tSec + action.durationSec,
        eventLog
      };
    }
    case "RUN_SIM_CHECK": {
      const simulated = createInitialState(config);
      let simState = {
        ...simulated,
        devices: { ...simulated.devices, ventOn: false }
      };
      for (let i = 0; i < 600; i += 1) {
        simState = updatePatient(simState, config, 0.1);
      }
      const spo2Off = simState.vitals.spo2Pct;
      simState = { ...simState, devices: { ...simState.devices, ventOn: true } };
      for (let i = 0; i < 600; i += 1) {
        simState = updatePatient(simState, config, 0.1);
      }
      const spo2On = simState.vitals.spo2Pct;
      console.info("Sim check", { spo2Off, spo2On });
      const eventLog = appendEvent(state.eventLog, {
        id: "sim",
        label: `SIM_CHECK SpO2 off ${spo2Off.toFixed(1)} -> on ${spo2On.toFixed(1)}`,
        tSec: state.tSec
      });
      return {
        ...state,
        eventLog
      };
    }
    default:
      return state;
  }
};
