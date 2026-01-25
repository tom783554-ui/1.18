"use client";

import TerminalLog from "./TerminalLog";
import VitalsPanel from "./VitalsPanel";
import OrdersPanel from "./OrdersPanel";
import { Rhythm } from "../engine/types";
import type { SimSnapshot } from "../engine/simStore";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const computeStability = (snapshot: SimSnapshot) => {
  const { vitals, state } = snapshot;
  let score = state.score;
  if (vitals.spo2 < 90) {
    score -= 10;
  }
  if (vitals.map < 60) {
    score -= 10;
  }
  if (vitals.rhythm !== Rhythm.NSR) {
    score -= 12;
  }
  return clamp(Math.round(score), 0, 100);
};

type HudProps = {
  snapshot: SimSnapshot;
  onNewRun: () => void;
};

export default function Hud({ snapshot, onNewRun }: HudProps) {
  const stability = computeStability(snapshot);
  const dotColor = stability >= 80 ? "green" : stability >= 50 ? "yellow" : "red";

  return (
    <div className="hud-root">
      <div className="center-score">
        <div className="label">Confidence / Stability</div>
        <div className="value">{stability}%</div>
      </div>
      <div className={`status-dot ${dotColor}`} />
      <TerminalLog log={snapshot.log} alerts={snapshot.state.alerts} />
      <VitalsPanel vitals={snapshot.vitals} />
      <OrdersPanel labs={snapshot.labs} imaging={snapshot.imaging} />
      <div className="hud-top">
        <div className="scenario">
          <div className="title">Code Blue</div>
          <div className="subtitle">{snapshot.state.diagnosisId}</div>
          <div className="phase">Phase: {snapshot.state.phase}</div>
        </div>
        <button type="button" className="new-run" onClick={onNewRun}>
          New Run
        </button>
      </div>
      <style jsx>{`
        .hud-root {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 5;
          color: #f8fafc;
          font-family: "Inter", system-ui, sans-serif;
        }
        .center-score {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          padding: 12px 16px;
          border-radius: 16px;
          background: rgba(8, 12, 18, 0.55);
          border: 1px solid rgba(148, 163, 184, 0.2);
          backdrop-filter: blur(10px);
        }
        .center-score .label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: rgba(226, 232, 240, 0.6);
        }
        .center-score .value {
          font-size: 44px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .status-dot {
          position: absolute;
          top: 16px;
          left: 16px;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          border: 2px solid rgba(15, 23, 42, 0.8);
          box-shadow: 0 0 12px rgba(15, 23, 42, 0.5);
        }
        .status-dot.green {
          background: #22c55e;
        }
        .status-dot.yellow {
          background: #fbbf24;
        }
        .status-dot.red {
          background: #ef4444;
        }
        .hud-top {
          position: absolute;
          top: 12px;
          right: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          pointer-events: auto;
          z-index: 10;
        }
        .scenario {
          text-align: right;
          background: rgba(8, 12, 18, 0.7);
          border: 1px solid rgba(148, 163, 184, 0.2);
          padding: 8px 10px;
          border-radius: 10px;
        }
        .scenario .title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: rgba(226, 232, 240, 0.6);
        }
        .scenario .subtitle {
          font-size: 13px;
          font-weight: 600;
        }
        .scenario .phase {
          font-size: 11px;
          color: rgba(226, 232, 240, 0.7);
        }
        .new-run {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 12px;
          border-radius: 10px;
          cursor: pointer;
        }
        .new-run:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        @media (max-width: 900px) {
          .center-score {
            top: 52%;
          }
          .center-score .value {
            font-size: 36px;
          }
          .hud-top {
            right: 12px;
          }
        }
      `}</style>
    </div>
  );
}
