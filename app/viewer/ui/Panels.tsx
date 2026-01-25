"use client";

import { applyBvm, applyDefibShock, setDefibCharged, setFio2, setVentOn } from "../../../src/engine/store";
import { useEngineState } from "../../../src/engine/useEngineState";
import scenario from "../../../src/engine/scenarios/respFailure.json";

type PanelState = { title: string; id: string } | null;

type PanelsProps = {
  panel: PanelState;
  onClose: () => void;
};

const isVentilatorPanel = (panel: PanelState) => {
  if (!panel) {
    return false;
  }
  const id = panel.id.toLowerCase();
  const title = panel.title.toLowerCase();
  return id.includes("vent") || title.includes("vent");
};

const isMonitorPanel = (panel: PanelState) => {
  if (!panel) {
    return false;
  }
  const id = panel.id.toLowerCase();
  const title = panel.title.toLowerCase();
  return id.includes("monitor") || title.includes("monitor");
};

const isCrashCartPanel = (panel: PanelState) => {
  if (!panel) {
    return false;
  }
  const id = panel.id.toLowerCase();
  const title = panel.title.toLowerCase();
  return id.includes("crash") || id.includes("cart") || title.includes("crash") || title.includes("cart");
};

const scenarioConfig = scenario as typeof scenario;

