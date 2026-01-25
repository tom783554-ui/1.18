import type { ActionEvent, ActionKind, ImagingFlags, Interventions, Labs, SimState, Vitals } from "./types";
import { Rhythm } from "./types";
import { applyDefib, clampVitals, computeMAP, stepVitals } from "./vitalsModel";
import { advancePhase, initialScriptState, rollArrhythmia, shouldTriggerArrest } from "../scenarios/codeBlueScript";
import { getDiagnosis } from "../scenarios/diagnoses";

const actionId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const createInterventions = (): Interventions => ({
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
});

const createInitialVitals = (diagnosisId: string): Vitals => {
  const dx = getDiagnosis(diagnosisId);
  const vitals = { ...dx.baselineVitals };
  return clampVitals({ ...vitals, map: computeMAP(vitals.sbp, vitals.dbp) });
};

const createInitialState = (diagnosisId: string): SimState => ({
  timeMs: 0,
  phase: "PREBRIEF",
  diagnosisId,
  score: 50,
  notes: [],
  alerts: [],
  lastActions: []
});

export class SimEngine {
  private vitals: Vitals;
  private state: SimState;
  private labs: Labs;
  private imaging: ImagingFlags;
  private interventions: Interventions;
  private subscribers = new Set<() => void>();
  private actionLog: ActionEvent[] = [];
  private scriptState: ReturnType<typeof initialScriptState>;
  private epiEffect = 0;
  private fluidEffect = 0;
  private arrestStartMs: number | null = null;

  constructor({ diagnosisId }: { diagnosisId: string }) {
    const dx = getDiagnosis(diagnosisId);
    this.vitals = createInitialVitals(dx.id);
    this.state = createInitialState(dx.id);
    this.labs = { ...dx.labs };
    this.imaging = { ...dx.imaging };
    this.interventions = createInterventions();
    this.scriptState = initialScriptState(dx.id);
  }

  getVitals() {
    return { ...this.vitals };
  }

  getState() {
    return { ...this.state, notes: [...this.state.notes], alerts: [...this.state.alerts], lastActions: [...this.state.lastActions] };
  }

  getLabs() {
    return { ...this.labs, abg: { ...this.labs.abg }, bmp: { ...this.labs.bmp }, cbc: { ...this.labs.cbc } };
  }

  getImaging() {
    return { ...this.imaging };
  }

  subscribe(fn: () => void) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  private notify() {
    this.subscribers.forEach((fn) => fn());
  }

  private pushAction(action: ActionEvent) {
    this.actionLog.push(action);
    if (this.actionLog.length > 200) {
      this.actionLog.shift();
    }
    this.state.lastActions = this.actionLog.slice(-8).map((entry) => entry.kind);
  }

  getLog() {
    return [...this.actionLog];
  }

