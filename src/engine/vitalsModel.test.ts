import { describe, expect, it } from "vitest";
import { Rhythm } from "./types";
import { stepVitals } from "./vitalsModel";

const baseVitals = {
  hr: 80,
  rr: 14,
  spo2: 95,
  sbp: 120,
  dbp: 70,
  map: 87,
  tempC: 36.8,
  etco2: 35,
  fio2: 0.3,
  peep: 6,
  ventOn: true,
  rhythm: Rhythm.NSR
};

const baseContext = {
  baseline: baseVitals,
  interventions: {
    cpr: false,
    defib: false,
    epi: false,
    amio: false,
    fluids: false,
    pressors: false,
    intubated: true,
    suction: false,
    bagging: false,
    o2Flow: 6,
    antibiotics: false,
    blood: false,
    cathLab: false,
    thrombolysis: false,
    needleDecomp: false,
    chestTube: false
  },
  hypoxiaRate: 0,
  shockRate: 0,
  arrhythmiaRisk: 0,
  epiEffect: 0,
  fluidEffect: 0
};

describe("vitalsModel", () => {
  it("ventOff makes SpO2 trend down over time", () => {
    const start = { ...baseVitals, ventOn: false, spo2: 93 };
    const next = stepVitals(start, 15000, { ...baseContext, baseline: start });
    expect(next.spo2).toBeLessThan(start.spo2);
  });

  it("increasing FiO2 increases SpO2 recovery rate when ventOn", () => {
    const start = { ...baseVitals, spo2: 88, ventOn: true, fio2: 0.3 };
    const low = stepVitals(start, 8000, { ...baseContext, baseline: start });
    const high = stepVitals({ ...start, fio2: 0.8 }, 8000, {
      ...baseContext,
      baseline: { ...start, fio2: 0.8 }
    });
    expect(high.spo2).toBeGreaterThan(low.spo2);
  });

  it("CPR raises MAP modestly during arrest states", () => {
    const arrest = { ...baseVitals, rhythm: Rhythm.PEA, sbp: 60, dbp: 30 };
    const withoutCpr = stepVitals(arrest, 4000, { ...baseContext, baseline: arrest });
    const withCpr = stepVitals(arrest, 4000, {
      ...baseContext,
      baseline: arrest,
      interventions: { ...baseContext.interventions, cpr: true }
    });
    expect(withCpr.map).toBeGreaterThan(withoutCpr.map);
  });
});
