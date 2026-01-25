import type { PatientState } from "./patientState";

export type ScenarioConfig = {
  baseline: { spo2: number; hr: number; rr: number; map: number };
  ventOff: { spo2Target: number; spo2TauSec: number; hrGain: number; rrGain: number };
  ventOn: { spo2Target: number; spo2TauSec: number; hrTauSec: number; rrTauSec: number };
  fio2Effect: { min: number; max: number; spo2BonusAt100: number };
  bvm: { boost: number; durationSec: number };
  thresholds: { spo2Low: number; spo2Critical: number; hrHigh: number };
  limits: {
    spo2Min: number;
    spo2Max: number;
    hrMin: number;
    hrMax: number;
    rrMin: number;
    rrMax: number;
    mapMin: number;
    mapMax: number;
  };
  objectives: { spo2MaintainMin: number; spo2MaintainSec: number; hrMin: number; hrMax: number };
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const smoothTowards = (current: number, target: number, tauSec: number, dtSec: number) => {
  if (tauSec <= 0 || dtSec <= 0) {
    return current;
  }
  const alpha = 1 - Math.exp(-dtSec / tauSec);
  return current + (target - current) * alpha;
};

const normalizedFio2 = (fio2: number, scenario: ScenarioConfig) => {
  const { min, max } = scenario.fio2Effect;
  return clamp((fio2 - min) / (max - min), 0, 1);
};

export const updatePatient = (
  state: PatientState,
  dtSec: number,
  scenario: ScenarioConfig
): PatientState => {
  if (!Number.isFinite(dtSec) || dtSec <= 0) {
    return state;
  }

  const nextTime = state.timeSec + dtSec;
  const fio2 = clamp(state.fio2, scenario.fio2Effect.min, scenario.fio2Effect.max);
  const fio2Ratio = normalizedFio2(fio2, scenario);
  const fio2Bonus = fio2Ratio * scenario.fio2Effect.spo2BonusAt100;
  const fio2TauFactor = scenario.fio2Effect.min / fio2;

  const baseSpo2Target = state.ventOn ? scenario.ventOn.spo2Target : scenario.ventOff.spo2Target;
  const boostRemaining =
    state.bvmActive && state.bvmBoostUntil !== null
      ? Math.max(0, state.bvmBoostUntil - nextTime)
      : 0;
  const boostFactor = scenario.bvm.durationSec > 0 ? boostRemaining / scenario.bvm.durationSec : 0;
  const bvmBoost = boostFactor * scenario.bvm.boost;

  const spo2Target = baseSpo2Target + fio2Bonus + bvmBoost;
  const spo2Tau = (state.ventOn ? scenario.ventOn.spo2TauSec : scenario.ventOff.spo2TauSec) * fio2TauFactor;
  const nextSpo2 = clamp(
    smoothTowards(state.spo2, spo2Target, spo2Tau, dtSec),
    scenario.limits.spo2Min,
    scenario.limits.spo2Max
  );

  const spo2Deficit = Math.max(0, scenario.baseline.spo2 - nextSpo2);
  const hrTarget = state.ventOn
    ? scenario.baseline.hr
    : scenario.baseline.hr + spo2Deficit * scenario.ventOff.hrGain;
  const rrTarget = state.ventOn
    ? scenario.baseline.rr
    : scenario.baseline.rr + spo2Deficit * scenario.ventOff.rrGain;
  const hrTau = state.ventOn ? scenario.ventOn.hrTauSec : scenario.ventOff.spo2TauSec;
  const rrTau = state.ventOn ? scenario.ventOn.rrTauSec : scenario.ventOff.spo2TauSec;

  const nextHr = clamp(
    smoothTowards(state.hr, hrTarget, hrTau, dtSec),
    scenario.limits.hrMin,
    scenario.limits.hrMax
  );
  const nextRr = clamp(
    smoothTowards(state.rr, rrTarget, rrTau, dtSec),
    scenario.limits.rrMin,
    scenario.limits.rrMax
  );
  const nextMap = clamp(
    smoothTowards(state.map, scenario.baseline.map, scenario.ventOn.rrTauSec, dtSec),
    scenario.limits.mapMin,
    scenario.limits.mapMax
  );

  const bvmExpired = state.bvmActive && state.bvmBoostUntil !== null && nextTime >= state.bvmBoostUntil;

  return {
    ...state,
    timeSec: nextTime,
    spo2: nextSpo2,
    hr: nextHr,
    rr: nextRr,
    map: nextMap,
    fio2,
    bvmActive: bvmExpired ? false : state.bvmActive,
    bvmBoostUntil: bvmExpired ? null : state.bvmBoostUntil
  };
};
