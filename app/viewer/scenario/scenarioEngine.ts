export type ScenarioVitals = {
  hr: number;
  bpSys: number;
  bpDia: number;
  spo2: number;
  rr: number;
  temp: number;
  fio2: number;
  peep: number;
  mode: string;
};

const MODE_OPTIONS = ["VC", "PC", "SIMV", "PS", "CPAP"];
const TICK_MS = 1000;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const jitter = (value: number, range: number) => value + (Math.random() - 0.5) * range;

const nextInt = (value: number, min: number, max: number, step: number) =>
  Math.round(clamp(jitter(value, step), min, max));

const nextFloat = (value: number, min: number, max: number, step: number, precision: number) => {
  const next = clamp(jitter(value, step), min, max);
  const factor = 10 ** precision;
  return Math.round(next * factor) / factor;
};

const state = {
  vitals: {
    hr: 78,
    bpSys: 118,
    bpDia: 72,
    spo2: 98,
    rr: 14,
    temp: 36.8,
    fio2: 0.24,
    peep: 6,
    mode: "VC"
  } as ScenarioVitals,
  listeners: new Set<(vitals: ScenarioVitals) => void>(),
  timer: null as number | null,
  lastModeSwitch: Date.now()
};

const emitVitals = () => {
  const snapshot = { ...state.vitals };
  state.listeners.forEach((listener) => listener(snapshot));
};

const tick = () => {
  state.vitals = {
    hr: nextInt(state.vitals.hr, 55, 115, 4),
    bpSys: nextInt(state.vitals.bpSys, 95, 140, 5),
    bpDia: nextInt(state.vitals.bpDia, 55, 90, 3),
    spo2: nextInt(state.vitals.spo2, 92, 100, 1),
    rr: nextInt(state.vitals.rr, 10, 24, 2),
    temp: nextFloat(state.vitals.temp, 36.4, 37.6, 0.12, 1),
    fio2: nextFloat(state.vitals.fio2, 0.21, 0.6, 0.03, 2),
    peep: nextFloat(state.vitals.peep, 4, 12, 0.5, 1),
    mode: state.vitals.mode
  };

  if (Date.now() - state.lastModeSwitch > 15000) {
    state.lastModeSwitch = Date.now();
    const currentIndex = MODE_OPTIONS.indexOf(state.vitals.mode);
    const nextIndex = (currentIndex + 1) % MODE_OPTIONS.length;
    state.vitals.mode = MODE_OPTIONS[nextIndex];
  }

  emitVitals();
};

const start = () => {
  if (state.timer !== null) {
    return;
  }
  if (typeof window === "undefined") {
    return;
  }
  state.timer = window.setInterval(tick, TICK_MS);
  tick();
};

const stop = () => {
  if (state.timer === null) {
    return;
  }
  window.clearInterval(state.timer);
  state.timer = null;
};

export const onScenarioVitals = (handler: (vitals: ScenarioVitals) => void) => {
  state.listeners.add(handler);
  start();
  handler({ ...state.vitals });
  return () => {
    state.listeners.delete(handler);
    if (state.listeners.size === 0) {
      stop();
    }
  };
};