  dispatch(event: Omit<ActionEvent, "id" | "tMs">) {
    const action: ActionEvent = { id: actionId(), tMs: this.state.timeMs, ...event };
    this.pushAction(action);

    switch (action.kind) {
      case "VENT_TOGGLE": {
        const nextVent = Boolean(action.payload?.ventOn ?? !this.vitals.ventOn);
        this.vitals = { ...this.vitals, ventOn: nextVent };
        this.addNote(`Vent ${nextVent ? "ON" : "OFF"}`);
        break;
      }
      case "VENT_FIO2_UP": {
        this.vitals = { ...this.vitals, fio2: Math.min(1, this.vitals.fio2 + 0.05) };
        this.addNote(`FiO2 -> ${Math.round(this.vitals.fio2 * 100)}%`);
        break;
      }
      case "VENT_FIO2_DOWN": {
        this.vitals = { ...this.vitals, fio2: Math.max(0.21, this.vitals.fio2 - 0.05) };
        this.addNote(`FiO2 -> ${Math.round(this.vitals.fio2 * 100)}%`);
        break;
      }
      case "VENT_PEEP_UP": {
        this.vitals = { ...this.vitals, peep: Math.min(18, this.vitals.peep + 1) };
        this.addNote(`PEEP -> ${this.vitals.peep}`);
        break;
      }
      case "VENT_PEEP_DOWN": {
        this.vitals = { ...this.vitals, peep: Math.max(4, this.vitals.peep - 1) };
        this.addNote(`PEEP -> ${this.vitals.peep}`);
        break;
      }
      case "AIRWAY_BAGVALVE": {
        this.interventions.bagging = true;
        this.addNote("Bag-valve support applied");
        break;
      }
      case "AIRWAY_INTUBATE": {
        this.interventions.intubated = true;
        this.addNote("Airway intubated");
        break;
      }
      case "AIRWAY_SUCTION": {
        this.interventions.suction = true;
        this.addNote("Airway suction performed");
        break;
      }
      case "MONITOR_CHECK_RHYTHM": {
        this.addAlert(`RHYTHM: ${this.vitals.rhythm}`);
        break;
      }
      case "DEFIB_CHARGE": {
        this.interventions.defib = true;
        this.addNote("Defibrillator charged");
        break;
      }
      case "DEFIB_SHOCK": {
        this.interventions.defib = false;
        this.vitals = applyDefib(this.vitals);
        this.addNote("Defibrillation delivered");
        break;
      }
      case "CPR_START": {
        this.interventions.cpr = true;
        this.addNote("CPR started");
        break;
      }
      case "CPR_STOP": {
        this.interventions.cpr = false;
        this.addNote("CPR stopped");
        break;
      }
      case "MED_EPI": {
        this.interventions.epi = true;
        this.epiEffect = 1;
        this.addNote("Epinephrine administered");
        break;
      }
      case "MED_AMIO": {
        this.interventions.amio = true;
        this.addNote("Amiodarone administered");
        break;
      }
      case "MED_ANTIBIOTICS": {
        this.interventions.antibiotics = true;
        this.addNote("Antibiotics started");
        break;
      }
      case "MED_DIURETIC": {
        this.addNote("Diuretic given");
        break;
      }
      case "MED_ANTIPLATELET": {
        this.addNote("Aspirin and heparin administered");
        break;
      }
      case "IV_FLUID_BOLUS": {
        this.interventions.fluids = true;
        this.fluidEffect = 1;
        this.addNote("IV fluid bolus given");
        break;
      }
      case "PRESSOR_START": {
        this.interventions.pressors = true;
        this.addNote("Vasopressors started");
        break;
      }
      case "PRESSOR_TITRATE_UP": {
        this.interventions.pressors = true;
        this.addNote("Pressors titrated up");
        break;
      }
      case "BLOOD_TRANSFUSE": {
        this.interventions.blood = true;
        this.addNote("Blood transfusion initiated");
        break;
      }
      case "LABS_ABG": {
        this.addNote("ABG ordered");
        this.addAlert(
          `ABG RESULT: pH ${this.labs.abg.ph.toFixed(2)} / PaO2 ${Math.round(this.labs.abg.po2)} / PaCO2 ${
            Math.round(this.labs.abg.pco2)
          }`
        );
        break;
      }
      case "LABS_CBC_BMP_TROP": {
        this.addNote("CBC/BMP/Troponin ordered");
        this.addAlert(
          `LABS: Hgb ${this.labs.cbc.hgb.toFixed(1)} WBC ${this.labs.cbc.wbc.toFixed(
            1
          )} Trop ${this.labs.trop.toFixed(2)}`
        );
        break;
      }
      case "IMAGING_CXR": {
        this.imaging.cxrOrdered = true;
        this.imaging.cxrResult = this.imaging.cxrResult ?? "Pending";
        this.addAlert(`CXR RESULT: ${this.imaging.cxrResult ?? "Pending"}`);
        break;
      }
      case "IMAGING_FAST": {
        this.imaging.usFastOrdered = true;
        this.imaging.usFastResult = this.imaging.usFastResult ?? "Pending";
        this.addAlert(`FAST RESULT: ${this.imaging.usFastResult ?? "Pending"}`);
        break;
      }
      case "CALL_RRT": {
        this.addNote("RRT paged");
        break;
      }
      case "CALL_CATHLAB": {
        this.interventions.cathLab = true;
        this.addNote("Cath lab notified");
        this.addNote("Aspirin/heparin ordered");
        break;
      }
      case "CALL_OR": {
        this.addNote("OR consult requested");
        break;
      }
      case "CALL_NEURO": {
        this.addNote("Neuro consult requested");
        this.addNote("CT head ordered");
        break;
      }
      case "CHECK_GLUCOSE": {
        this.addNote("POC glucose checked: 112 mg/dL");
        break;
      }
      case "CHECK_TEMP": {
        this.addNote(`Temp checked: ${this.vitals.tempC.toFixed(1)}°C`);
        break;
      }
      default:
        break;
    }

    this.scoreAction(action.kind);
    this.notify();
  }

