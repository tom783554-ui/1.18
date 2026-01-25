import type { PatientState, TrendDirection, TrendSample, TrendState } from "./patientState";
import type { ScenarioConfig } from "./scenarioConfig";
import { appendEvent } from "./eventLog";
import { updateObjectives } from "./objectives";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const expApproach = (current: number, target: number, tauSec: number, dtSec: number) => {
  if (tauSec <= 0) {
    return target;
  }
  const factor = 1 - Math.exp(-dtSec / tauSec);
  return current + (target - current) * factor;
};

const applyNoise = (value: number, amplitude: number) => {
  if (amplitude <= 0) {
    return value;
  }
  const noise = (Math.random() * 2 - 1) * amplitude;
  return value + noise;
};

const updateTrendSamples = (
  samples: TrendSample[],
  latest: TrendSample,
  windowSec: number
): TrendSample[] => {
  const nextSamples = [...samples, latest];
  const cutoff = latest.tSec - windowSec;
  let startIndex = 0;
  while (startIndex < nextSamples.length && nextSamples[startIndex].tSec < cutoff) {
    startIndex += 1;
  }
  if (startIndex > 0) {
    return nextSamples.slice(startIndex);
  }
  return nextSamples;
};

const trendFromSlope = (slope: number, threshold: number): TrendDirection => {
  if (slope > threshold) {
    return "up";
  }
  if (slope < -threshold) {
    return "down";
  }
  return "steady";
};

const deriveTrend = (samples: TrendSample[], config: ScenarioConfig): TrendState => {
  if (samples.length < 2) {
    return {
      hr: "steady",
      spo2: "steady",
      rr: "steady",
      map: "steady"
    };
  }
  const first = samples[0];
  const last = samples[samples.length - 1];
  const dt = Math.max(0.1, last.tSec - first.tSec);
  const hrSlope = (last.hrBpm - first.hrBpm) / dt;
  const spo2Slope = (last.spo2Pct - first.spo2Pct) / dt;
  const rrSlope = (last.respRpm - first.respRpm) / dt;
  const mapSlope = (last.mapMmhg - first.mapMmhg) / dt;
  return {
    hr: trendFromSlope(hrSlope, config.trend.slopeThresholds.hrBpm),
    spo2: trendFromSlope(spo2Slope, config.trend.slopeThresholds.spo2Pct),
    rr: trendFromSlope(rrSlope, config.trend.slopeThresholds.respRpm),
    map: trendFromSlope(mapSlope, config.trend.slopeThresholds.mapMmhg)
  };
};

