"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Engine, Scene } from "@babylonjs/core";
import { emitPanelOpen } from "../interactions/panelEvents";
import { onScenarioVitals, type ScenarioVitals } from "../scenario/scenarioEngine";
import { getHotspotProjection, subscribeHotspotProjection } from "../utils/hotspotScreenSync";

type HudProps = {
  engine: Engine | null;
  scene: Scene | null;
};

const formatElapsed = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function Hud({ engine, scene }: HudProps) {
  const [vitals, setVitals] = useState<ScenarioVitals | null>(null);
  const [elapsed, setElapsed] = useState("00:00");
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const projection = useSyncExternalStore(subscribeHotspotProjection, getHotspotProjection, getHotspotProjection);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => onScenarioVitals((nextVitals) => setVitals(nextVitals)), []);

  useEffect(() => {
    if (!engine || !scene) {
      return;
    }
    const updateViewport = () => {
      setViewport({
        width: engine.getRenderWidth(),
        height: engine.getRenderHeight()
      });
    };
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, [engine, scene]);

  useEffect(() => {
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }
    const interval = window.setInterval(() => {
      if (!startTimeRef.current) {
        return;
      }
      const seconds = (Date.now() - startTimeRef.current) / 1000;
      setElapsed(formatElapsed(seconds));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useLayoutEffect(() => {
    if (!anchorRef.current || typeof window === "undefined") {
      return;
    }
    const updateAnchor = () => {
      if (!anchorRef.current) {
        return;
      }
      const rect = anchorRef.current.getBoundingClientRect();
      setAnchor({ x: rect.right, y: rect.top + rect.height / 2 });
    };
    updateAnchor();
    const resizeObserver = new ResizeObserver(updateAnchor);
    resizeObserver.observe(anchorRef.current);
    window.addEventListener("resize", updateAnchor);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateAnchor);
    };
  }, []);

  const map = vitals ? Math.round((vitals.bpSys + vitals.bpDia * 2) / 3) : null;

  const alerts = useMemo(() => {
    if (!vitals) {
      return [{ id: "sync", label: "Vitals syncing", tone: "info" }];
    }
    const list: Array<{ id: string; label: string; tone: "warning" | "critical" | "info" }> = [];
    if (vitals.spo2 < 94) {
      list.push({ id: "spo2", label: `Low SpO₂ ${vitals.spo2}%`, tone: "critical" });
    }
    if (map !== null && map < 65) {
      list.push({ id: "map", label: `MAP ${map} < 65`, tone: "warning" });
    }
    if (vitals.hr > 100) {
      list.push({ id: "hr", label: `HR ${vitals.hr} elevated`, tone: "warning" });
    }
    if (vitals.rr > 22) {
      list.push({ id: "rr", label: `RR ${vitals.rr} high`, tone: "warning" });
    }
    if (list.length === 0) {
      list.push({ id: "stable", label: "Vitals stable", tone: "info" });
    }
    return list;
  }, [map, vitals]);

  const objectives = useMemo(
    () => [
      { id: "spo2", label: "Keep SpO₂ ≥ 94%", done: vitals ? vitals.spo2 >= 94 : false },
      { id: "map", label: "Maintain MAP ≥ 65", done: map !== null ? map >= 65 : false },
      { id: "rr", label: "RR between 12-20", done: vitals ? vitals.rr >= 12 && vitals.rr <= 20 : false },
      { id: "temp", label: "Temp < 37.5°C", done: vitals ? vitals.temp < 37.5 : false }
    ],
    [map, vitals]
  );

  const calloutEnd = useMemo(() => {
    if (!projection.visible || !viewport.width || !viewport.height) {
      return null;
    }
    return {
      x: clamp(projection.x, 12, viewport.width - 12),
      y: clamp(projection.y, 12, viewport.height - 12)
    };
  }, [projection, viewport]);

  const showCallout = Boolean(anchor && calloutEnd);

  return (
    <div className="hud-root">
      <div className="hud-topbar" role="status" aria-live="polite">
        <div className="hud-vitals">
          <div className="vital-pill">
            <span>HR</span>
            <strong>{vitals?.hr ?? "--"}</strong>
          </div>
          <div className="vital-pill">
            <span>MAP</span>
            <strong>{map ?? "--"}</strong>
          </div>
          <div className="vital-pill">
            <span>SpO₂</span>
            <strong>{vitals?.spo2 ?? "--"}</strong>
          </div>
          <div className="vital-pill">
            <span>RR</span>
            <strong>{vitals?.rr ?? "--"}</strong>
          </div>
        </div>
        <div className="hud-scenario">
          <div className="scenario-label">Scenario · ICU Vent Drill</div>
          <div className="scenario-time">Elapsed {elapsed}</div>
        </div>
      </div>

      <div className="hud-stack">
        <div className="hud-card hud-alerts" ref={anchorRef}>
          <div className="card-title">Alerts</div>
          <div className="alert-list">
            {alerts.map((alert) => (
              <button
                type="button"
                key={alert.id}
                className={`alert-pill ${alert.tone}`}
                onClick={() => emitPanelOpen("Monitor", "monitor")}
              >
                {alert.label}
              </button>
            ))}
          </div>
        </div>
        <div className="hud-card hud-objectives">
          <div className="card-title">Objectives</div>
          <div className="objective-list">
            {objectives.map((objective) => (
              <div
                key={objective.id}
                className={objective.done ? "objective done" : "objective"}
                aria-live="polite"
              >
                <span className="checkbox">{objective.done ? "✓" : "○"}</span>
                <span>{objective.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <svg className="hud-callout" aria-hidden="true">
        {showCallout && anchor && calloutEnd ? (
          <>
            <line x1={anchor.x} y1={anchor.y} x2={calloutEnd.x} y2={calloutEnd.y} />
            <circle cx={calloutEnd.x} cy={calloutEnd.y} r="4" />
          </>
        ) : null}
      </svg>

      <style jsx>{`
        .hud-root {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 8;
          font-family: "Inter", system-ui, sans-serif;
        }
        .hud-topbar {
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(8, 12, 20, 0.72);
          border: 1px solid rgba(148, 163, 184, 0.2);
          color: #f8fafc;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4);
        }
        .hud-vitals {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .vital-pill {
          display: grid;
          gap: 2px;
          text-transform: uppercase;
          font-size: 10px;
          letter-spacing: 0.08em;
          color: #94a3b8;
        }
        .vital-pill strong {
          font-size: 13px;
          color: #f8fafc;
          letter-spacing: 0.02em;
        }
        .hud-scenario {
          display: grid;
          gap: 2px;
          text-align: right;
          font-size: 11px;
          color: #cbd5f5;
        }
        .scenario-label {
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 10px;
        }
        .scenario-time {
          font-variant-numeric: tabular-nums;
          color: #e2e8f0;
        }
        .hud-stack {
          position: absolute;
          top: 64px;
          left: 16px;
          display: grid;
          gap: 12px;
          width: min(260px, 40vw);
        }
        .hud-card {
          background: rgba(8, 10, 18, 0.78);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 14px;
          padding: 10px 12px;
          color: #f8fafc;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
        }
        .card-title {
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 10px;
          color: #94a3b8;
          margin-bottom: 8px;
        }
        .alert-list {
          display: grid;
          gap: 6px;
        }
        .alert-pill {
          pointer-events: auto;
          border: 1px solid rgba(248, 250, 252, 0.18);
          background: rgba(30, 41, 59, 0.55);
          color: #f8fafc;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          text-align: left;
          cursor: pointer;
        }
        .alert-pill.warning {
          border-color: rgba(251, 191, 36, 0.6);
          color: #fef3c7;
        }
        .alert-pill.critical {
          border-color: rgba(248, 113, 113, 0.8);
          color: #fee2e2;
        }
        .alert-pill.info {
          border-color: rgba(125, 211, 252, 0.6);
          color: #e0f2fe;
        }
        .objective-list {
          display: grid;
          gap: 6px;
          font-size: 12px;
        }
        .objective {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #e2e8f0;
        }
        .objective.done {
          color: #4ade80;
        }
        .checkbox {
          font-size: 12px;
          width: 18px;
        }
        .hud-callout {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .hud-callout line {
          stroke: rgba(148, 163, 184, 0.85);
          stroke-width: 1.5;
        }
        .hud-callout circle {
          fill: rgba(56, 189, 248, 0.85);
          stroke: rgba(15, 23, 42, 0.6);
          stroke-width: 1.5;
        }
        @media (max-width: 700px) {
          .hud-topbar {
            flex-direction: column;
            gap: 8px;
            padding: 8px 12px;
          }
          .hud-stack {
            width: min(220px, 60vw);
          }
        }
      `}</style>
    </div>
  );
}
