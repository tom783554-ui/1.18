import type { ScenarioAction } from "./types";

type ScenarioActionHandler = (action: ScenarioAction) => void;

const listeners = new Set<ScenarioActionHandler>();

export const onScenarioAction = (handler: ScenarioActionHandler) => {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
};

export const emitScenarioAction = (action: ScenarioAction) => {
  listeners.forEach((handler) => handler(action));
};
