"use client";

import type { Vitals } from "../engine/types";

const formatBp = (sbp: number, dbp: number) => `${Math.round(sbp)}/${Math.round(dbp)}`;

type VitalsPanelProps = {
  vitals: Vitals;
};

export default function VitalsPanel({ vitals }: VitalsPanelProps) {
  return (
    <div className="vitals-panel">
      <div className="title">Vitals</div>
      <div className="grid">
        <div className="item">
          <span>HR</span>
          <strong>{Math.round(vitals.hr)}</strong>
        </div>
        <div className="item">
          <span>RR</span>
          <strong>{Math.round(vitals.rr)}</strong>
        </div>
        <div className="item">
          <span>SpO₂</span>
          <strong>{vitals.spo2.toFixed(1)}%</strong>
        </div>
        <div className="item">
          <span>BP</span>
          <strong>{formatBp(vitals.sbp, vitals.dbp)}</strong>
        </div>
        <div className="item">
          <span>MAP</span>
          <strong>{Math.round(vitals.map)}</strong>
        </div>
        <div className="item">
          <span>FiO₂</span>
          <strong>{Math.round(vitals.fio2 * 100)}%</strong>
        </div>
        <div className="item">
          <span>PEEP</span>
          <strong>{Math.round(vitals.peep)}</strong>
        </div>
        <div className="item">
          <span>Rhythm</span>
          <strong>{vitals.rhythm}</strong>
        </div>
        <div className="item">
          <span>EtCO₂</span>
          <strong>{Math.round(vitals.etco2)}</strong>
        </div>
      </div>
      <style jsx>{`
        .vitals-panel {
          position: absolute;
          top: 88px;
          right: 16px;
          width: 220px;
          padding: 12px;
          background: rgba(8, 12, 18, 0.82);
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 12px;
          z-index: 6;
          pointer-events: none;
          color: #f8fafc;
          font-family: "Inter", system-ui, sans-serif;
        }
        .title {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: rgba(226, 232, 240, 0.6);
          margin-bottom: 8px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px 10px;
        }
        .item {
          display: grid;
          gap: 2px;
          font-size: 11px;
          color: rgba(226, 232, 240, 0.75);
        }
        .item strong {
          font-size: 14px;
          color: #f8fafc;
        }
      `}</style>
    </div>
  );
}
