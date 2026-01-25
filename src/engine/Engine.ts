import type { Devices, EngineState, Vitals } from "./types";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export class Engine {
  private state: EngineState;

  constructor() {
    const vitals: Vitals = {
      hrBpm: 80,
      spo2Pct: 100,
      respRpm: 13,
      tempC: 37.3,
      bpSys: 112,
      bpDia: 71
    };
    const devices: Devices = {
      ventOn: true
    };
    this.state = {
      tSec: 0,
      vitals,
      devices,
      lastUpdatedMs: Date.now()
    };
  }

  getState(): EngineState {
    return this.state;
  }

  setVentOn(on: boolean) {
    if (this.state.devices.ventOn === on) {
      return;
    }
    this.state = {
      ...this.state,
      devices: {
        ...this.state.devices,
        ventOn: on
      },
      lastUpdatedMs: Date.now()
    };
  }

  tick(dtSec: number) {
    if (!Number.isFinite(dtSec) || dtSec <= 0) {
      return;
    }

    const kSpo2 = 0.1;
    const kHr = 0.08;
    const { vitals, devices } = this.state;

    const spo2Target = devices.ventOn ? 99.5 : 86;
    const hrTarget = devices.ventOn
      ? 80
      : 80 + clamp((95 - vitals.spo2Pct) * 1.2, 0, 25);

    const nextSpo2 = clamp(
      vitals.spo2Pct + (spo2Target - vitals.spo2Pct) * kSpo2 * dtSec,
      80,
      100
    );
    const nextHr = clamp(vitals.hrBpm + (hrTarget - vitals.hrBpm) * kHr * dtSec, 55, 140);

    this.state = {
      ...this.state,
      tSec: this.state.tSec + dtSec,
      lastUpdatedMs: Date.now(),
      vitals: {
        ...vitals,
        spo2Pct: nextSpo2,
        hrBpm: nextHr
      }
    };
  }
}
