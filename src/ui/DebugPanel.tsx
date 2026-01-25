"use client";

import type { ScenarioConfig } from "../engine/scenarioConfig";
import type { PatientState } from "../engine/patientState";
import { TICK_DT_SEC } from "../engine/store";

type DebugPanelProps = {
  open: boolean;
  onToggle: () => void;
  state: PatientState;
  config: ScenarioConfig;
  onRunSimCheck: () => void;
};

export default function DebugPanel({ open, onToggle, state, config, onRunSimCheck }: DebugPanelProps) {
  const events = state.eventLog.entries.slice(-10).reverse();
  return (
    <div className="debug-panel">
      <button type="button" className={open ? "toggle active" : "toggle"} onClick={onToggle}>
        Debug
      </button>
      {open ? (
        <div className="panel" role="status" aria-live="polite">
          <div className="row">
            <span>Scenario</span>
            <strong>{state.scenarioName}</strong>
          </div>
          <div className="row">
            <span>Tick</span>
            <strong>{TICK_DT_SEC.toFixed(2)}s</strong>
          </div>
          <div className="row">
            <span>Sim Time</span>
            <strong>{state.tSec.toFixed(1)}s</strong>
          </div>
          <div className="section">
            <div className="section-title">Targets / Taus</div>
            <div className="grid">
              <div>SpO₂: {config.targets.ventOn.spo2Pct} (τ {config.timeConstants.spo2Sec}s)</div>
              <div>HR: {config.targets.ventOn.hrBpm} (τ {config.timeConstants.hrSec}s)</div>
              <div>RR: {config.targets.ventOn.respRpm} (τ {config.timeConstants.rrSec}s)</div>
              <div>MAP: {config.targets.ventOn.mapMmhg} (τ {config.timeConstants.mapSec}s)</div>
            </div>
          </div>
          <div className="section">
            <div className="section-title">Recent Events</div>
            <ul>
              {events.length === 0 ? <li>None yet</li> : null}
              {events.map((event) => (
                <li key={`${event.id}-${event.tSec.toFixed(1)}`}>
                  <span>{event.label}</span>
                  <em>{event.tSec.toFixed(1)}s</em>
                </li>
              ))}
            </ul>
          </div>
          <button type="button" className="action" onClick={onRunSimCheck}>
            Run sim check
          </button>
        </div>
      ) : null}
      <style jsx>{`
        .debug-panel {
          position: absolute;
          right: 16px;
          bottom: 16px;
          display: grid;
          gap: 8px;
          pointer-events: auto;
          z-index: 12;
        }
        .toggle {
          appearance: none;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(15, 23, 42, 0.8);
          color: #e2e8f0;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
        }
        .toggle.active {
          border-color: rgba(56, 189, 248, 0.7);
          color: #fff;
        }
        .panel {
          width: min(280px, 70vw);
          background: rgba(8, 12, 20, 0.92);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 12px;
          padding: 10px 12px;
          color: #f1f5f9;
          font-size: 12px;
          display: grid;
          gap: 10px;
        }
        .row {
          display: flex;
          justify-content: space-between;
        }
        .section-title {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(226, 232, 240, 0.7);
          margin-bottom: 4px;
        }
        .grid {
          display: grid;
          gap: 4px;
        }
        ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 6px;
        }
        li {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
        }
        em {
          font-style: normal;
          color: rgba(226, 232, 240, 0.6);
        }
        .action {
          appearance: none;
          border: 1px solid rgba(56, 189, 248, 0.6);
          background: rgba(56, 189, 248, 0.18);
          color: #e0f2fe;
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
