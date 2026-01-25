"use client";

import type { ActionEvent } from "../engine/types";

const formatTime = (tMs: number) => `t=${(tMs / 1000).toFixed(1)}s`;

type TerminalLogProps = {
  log: ActionEvent[];
  alerts: string[];
};

export default function TerminalLog({ log, alerts }: TerminalLogProps) {
  const entries = [
    ...alerts.map((line) => ({ kind: "ALERT", line })),
    ...log.map((entry) => ({
      kind: "ACTION",
      line: `${formatTime(entry.tMs)} ACTION: ${entry.kind}`
    }))
  ];

  return (
    <div className="terminal-log">
      <div className="terminal-title">Live Log</div>
      <div className="terminal-body">
        {entries.slice(-40).map((entry, index) => (
          <div key={`${entry.kind}-${index}`} className={`line ${entry.kind.toLowerCase()}`}>
            {entry.line}
          </div>
        ))}
      </div>
      <style jsx>{`
        .terminal-log {
          position: absolute;
          inset: 0;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 16px;
          font-family: "SFMono-Regular", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", "Courier New", monospace;
          color: rgba(226, 232, 240, 0.88);
          z-index: 3;
        }
        .terminal-title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: rgba(148, 163, 184, 0.7);
          margin-bottom: 6px;
        }
        .terminal-body {
          max-height: 36vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 4px;
          background: rgba(5, 8, 12, 0.35);
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          backdrop-filter: blur(10px);
        }
        .line {
          font-size: 11px;
          line-height: 1.45;
          text-shadow: 0 0 12px rgba(15, 23, 42, 0.8);
        }
        .line.alert {
          color: rgba(251, 191, 36, 0.9);
        }
      `}</style>
    </div>
  );
}
