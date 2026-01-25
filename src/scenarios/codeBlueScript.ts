import { diagnoses, getDiagnosis } from "./diagnoses";
import { Rhythm } from "../engine/types";

export type CodeBluePhase = "PREBRIEF" | "DETERIORATION" | "ARREST_WINDOW" | "CODE_BLUE" | "ROSC";

export type CodeBlueScriptState = {
  phase: CodeBluePhase;
  phaseStartedMs: number;
  arrestTriggered: boolean;
  nextArrhythmiaCheckMs: number;
  targetArrhythmia: Rhythm;
};

const SEED_BASE = 99173;

const hashSeed = (value: string) =>
  value.split("").reduce((acc, char) => acc + char.charCodeAt(0), SEED_BASE);

export const createDeterministicRng = (seed: string) => {
  let state = hashSeed(seed);
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

export const initialScriptState = (diagnosisId: string): CodeBlueScriptState => {
  const rng = createDeterministicRng(diagnosisId);
  const arrhythmiaPool = [Rhythm.VF, Rhythm.VT, Rhythm.PEA];
  return {
    phase: "PREBRIEF",
    phaseStartedMs: 0,
    arrestTriggered: false,
    nextArrhythmiaCheckMs: 90000 + rng() * 45000,
    targetArrhythmia: arrhythmiaPool[Math.floor(rng() * arrhythmiaPool.length)]
  };
};

export const getPhaseDurationMs = (phase: CodeBluePhase, diagnosisId: string) => {
  if (phase === "PREBRIEF") {
    return 30000;
  }
  if (phase === "DETERIORATION") {
    const rng = createDeterministicRng(diagnosisId);
    return 120000 + rng() * 120000;
  }
  if (phase === "ARREST_WINDOW") {
    return 60000;
  }
  if (phase === "CODE_BLUE") {
    return 120000;
  }
  return 120000;
};

export const advancePhase = (state: CodeBlueScriptState, nowMs: number, diagnosisId: string) => {
  const duration = getPhaseDurationMs(state.phase, diagnosisId);
  if (nowMs - state.phaseStartedMs < duration) {
    return state;
  }
  const nextPhase: CodeBluePhase =
    state.phase === "PREBRIEF"
      ? "DETERIORATION"
      : state.phase === "DETERIORATION"
        ? "ARREST_WINDOW"
        : state.phase === "ARREST_WINDOW"
          ? "CODE_BLUE"
          : state.phase === "CODE_BLUE"
            ? "ROSC"
            : "ROSC";
  return {
    ...state,
    phase: nextPhase,
    phaseStartedMs: nowMs
  };
};

export const shouldTriggerArrest = (diagnosisId: string, nowMs: number) => {
  const dx = getDiagnosis(diagnosisId);
  if (dx.progression.arrhythmiaRisk < 0.2) {
    return nowMs > 150000;
  }
  return nowMs > 110000;
};

export const rollArrhythmia = (diagnosisId: string) => {
  const rng = createDeterministicRng(diagnosisId);
  const roll = rng();
  if (roll < 0.4) {
    return Rhythm.VF;
  }
  if (roll < 0.7) {
    return Rhythm.VT;
  }
  return Rhythm.PEA;
};

export const pickRandomDiagnosis = (seed: number) => {
  const index = seed % diagnoses.length;
  return diagnoses[index]?.id ?? diagnoses[0].id;
};
