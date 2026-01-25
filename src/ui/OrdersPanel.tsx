"use client";

import type { ImagingFlags, Labs } from "../engine/types";

const formatLab = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : "--");

type OrdersPanelProps = {
  labs: Labs;
  imaging: ImagingFlags;
};

export default function OrdersPanel({ labs, imaging }: OrdersPanelProps) {
  return (
    <div className="orders-panel">
      <div className="title">Orders</div>
      <div className="section">
        <div className="label">Labs</div>
        <div className="row">ABG pH {formatLab(labs.abg.ph)} / PaO₂ {Math.round(labs.abg.po2)}</div>
        <div className="row">CBC Hgb {labs.cbc.hgb.toFixed(1)} / WBC {labs.cbc.wbc.toFixed(1)}</div>
        <div className="row">Trop {formatLab(labs.trop)}</div>
      </div>
      <div className="section">
        <div className="label">Imaging</div>
        <div className="row">CXR: {imaging.cxrOrdered ? imaging.cxrResult ?? "Pending" : "Not ordered"}</div>
        <div className="row">FAST: {imaging.usFastOrdered ? imaging.usFastResult ?? "Pending" : "Not ordered"}</div>
      </div>
      <style jsx>{`
        .orders-panel {
          position: absolute;
          bottom: 16px;
          right: 16px;
          width: 260px;
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
        .section {
          display: grid;
          gap: 4px;
          font-size: 11px;
          color: rgba(226, 232, 240, 0.78);
          margin-bottom: 8px;
        }
        .label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(148, 163, 184, 0.7);
        }
        .row {
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