export const updatePatient = (
  state: PatientState,
  config: ScenarioConfig,
  dtSec: number
): PatientState => {
  if (!Number.isFinite(dtSec) || dtSec <= 0) {
    return state;
  }

  const { vitals, devices, interventions } = state;
  const baseTargets = devices.ventOn ? config.targets.ventOn : config.targets.ventOff;

  const fio2Clamped = clamp(interventions.fio2, config.fio2.min, config.fio2.max);
  const fio2Bonus = clamp(
    (fio2Clamped - config.fio2.min) * config.fio2.spo2BoostPerPoint,
    0,
    config.fio2.spo2MaxBonus
  );

  const bagRemaining = Math.max(0, interventions.bagRemainingSec - dtSec);
  const bagDecay = Math.exp(-dtSec / config.interventions.bag.decaySec);
  const bagScale = bagRemaining > 0 ? bagRemaining / config.interventions.bag.durationSec : 0;
  const bagEffect = interventions.bagEffect * bagDecay * bagScale;

  const bolusCooldown = Math.max(0, interventions.bolusCooldownSec - dtSec);
  const bolusDecay = Math.exp(-dtSec / config.interventions.fluids.decaySec);
  const bolusResidual = config.interventions.fluids.mapBoost * config.interventions.fluids.residualFraction;
  const bolusEffect = interventions.bolusEffect > 0
    ? Math.max(bolusResidual, interventions.bolusEffect * bolusDecay)
    : 0;

  let spo2Target = baseTargets.spo2Pct + fio2Bonus + bagEffect;
  let hrTarget = baseTargets.hrBpm;
  let rrTarget = baseTargets.respRpm;
  let mapTarget = baseTargets.mapMmhg;

  const spo2Deficit = Math.max(0, config.thresholds.spo2.low - vitals.spo2Pct);
  hrTarget += spo2Deficit * config.targets.hypoxiaHrGain;
  rrTarget += spo2Deficit * config.targets.hypoxiaRrGain;

  if (config.shock) {
    mapTarget = config.shock.mapDriftTarget;
    hrTarget = config.shock.hrDriftTarget + spo2Deficit * config.targets.hypoxiaHrGain;
    if (config.shock.spo2DriftTarget !== undefined) {
      spo2Target = config.shock.spo2DriftTarget + fio2Bonus + bagEffect;
    }
  }

  const pressorBoost = interventions.pressorDose * config.interventions.pressor.mapBoost;
  const pressorHr = interventions.pressorDose * config.interventions.pressor.hrDelta;
  mapTarget += bolusEffect + pressorBoost;
  hrTarget += pressorHr;

  let nextSpo2 = expApproach(vitals.spo2Pct, spo2Target, config.timeConstants.spo2Sec, dtSec);
  let nextHr = expApproach(vitals.hrBpm, hrTarget, config.timeConstants.hrSec, dtSec);
  let nextRr = expApproach(vitals.respRpm, rrTarget, config.timeConstants.rrSec, dtSec);
  let nextMap = expApproach(vitals.mapMmhg, mapTarget, config.timeConstants.mapSec, dtSec);

  if (config.noise.enabled) {
    nextSpo2 = applyNoise(nextSpo2, config.noise.amplitude.spo2Pct);
    nextHr = applyNoise(nextHr, config.noise.amplitude.hrBpm);
    nextRr = applyNoise(nextRr, config.noise.amplitude.respRpm);
    nextMap = applyNoise(nextMap, config.noise.amplitude.mapMmhg);
  }

  nextSpo2 = clamp(nextSpo2, 50, 100);
  nextHr = clamp(nextHr, 30, 180);
  nextRr = clamp(nextRr, 6, 40);
  nextMap = clamp(nextMap, 40, 130);

  const pulsePressure = config.pulsePressure;
  const bpSys = nextMap + pulsePressure / 2;
  const bpDia = nextMap - pulsePressure / 2;

  let shockDetectionSec = state.shockDetectionSec;
  let shockSuspected = state.shockSuspected;
  if (config.shock) {
    const meetsShock = nextMap <= config.shock.detection.mapLow && nextHr >= config.shock.detection.hrHigh;
    shockDetectionSec = meetsShock ? shockDetectionSec + dtSec : 0;
    if (!shockSuspected && shockDetectionSec >= config.shock.detection.durationSec) {
      shockSuspected = true;
    }
    if (!meetsShock) {
      shockSuspected = false;
    }
  } else {
    shockDetectionSec = 0;
    shockSuspected = false;
  }

  const nextSample: TrendSample = {
    tSec: state.tSec + dtSec,
    hrBpm: nextHr,
    spo2Pct: nextSpo2,
    respRpm: nextRr,
    mapMmhg: nextMap
  };
  const trendSamples = updateTrendSamples(state.trendSamples, nextSample, config.trend.windowSec);
  const trendState = deriveTrend(trendSamples, config);

  const nextVitals = {
    ...vitals,
    hrBpm: nextHr,
    spo2Pct: nextSpo2,
    respRpm: nextRr,
    mapMmhg: nextMap,
    bpSys,
    bpDia
  };

  const nextState: PatientState = {
    ...state,
    tSec: state.tSec + dtSec,
    vitals: nextVitals,
    interventions: {
      ...interventions,
      fio2: fio2Clamped,
      bagEffect,
      bagRemainingSec: bagRemaining,
      bolusEffect,
      bolusCooldownSec: bolusCooldown
    },
    shockDetectionSec,
    shockSuspected,
    trendSamples,
    trendState,
    lastUpdatedMs: Date.now()
  };

  const objectiveState = updateObjectives(nextState, config, dtSec);

  let eventLog = state.eventLog;
  if (shockSuspected && !state.shockSuspected) {
    eventLog = appendEvent(eventLog, {
      id: "shock",
      label: "Shock suspected",
      tSec: nextState.tSec
    });
  }

  return {
    ...nextState,
    objectiveState,
    eventLog
  };
};
