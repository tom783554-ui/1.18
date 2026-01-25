import { Engine } from "./Engine";
import type { EngineState } from "./types";

const engine = new Engine();
const subscribers = new Set<() => void>();
let loopTimer: number | null = null;
let lastNowMs = 0;

const notify = () => {
  subscribers.forEach((listener) => listener());
};

export const getEngine = () => engine;

export const getEngineState = (): EngineState => engine.getState();

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
  }, 500);
};

export const stopEngineLoop = () => {
  if (loopTimer === null) {
    return;
  }
  window.clearInterval(loopTimer);
  loopTimer = null;
};
