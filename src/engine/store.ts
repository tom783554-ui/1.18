import { Engine } from "./Engine";
import type { PatientState } from "./patientState";

const engine = new Engine();
const subscribers = new Set<() => void>();
let loopTimer: number | null = null;
let lastNowMs = 0;
const TICK_MS = 200;

const notify = () => {
  subscribers.forEach((listener) => listener());
};

export const getEngine = () => engine;

export const getEngineState = (): PatientState => engine.getState();

export const updateEngineState = (mutator: (state: PatientState) => void) => {
  mutator(engine.getState());
  notify();
};

export const subscribe = (listener: () => void) => {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
};

export const setVentOn = (on: boolean) => {
  engine.setVentOn(on);
  notify();
};

export const setFio2 = (fio2: number) => {
  engine.setFio2(fio2);
  notify();
};

export const applyBvm = () => {
  engine.applyBvm();
  notify();
};

export const setDefibCharged = (charged: boolean) => {
  engine.setDefibCharged(charged);
  notify();
};

export const applyDefibShock = () => {
  engine.applyDefibShock();
  notify();
};

export const startEngineLoop = () => {
  if (loopTimer !== null || typeof window === "undefined") {
    return;
  }
  lastNowMs = performance.now();
  loopTimer = window.setInterval(() => {
    const nowMs = performance.now();
    const dtSec = (nowMs - lastNowMs) / 1000;
    lastNowMs = nowMs;
    engine.tick(dtSec);
    notify();
  }, TICK_MS);
};

export const stopEngineLoop = () => {
  if (loopTimer === null) {
    return;
  }
  window.clearInterval(loopTimer);
  loopTimer = null;
};
