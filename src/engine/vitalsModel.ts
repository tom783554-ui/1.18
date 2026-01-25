import type { Interventions, Vitals } from "./types";
import { Rhythm } from "./types";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const smoothTowards = (current: number, target: number, tauSec: number, dtSec: number) => {
  if (tauSec <= 0 || dtSec <= 0) {
    return current;
  }
  const alpha = 1 - Math.exp(-dtSec / tauSec);
  return current + (target - current) * alpha;
};

export const computeMAP = (sbp: number, dbp: number) => (sbp + 2 * dbp) / 3;

export const clampVitals = (v: Vitals): Vitals => {
  const sbp = clamp(v.sbp, 40, 200);
  const dbp = clamp(v.dbp, 20, 120);
  const map = clamp(computeMAP(sbp, dbp), 30, 140);
  return {
    ...v,
    hr: clamp(v.hr, 0, 220),
    rr: clamp(v.rr, 0, 60),
    spo2: clamp(v.spo2, 50, 100),
    sbp,
    dbp,
    map,
    tempC: clamp(v.tempC, 30, 41),
    etco2: clamp(v.etco2, 0, 80),
    fio2: clamp(v.fio2, 0.21, 1.0),
    peep: clamp(v.peep, 0, 20)
  };
};

export const applyVentPhysics = (
  v: Vitals,
  dtSec: number,
  state: { ventOn: boolean; fio2: number; bagging?: boolean }
): Vitals => {
  const fio2 = clamp(state.fio2, 0.21, 1.0);
  const fio2Ratio = clamp((fio2 - 0.21) / (1.0 - 0.21), 0, 1);
  const fio2Bonus = fio2Ratio * 6;
  const baseTarget = state.ventOn ? 96 : 82;
  const bagBoost = state.bagging ? 3 : 0;
  const spo2Target = baseTarget + fio2Bonus + bagBoost;
  const baseTau = state.ventOn ? 22 : 14;
  const tau = baseTau * (0.21 / fio2);
  const nextSpo2 = smoothTowards(v.spo2, spo2Target, tau, dtSec);

  return {
    ...v,
    ventOn: state.ventOn,
    fio2,
    spo2: nextSpo2
  };
};

export const applyHypoxia = (v: Vitals, dtSec: number, severity: number): Vitals => {
  const scaled = clamp(severity, 0, 1);
  return {
    ...v,
    spo2: v.spo2 - scaled * dtSec * 2.4,
    etco2: v.etco2 - scaled * dtSec * 1.2
  };
};

export const applyShock = (v: Vitals, dtSec: number, severity: number): Vitals => {
  const scaled = clamp(severity, 0, 1);
  const sbp = v.sbp - scaled * dtSec * 6;
  const dbp = v.dbp - scaled * dtSec * 4;
  return {
    ...v,
    sbp,
    dbp,
    map: computeMAP(sbp, dbp)
  };
};

export const applyCPR = (v: Vitals, dtSec: number, quality: number): Vitals => {
  const scaled = clamp(quality, 0, 1);
  if (v.rhythm !== Rhythm.ASYSTOLE && v.rhythm !== Rhythm.PEA) {
    return v;
  }
  const boost = 10 * scaled;
  const sbp = smoothTowards(v.sbp, v.sbp + boost, 1.8, dtSec);
  const dbp = smoothTowards(v.dbp, v.dbp + boost * 0.6, 1.8, dtSec);
  return {
    ...v,
    sbp,
    dbp,
    map: computeMAP(sbp, dbp)
  };
};

export const applyDefib = (v: Vitals): Vitals => {
  if (v.rhythm === Rhythm.VF || v.rhythm === Rhythm.VT) {
    const sbp = Math.max(v.sbp, 90);
    const dbp = Math.max(v.dbp, 55);
    return {
      ...v,
      rhythm: Rhythm.NSR,
      hr: Math.max(v.hr, 90),
      sbp,
      dbp,
      map: computeMAP(sbp, dbp)
    };
  }
  return v;
};

export const applyEpi = (v: Vitals, state: { effect: number }): Vitals => {
  const effect = clamp(state.effect, 0, 1);
  const sbp = v.sbp + effect * 12;
  const dbp = v.dbp + effect * 6;
  return {
    ...v,
    hr: v.hr + effect * 8,
    sbp,
    dbp,
    map: computeMAP(sbp, dbp)
  };
};

export const applyFluids = (v: Vitals, state: { effect: number }): Vitals => {
  const effect = clamp(state.effect, 0, 1);
  const sbp = v.sbp + effect * 10;
  const dbp = v.dbp + effect * 6;
  return {
    ...v,
    sbp,
    dbp,
    map: computeMAP(sbp, dbp)
  };
};

type StepContext = {
  baseline: Vitals;
  interventions: Interventions;
  hypoxiaRate: number;
  shockRate: number;
  arrhythmiaRisk: number;
  epiEffect: number;
  fluidEffect: number;
};

export const stepVitals = (prev: Vitals, dtMs: number, sim: StepContext): Vitals => {
  if (!Number.isFinite(dtMs) || dtMs <= 0) {
    return prev;
  }
  const dtSec = dtMs / 1000;

  let next: Vitals = {
    ...prev,
    hr: smoothTowards(prev.hr, sim.baseline.hr, 18, dtSec),
    rr: smoothTowards(prev.rr, sim.baseline.rr, 22, dtSec),
    sbp: smoothTowards(prev.sbp, sim.baseline.sbp, 28, dtSec),
    dbp: smoothTowards(prev.dbp, sim.baseline.dbp, 28, dtSec),
    tempC: smoothTowards(prev.tempC, sim.baseline.tempC, 80, dtSec),
    etco2: smoothTowards(prev.etco2, sim.baseline.etco2, 18, dtSec)
  };

  next = applyVentPhysics(next, dtSec, {
    ventOn: next.ventOn,
    fio2: next.fio2,
    bagging: sim.interventions.bagging
  });

  if (sim.hypoxiaRate > 0) {
    next = applyHypoxia(next, dtSec, sim.hypoxiaRate);
  }
  if (sim.shockRate > 0) {
    next = applyShock(next, dtSec, sim.shockRate);
  }
  if (sim.interventions.cpr) {
    next = applyCPR(next, dtSec, 0.65);
  }
  if (sim.epiEffect > 0) {
    next = applyEpi(next, { effect: sim.epiEffect });
  }
  if (sim.fluidEffect > 0) {
    next = applyFluids(next, { effect: sim.fluidEffect });
  }

  if (next.rhythm === Rhythm.ASYSTOLE) {
    next = { ...next, hr: 0, rr: 0, etco2: Math.max(next.etco2 - dtSec * 3, 4) };
  }
  if (next.rhythm === Rhythm.PEA) {
    next = { ...next, hr: Math.min(next.hr, 40), rr: Math.max(next.rr, 4) };
  }

  return clampVitals({ ...next, map: computeMAP(next.sbp, next.dbp) });
};