export default function Panels({ panel, onClose }: PanelsProps) {
  const engineState = useEngineState();
  const { timeSec } = engineState;
  const fio2Pct = Math.round(engineState.fio2 * 100);
  const minFio2 = scenarioConfig.fio2Effect.min;
  const maxFio2 = scenarioConfig.fio2Effect.max;
  const fio2MinPct = Math.round(minFio2 * 100);
  const fio2MaxPct = Math.round(maxFio2 * 100);
  const defibReady = engineState.defibCharged;
  const lastShockSec =
    engineState.defibShockAtSec !== null ? Math.max(0, engineState.timeSec - engineState.defibShockAtSec) : null;

  if (!panel) {
    return null;
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Hotspot panel">
      <div className="panel">
        <div className="header">
          <div className="titles">
            <div className="title">{panel.title}</div>
            <div className="subtitle">{panel.id}</div>
          </div>
          <button type="button" onClick={onClose} className="close">
            Close
          </button>
        </div>
        <div className="body">
          {isVentilatorPanel(panel) ? (
            <div className="section">
              <div className="section-title">Ventilator Control</div>
              <div className="status-row">
                <span>Status</span>
                <span className={engineState.ventOn ? "status on" : "status off"}>
                  {engineState.ventOn ? "ON" : "OFF"}
                </span>
              </div>
              <button
                type="button"
                className="action toggle"
                onClick={() => setVentOn(!engineState.ventOn)}
              >
                ON/OFF
              </button>
              <div className="button-row">
                <button
                  type="button"
                  className={engineState.ventOn ? "action active" : "action"}
                  onClick={() => setVentOn(true)}
                >
                  Turn On
                </button>
                <button
                  type="button"
                  className={!engineState.ventOn ? "action active" : "action"}
                  onClick={() => setVentOn(false)}
                >
                  Turn Off
                </button>
              </div>
              <div className="section-title">FiO₂ Control</div>
              <div className="slider-row">
                <input
                  type="range"
                  min={fio2MinPct}
                  max={fio2MaxPct}
                  value={fio2Pct}
                  onChange={(event) => {
                    const nextPct = Number(event.target.value);
                    setFio2(nextPct / 100);
                  }}
                />
                <span className="slider-value">{fio2Pct}%</span>
              </div>
              <div className="note">
                Higher FiO₂ increases oxygenation rate and ceiling.
              </div>
              <div className="section-title">Bag-Valve-Mask</div>
              <button type="button" className="action bvm" onClick={() => applyBvm()}>
                Bag Patient
              </button>
            </div>
          ) : null}
          {isMonitorPanel(panel) ? (
            <div className="section">
              <div className="section-title">Live Vitals</div>
              <div className="vitals-grid">
                <div className="vital">
                  <span className="label">HR</span>
                  <span className="value">{Math.round(engineState.hr)} bpm</span>
                </div>
                <div className="vital">
                  <span className="label">SpO₂</span>
                  <span className="value">{engineState.spo2.toFixed(1)}%</span>
                </div>
                <div className="vital">
                  <span className="label">Resp</span>
                  <span className="value">{Math.round(engineState.rr)} rpm</span>
                </div>
                <div className="vital">
                  <span className="label">MAP</span>
                  <span className="value">{Math.round(engineState.map)} mmHg</span>
                </div>
              </div>
              <div className="updated">Elapsed {Math.round(timeSec)}s</div>
            </div>
          ) : null}
          {isCrashCartPanel(panel) ? (
            <div className="section">
              <div className="section-title">Crash Cart</div>
              <div className="status-row">
                <span>Defibrillator</span>
                <span className={defibReady ? "status on" : "status off"}>
                  {defibReady ? "Charged" : "Standby"}
                </span>
              </div>
              <div className="button-row">
                <button
                  type="button"
                  className={defibReady ? "action active" : "action"}
                  onClick={() => setDefibCharged(!defibReady)}
                >
                  {defibReady ? "Disarm" : "Charge"}
                </button>
                <button
                  type="button"
                  className="action"
                  onClick={() => applyDefibShock()}
                  disabled={!defibReady}
                >
                  Deliver Shock
                </button>
              </div>
              <div className="note">
                {lastShockSec === null
                  ? "No shocks delivered yet."
                  : `Last shock ${Math.round(lastShockSec)}s ago.`}
              </div>
            </div>
          ) : null}
          {!isVentilatorPanel(panel) && !isMonitorPanel(panel) && !isCrashCartPanel(panel) ? (
            <div className="hint">Tap another label to switch. Tap empty space to deselect.</div>
          ) : (
            <div className="hint subtle">Tap empty space to return to the room.</div>
          )}
        </div>
      </div>
      <style jsx>{`
        .overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 30;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 16px;
        }
        .panel {
          pointer-events: auto;
          margin-top: 64px;
          width: min(92vw, 480px);
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(8, 8, 10, 0.86);
          backdrop-filter: blur(10px);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.55);
          color: #f8fafc;
        }
        .header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 14px 10px;
        }
        .titles {
          display: grid;
          gap: 4px;
        }
        .title {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.01em;
        }
        .subtitle {
          font-size: 12px;
          color: rgba(248, 250, 252, 0.72);
          font-family: "SFMono-Regular", ui-monospace, SFMono-Regular, Menlo, Monaco,
            Consolas, "Liberation Mono", "Courier New", monospace;
        }
        .close {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.08);
          color: rgba(248, 250, 252, 0.88);
          font-size: 12px;
          font-weight: 700;
          padding: 6px 10px;
          border-radius: 10px;
          cursor: pointer;
          white-space: nowrap;
        }
        .close:hover {
          background: rgba(255, 255, 255, 0.14);
          color: #fff;
        }
        .body {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding: 12px 14px 14px;
          display: grid;
          gap: 12px;
        }
        .section {
          display: grid;
          gap: 10px;
        }
        .section-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(248, 250, 252, 0.7);
        }
        .status-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }
        .status {
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
        }
        .status.on {
          background: rgba(34, 197, 94, 0.2);
          color: #4ade80;
        }
        .status.off {
          background: rgba(248, 113, 113, 0.18);
          color: #fca5a5;
        }
        .button-row {
          display: flex;
          gap: 10px;
        }
        .slider-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        input[type="range"] {
          flex: 1;
          accent-color: #38bdf8;
        }
        .slider-value {
          min-width: 44px;
          text-align: right;
          font-size: 12px;
          font-weight: 600;
          color: #e2e8f0;
        }
        .note {
          font-size: 11px;
          color: rgba(226, 232, 240, 0.72);
          line-height: 1.4;
        }
        .action {
          flex: 1;
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.06);
          color: #f8fafc;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 10px;
          border-radius: 10px;
          cursor: pointer;
        }
        .action:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .action.bvm {
          border-color: rgba(248, 113, 113, 0.6);
          background: rgba(248, 113, 113, 0.15);
        }
        .action.toggle {
          width: 100%;
          justify-self: stretch;
        }
        .action.active {
          border-color: rgba(59, 130, 246, 0.7);
          background: rgba(59, 130, 246, 0.2);
        }
        .vitals-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 8px 12px;
        }
        .vital {
          display: grid;
          gap: 2px;
          font-size: 13px;
        }
        .label {
          font-size: 11px;
          color: rgba(248, 250, 252, 0.6);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .value {
          font-weight: 600;
        }
        .updated {
          font-size: 11px;
          color: rgba(248, 250, 252, 0.55);
        }
        .hint {
          font-size: 12px;
          color: rgba(248, 250, 252, 0.74);
          line-height: 1.35;
        }
        .hint.subtle {
          color: rgba(248, 250, 252, 0.55);
        }
      `}</style>
    </div>
  );
}
