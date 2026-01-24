"use client";

type PanelState = { title: string; id: string } | null;

type VitalsState = {
  heartRate: number;
  spo2: number;
  respRate: number;
  systolic: number;
  diastolic: number;
  temperature: number;
  updatedAt: string;
};

type PanelsProps = {
  panel: PanelState;
  onClose: () => void;
  ventilatorOn: boolean;
  onVentilatorToggle: (nextState: boolean) => void;
  vitals: VitalsState;
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

export default function Panels({ panel, onClose, ventilatorOn, onVentilatorToggle, vitals }: PanelsProps) {
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
                <span className={ventilatorOn ? "status on" : "status off"}>
                  {ventilatorOn ? "ON" : "OFF"}
                </span>
              </div>
              <div className="button-row">
                <button
                  type="button"
                  className={ventilatorOn ? "action active" : "action"}
                  onClick={() => onVentilatorToggle(true)}
                >
                  Turn On
                </button>
                <button
                  type="button"
                  className={!ventilatorOn ? "action active" : "action"}
                  onClick={() => onVentilatorToggle(false)}
                >
                  Turn Off
                </button>
              </div>
            </div>
          ) : null}
          {isMonitorPanel(panel) ? (
            <div className="section">
              <div className="section-title">Live Vitals</div>
              <div className="vitals-grid">
                <div className="vital">
                  <span className="label">HR</span>
                  <span className="value">{vitals.heartRate} bpm</span>
                </div>
                <div className="vital">
                  <span className="label">SpO₂</span>
                  <span className="value">{vitals.spo2}%</span>
                </div>
                <div className="vital">
                  <span className="label">Resp</span>
                  <span className="value">{vitals.respRate} rpm</span>
                </div>
                <div className="vital">
                  <span className="label">BP</span>
                  <span className="value">
                    {vitals.systolic}/{vitals.diastolic} mmHg
                  </span>
                </div>
                <div className="vital">
                  <span className="label">Temp</span>
                  <span className="value">{vitals.temperature.toFixed(1)}°C</span>
                </div>
              </div>
              <div className="updated">Updated {vitals.updatedAt}</div>
            </div>
          ) : null}
          {!isVentilatorPanel(panel) && !isMonitorPanel(panel) ? (
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
