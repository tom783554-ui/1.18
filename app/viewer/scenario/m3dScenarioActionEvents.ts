import type { ScenarioAction } from "./types";

export const M3D_SCENARIO_ACTION_EVENT = "m3d:scenarioAction" as const;

export function emitScenarioAction(action: ScenarioAction): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ScenarioAction>(M3D_SCENARIO_ACTION_EVENT, { detail: action }));
}

export function onScenarioAction(handler: (action: ScenarioAction) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<ScenarioAction>;
    handler(customEvent.detail);
  };
  window.addEventListener(M3D_SCENARIO_ACTION_EVENT, listener as EventListener);
  return () => window.removeEventListener(M3D_SCENARIO_ACTION_EVENT, listener as EventListener);
}
