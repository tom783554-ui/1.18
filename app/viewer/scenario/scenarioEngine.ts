import { onScenarioAction } from "./m3dScenarioActionEvents";
import type { ScenarioAction, VentMode } from "./types";

type ScenarioState = {
  mode: VentMode | null;
  fio2: number;
  peep: number;
  notes: string[];
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function createScenarioEngine() {
  let state: ScenarioState = {
    mode: null,
    fio2: 0.21,
    peep: 5,
    notes: []
  };

  const dispatch = (action: ScenarioAction) => {
    switch (action.type) {
      case "NOTE": {
        state = { ...state, notes: [...state.notes, action.message] };
        console.info(`[Scenario] NOTE: ${action.message}`);
        break;
      }
      case "SET_FIO2": {
        const fio2 = clamp(action.fio2, 0.21, 1.0);
        state = { ...state, fio2 };
        console.info(`[Scenario] FiO2 -> ${Math.round(fio2 * 100)}%`);
        break;
      }
      case "SET_PEEP": {
        const peep = clamp(Math.round(action.peep), 0, 20);
        state = { ...state, peep };
        console.info(`[Scenario] PEEP -> ${peep}`);
        break;
      }
      case "SET_MODE": {
        state = { ...state, mode: action.mode };
        console.info(`[Scenario] Mode -> ${action.mode}`);
        break;
      }
      default:
        break;
    }
  };

  const offActions = onScenarioAction((action) => dispatch(action));

  return {
    dispatch,
    getState: () => ({ ...state, notes: [...state.notes] }),
    dispose: () => {
      offActions();
    }
  };
}
