"use client";

type PanelState = { title: string; id: string } | null;

type PanelsProps = {
  panel: PanelState;
  onClose: () => void;
};

export default function Panels({ panel, onClose }: PanelsProps) {
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
          <div className="hint">Tap another label to switch. Tap empty space to deselect.</div>
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
          width: min(92vw, 420px);
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
        }
        .hint {
          font-size: 12px;
          color: rgba(248, 250, 252, 0.74);
          line-height: 1.35;
        }
      `}</style>
    </div>
  );
}
