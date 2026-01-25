import { SimEngine } from "./simEngine";
import type { ActionEvent } from "./types";
import { pickRandomDiagnosis } from "../scenarios/codeBlueScript";

export type SimSnapshot = {
  vitals: ReturnType<SimEngine["getVitals"]>;
  state: ReturnType<SimEngine["getState"]>;
  labs: ReturnType<SimEngine["getLabs"]>;
  imaging: ReturnType<SimEngine["getImaging"]>;
  log: ReturnType<SimEngine["getLog"]>;
};

const subscribers = new Set<() => void>();
let engine: SimEngine | null = null;
let unsubscribeEngine: (() => void) | null = null;
let snapshot: SimSnapshot | null = null;

const notify = () => {
  subscribers.forEach((listener) => listener());
};

const refreshSnapshot = () => {
  if (!engine) {
    return;
  }
  snapshot = {
    vitals: engine.getVitals(),
    state: engine.getState(),
    labs: engine.getLabs(),
    imaging: engine.getImaging(),
    log: engine.getLog()
  };
};

export const initializeSimEngine = (diagnosisId: string) => {
  if (unsubscribeEngine) {
    unsubscribeEngine();
    unsubscribeEngine = null;
  }
  engine = new SimEngine({ diagnosisId });
  refreshSnapshot();
  unsubscribeEngine = engine.subscribe(() => {
    refreshSnapshot();
    notify();
  });
  notify();
  return engine;
};

export const resetSimEngine = (diagnosisId: string) => {
  if (!engine) {
    initializeSimEngine(diagnosisId);
    return;
  }
  engine.reset(diagnosisId);
  refreshSnapshot();
  notify();
};

export const getSimEngine = () => engine;

export const getSimSnapshot = () => {
  if (!snapshot && engine) {
    refreshSnapshot();
  }
  return snapshot;
};

export const subscribeSim = (listener: () => void) => {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
};

export const dispatchSimAction = (event: Omit<ActionEvent, "id" | "tMs">) => {
  engine?.dispatch(event);
};

export const tickSim = (dtMs: number) => {
  engine?.tick(dtMs);
};

export const randomizeDiagnosis = (seed: number) => {
  const id = pickRandomDiagnosis(seed);
  resetSimEngine(id);
  return id;
};
