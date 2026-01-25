"use client";

import { usePatientEngine } from "../../../src/engine/usePatientEngine";

type PanelState = { title: string; id: string } | null;

type PanelsProps = {
  panel: PanelState;
  onClose: () => void;
};

const matchPanel = (panel: PanelState, matcher: (value: string) => boolean) => {
  if (!panel) {
    return false;
  }
  const id = panel.id.toLowerCase();
  const title = panel.title.toLowerCase();
  return matcher(id) || matcher(title);
};

const isVentilatorPanel = (panel: PanelState) =>
  matchPanel(panel, (value) => value.includes("vent"));

const isMonitorPanel = (panel: PanelState) =>
  matchPanel(panel, (value) => value.includes("monitor"));

const isFio2Panel = (panel: PanelState) =>
  matchPanel(panel, (value) => value.includes("fio2") || value.includes("oxygen"));

const isBvmPanel = (panel: PanelState) =>
  matchPanel(panel, (value) => value.includes("bvm") || value.includes("bag"));

const isFluidsPanel = (panel: PanelState) =>
  matchPanel(panel, (value) => value.includes("iv") || value.includes("fluid"));

const isPressorPanel = (panel: PanelState) =>
  matchPanel(panel, (value) => value.includes("norepi") || value.includes("pressor"));

const formatUpdatedTime = (lastUpdatedMs: number) =>
  new Date(lastUpdatedMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function Panels({ panel, onClose }: PanelsProps) {
  const { state, config, dispatch } = usePatientEngine();
  const { vitals, devices, lastUpdatedMs, interventions } = state;
  const updatedLabel = formatUpdatedTime(lastUpdatedMs);

  if (!panel) {
    return null;
  }

  const bolusDisabled = interventions.bolusCooldownSec > 0;
  const bolusLabel = bolusDisabled
    ? `Bolus ready in ${Math.ceil(interventions.bolusCooldownSec)}s`
    : "Bolus 500 mL";

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
                <span className={devices.ventOn ? "status on" : "status off"}>
                  {devices.ventOn ? "ON" : "OFF"}
                </span>
              </div>
              <button
                type="button"
                className="action toggle"
                onClick={() => dispatch({ type: "SET_VENT", on: !devices.ventOn })}
              >
                ON/OFF
              </button>
              <div className="button-row">
                <button
                  type="button"
                  className={devices.ventOn ? "action active" : "action"}
                  onClick={() => dispatch({ type: "SET_VENT", on: true })}
                >
                  Turn On
                </button>
                <button
                  type="button"
                  className={!devices.ventOn ? "action active" : "action"}
                  onClick={() => dispatch({ type: "SET_VENT", on: false })}
                >
                  Turn Off
                </button>
              </div>
            </div>
          ) : null}
          {isFio2Panel(panel) ? (
            <div className="section">
              <div className="section-title">FiO₂ Control</div>
              <div className="status-row">
                <span>Current</span>
                <span className="value">{Math.round(interventions.fio2 * 100)}%</span>
              </div>
              <input
                type="range"
                min={config.fio2.min}
                max={config.fio2.max}
                step={0.01}
                value={interventions.fio2}
                onChange={(event) =>
                  dispatch({ type: "SET_FIO2", fio2: Number(event.target.value) })
                }
              />
            </div>
          ) : null}
          {isBvmPanel(panel) ? (
            <div className="section">
              <div className="section-title">BVM Rescue</div>
              <p className="helper">Bagging provides an immediate SpO₂ boost that decays.</p>
              <button type="button" className="action" onClick={() => dispatch({ type: "BAG" })}>
                Bag Patient
              </button>
            </div>
          ) : null}
          {isFluidsPanel(panel) ? (
            <div className="section">
              <div className="section-title">IV Fluids</div>
              <p className="helper">Transient MAP rise with partial decay.</p>
              <button
                type="button"
                className={bolusDisabled ? "action disabled" : "action"}
                onClick={() => dispatch({ type: "BOLUS" })}
                disabled={bolusDisabled}
              >
                {bolusLabel}
              </button>
            </div>
          ) : null}
          {isPressorPanel(panel) ? (
            <div className="section">
              <div className="section-title">Norepinephrine</div>
              <div className="status-row">
                <span>Dose</span>
                <span className="value">{Math.round(interventions.pressorDose * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={interventions.pressorDose}
                onChange={(event) =>
                  dispatch({ type: "SET_PRESSOR", dose: Number(event.target.value) })
                }
              />
            </div>
          ) : null}
          {isMonitorPanel(panel) ? (
            <div className="section">
              <div className="section-title">Live Vitals</div>
              <div className="vitals-grid">
                <div className="vital">
                  <span className="label">HR</span>
                  <span className="value">{Math.round(vitals.hrBpm)} bpm</span>
                </div>
                <div className="vital">
                  <span className="label">SpO₂</span>
                  <span className="value">{vitals.spo2Pct.toFixed(1)}%</span>
                </div>
                <div className="vital">
                  <span className="label">Resp</span>
                  <span className="value">{Math.round(vitals.respRpm)} rpm</span>
                </div>
                <div className="vital">
                  <span className="label">MAP</span>
                  <span className="value">{Math.round(vitals.mapMmhg)} mmHg</span>
                </div>
                <div className="vital">
                  <span className="label">Temp</span>
                  <span className="value">{vitals.tempC.toFixed(1)}°C</span>
                </div>
              </div>
              <div className="updated">Updated {updatedLabel}</div>
            </div>
          ) : null}
          {!isVentilatorPanel(panel) &&
          !isMonitorPanel(panel) &&
          !isFio2Panel(panel) &&
          !isBvmPanel(panel) &&
          !isFluidsPanel(panel) &&
          !isPressorPanel(panel) ? (
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
        .action.toggle {
          width: 100%;
          justify-self: stretch;
        }
        .action.active {
          border-color: rgba(59, 130, 246, 0.7);
          background: rgba(59, 130, 246, 0.2);
        }
        .action.disabled {
          opacity: 0.6;
          cursor: not-allowed;
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
        .helper {
          font-size: 12px;
          color: rgba(226, 232, 240, 0.7);
          margin: 0;
        }
        input[type="range"] {
          width: 100%;
        }
      `}</style>
    </div>
  );
}