  private scoreAction(kind: ActionKind) {
    const dx = getDiagnosis(this.state.diagnosisId);
    const wins = dx.winConditions;
    const gain = wins.includes(kind) ? 2 : 0;
    const penalty = kind === "IV_FLUID_BOLUS" && dx.id === "dx_volume_overload" ? -2 : 0;
    this.state.score = clampVitals(this.vitals).spo2 < 85 ? this.state.score - 1 : this.state.score;
    this.state.score = clampVitals(this.vitals).map < 55 ? this.state.score - 1 : this.state.score;
    this.state.score = Math.max(0, Math.min(100, this.state.score + gain + penalty));
  }

  private addAlert(message: string) {
    const timestamp = `t=${(this.state.timeMs / 1000).toFixed(1)}s`;
    this.state.alerts = [`${timestamp} ${message}`, ...this.state.alerts].slice(0, 6);
  }

  private addNote(message: string) {
    this.state.notes = [message, ...this.state.notes].slice(0, 20);
  }

  tick(dtMs: number) {
    if (!Number.isFinite(dtMs) || dtMs <= 0) {
      return;
    }
    this.state.timeMs += dtMs;
    const dx = getDiagnosis(this.state.diagnosisId);

    this.scriptState = advancePhase(this.scriptState, this.state.timeMs, dx.id);
    this.state.phase = this.scriptState.phase;

    if (!this.scriptState.arrestTriggered && shouldTriggerArrest(dx.id, this.state.timeMs)) {
      this.scriptState = { ...this.scriptState, arrestTriggered: true };
      this.vitals = { ...this.vitals, rhythm: rollArrhythmia(dx.id) };
      this.addAlert(`RHYTHM: ${this.vitals.rhythm}`);
    }

    if (this.state.timeMs >= this.scriptState.nextArrhythmiaCheckMs && this.vitals.rhythm === Rhythm.NSR) {
      this.vitals = { ...this.vitals, rhythm: rollArrhythmia(dx.id) };
      this.addAlert(`RHYTHM: ${this.vitals.rhythm}`);
      this.scriptState = {
        ...this.scriptState,
        nextArrhythmiaCheckMs: this.state.timeMs + 90000
      };
    }

    if (this.vitals.rhythm === Rhythm.ASYSTOLE || this.vitals.rhythm === Rhythm.PEA) {
      if (this.arrestStartMs === null) {
        this.arrestStartMs = this.state.timeMs;
      }
    } else {
      this.arrestStartMs = null;
    }

    const shockRate = dx.progression.shockRate * (this.interventions.pressors ? 0.5 : 1);
    const hypoxiaRate = dx.progression.hypoxiaRate * (this.interventions.antibiotics ? 0.7 : 1);

    this.epiEffect = Math.max(0, this.epiEffect - dtMs / 30000);
    this.fluidEffect = Math.max(0, this.fluidEffect - dtMs / 45000);

    this.vitals = stepVitals(this.vitals, dtMs, {
      baseline: dx.baselineVitals,
      interventions: this.interventions,
      hypoxiaRate,
      shockRate,
      arrhythmiaRisk: dx.progression.arrhythmiaRisk,
      epiEffect: this.epiEffect + (this.interventions.pressors ? 0.4 : 0),
      fluidEffect: this.fluidEffect
    });

    this.vitals = clampVitals(this.vitals);
    this.handleLossConditions(dx.lossConditions);
    this.notify();
  }

  private handleLossConditions(loss: { asystoleSec: number; spo2Below: { threshold: number; durationSec: number }; mapBelow: { threshold: number; durationSec: number } }) {
    if (this.arrestStartMs !== null) {
      const elapsed = (this.state.timeMs - this.arrestStartMs) / 1000;
      if (elapsed > loss.asystoleSec) {
        this.addAlert("Loss: prolonged asystole");
      }
    }
    if (this.vitals.spo2 < loss.spo2Below.threshold) {
      this.addAlert("Warning: SpO2 critically low");
    }
    if (this.vitals.map < loss.mapBelow.threshold) {
      this.addAlert("Warning: MAP critically low");
    }
  }

  reset(diagnosisId: string) {
    const dx = getDiagnosis(diagnosisId);
    this.vitals = createInitialVitals(dx.id);
    this.state = createInitialState(dx.id);
    this.labs = { ...dx.labs };
    this.imaging = { ...dx.imaging };
    this.interventions = createInterventions();
    this.scriptState = initialScriptState(dx.id);
    this.epiEffect = 0;
    this.fluidEffect = 0;
    this.actionLog = [];
    this.arrestStartMs = null;
    this.notify();
  }
}
