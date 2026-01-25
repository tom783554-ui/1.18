"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSyncExternalStore } from "react";
import {
  getHotspotProjection,
  subscribeHotspotProjection
} from "../interactions/hotspotProjectionStore";
import { useEngineState } from "../../../src/engine/useEngineState";
import { AlertSeverity } from "../../../src/engine/patientState";
import { TOAST_EVENT } from "../../../src/engine/toast";

type HudProps = {
  placeholderCount?: number;
};

const formatElapsed = (tSec: number) => {
  const total = Math.max(0, Math.floor(tSec));
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export default function Hud({ placeholderCount }: HudProps) {
  const engineState = useEngineState();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const [lastToast, setLastToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const alertAnchorRef = useRef<HTMLDivElement | null>(null);

  const projection = useSyncExternalStore(
    subscribeHotspotProjection,
    getHotspotProjection,
    getHotspotProjection
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      const element = alertAnchorRef.current;
      if (element) {
        const rect = element.getBoundingClientRect();
        setAnchor({ x: rect.right, y: rect.top + rect.height / 2 });
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    let timer: number | null = null;
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ message?: string }>;
      if (!custom.detail?.message) {
        return;
      }
      setLastToast(custom.detail.message);
      setToastVisible(true);
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => {
        setToastVisible(false);
      }, 2000);
    };
    window.addEventListener(TOAST_EVENT, handler as EventListener);
    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      window.removeEventListener(TOAST_EVENT, handler as EventListener);
    };
  }, []);

  useLayoutEffect(() => {
    const element = alertAnchorRef.current;
    if (!element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    setAnchor({ x: rect.right, y: rect.top + rect.height / 2 });
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      setAnchor({ x: rect.right, y: rect.top + rect.height / 2 });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const alerts = useMemo(() => {
    return engineState.alerts.map((alert) => {
      const tone =
        alert.severity === AlertSeverity.CRITICAL
          ? "critical"
          : alert.severity === AlertSeverity.WARNING
            ? "warn"
            : "info";
      return { ...alert, tone };
    });
  }, [engineState.alerts]);

  const objectives = useMemo(() => engineState.objectives, [engineState.objectives]);

  const openMonitorPanel = () => {
    if (typeof window === "undefined") {
      return;
    }
    window.dispatchEvent(
      new CustomEvent("m3d:panel", { detail: { open: true, title: "Monitor", id: "monitor" } })
    );
  };

  const hasSelection = Boolean(projection.id && projection.visible);
  const clampedX = clamp(projection.x, 0, viewport.width);
  const clampedY = clamp(projection.y, 0, viewport.height);

  return (
    <div className="hud-root">
      <div className={`hud-toast ${toastVisible ? "show" : ""}`} role="status" aria-live="polite">
        {lastToast}
      </div>
      <div className="hud-top">
        <div className="hud-scenario">
          <div className="scenario-label">Scenario</div>
          <div className="scenario-name">Ventilation Sync</div>
        </div>
        <div className="hud-topbar">
          <div className="metric">
            <span>HR</span>
            <strong>{Math.round(engineState.hr)}</strong>
          </div>
          <div className="metric">
            <span>MAP</span>
            <strong>{Math.round(engineState.map)}</strong>
          </div>
          <div className="metric">
            <span>SpO₂</span>
            <strong>{engineState.spo2.toFixed(1)}</strong>
          </div>
          <div className="metric">
            <span>RR</span>
            <strong>{Math.round(engineState.rr)}</strong>
          </div>
        </div>
        <div className="hud-time">
          <div className="elapsed-label">Elapsed</div>
          <div className="elapsed">{formatElapsed(engineState.timeSec)}</div>
        </div>
      </div>

      <div className="hud-side">
        <div className="alerts" ref={alertAnchorRef}>
          <div className="section-title">Alerts</div>
          <div
            className="pill-stack"
            role="button"
            tabIndex={0}
            onClick={openMonitorPanel}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openMonitorPanel();
              }
            }}
          >
            {alerts.map((alert) => (
              <span key={alert.id} className={`pill ${alert.tone}`}>
                {alert.label}
              </span>
            ))}
            <span className="pill action">Open monitor</span>
          </div>
        </div>
        <div className="objectives">
          <div className="section-title">Objectives</div>
          <ul>
            {objectives.map((objective) => (
              <li key={objective.id} className={objective.done ? "done" : ""}>
                <span className="checkbox" aria-hidden="true">
                  {objective.done ? "✓" : "○"}
                </span>
                <span>{objective.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="hud-footer">
        <div className="status-chip">
          <span className="label">Vent</span>
          <span className={engineState.ventOn ? "value on" : "value off"}>
            {engineState.ventOn ? "ON" : "OFF"}
          </span>
        </div>
        <div className="status-chip">
          <span className="label">Placeholders</span>
          <span className="value">{placeholderCount ?? 0}</span>
        </div>
      </div>

      <svg className="callout" aria-hidden="true">
        {hasSelection && (
          <>
            <line x1={anchor.x} y1={anchor.y} x2={clampedX} y2={clampedY} />
            <circle cx={clampedX} cy={clampedY} r="5" />
          </>
        )}
      </svg>

      <style jsx>{`
        .hud-root {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 8;
          color: #f8fafc;
          font-family: "Inter", "SF Pro Text", system-ui, -apple-system, sans-serif;
        }
        .hud-top {
          position: absolute;
          top: 16px;
          left: 16px;
          right: 16px;
          display: grid;
          grid-template-columns: minmax(200px, 1fr) auto minmax(120px, 1fr);
          gap: 12px;
          align-items: center;
          background: rgba(8, 10, 16, 0.75);
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 14px;
          padding: 10px 14px;
          backdrop-filter: blur(10px);
        }
        .hud-toast {
          position: absolute;
          top: 72px;
          left: 50%;
          transform: translateX(-50%);
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(148, 163, 184, 0.35);
          color: #f8fafc;
          opacity: 0;
          transition: opacity 0.2s ease;
          pointer-events: none;
        }
        .hud-toast.show {
          opacity: 1;
        }
        .hud-scenario {
          display: grid;
          gap: 2px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 10px;
          color: rgba(226, 232, 240, 0.7);
        }
        .scenario-name {
          color: #f8fafc;
          font-weight: 600;
          letter-spacing: 0.08em;
        }
        .hud-topbar {
          display: grid;
          grid-auto-flow: column;
          gap: 16px;
          justify-content: center;
        }
        .metric {
          display: grid;
          justify-items: center;
          gap: 2px;
          font-size: 11px;
          color: rgba(226, 232, 240, 0.8);
        }
        .metric strong {
          font-size: 16px;
          color: #f8fafc;
        }
        .hud-time {
          justify-self: end;
          text-align: right;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-size: 10px;
          color: rgba(226, 232, 240, 0.7);
        }
        .elapsed {
          font-size: 14px;
          font-weight: 600;
          color: #f8fafc;
        }
        .hud-side {
          position: absolute;
          top: 88px;
          right: 16px;
          display: grid;
          gap: 12px;
          width: 240px;
        }
        .alerts,
        .objectives {
          background: rgba(12, 16, 24, 0.78);
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 12px;
          padding: 10px 12px;
          pointer-events: auto;
        }
        .section-title {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: rgba(226, 232, 240, 0.6);
          margin-bottom: 8px;
        }
        .pill-stack {
          display: grid;
          gap: 6px;
          cursor: pointer;
        }
        .pill {
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          background: rgba(148, 163, 184, 0.12);
          border: 1px solid rgba(148, 163, 184, 0.25);
          color: rgba(226, 232, 240, 0.8);
        }
        .pill.critical {
          border-color: rgba(248, 113, 113, 0.8);
          color: #fee2e2;
          background: rgba(127, 29, 29, 0.35);
          animation: criticalPulse 1.2s ease-in-out infinite;
        }
        .pill.warn {
          border-color: rgba(251, 191, 36, 0.6);
          color: #fde68a;
        }
        .pill.info {
          border-color: rgba(56, 189, 248, 0.45);
          color: #bae6fd;
        }
        .pill.action {
          border-style: dashed;
          color: rgba(248, 250, 252, 0.75);
        }
        .objectives ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 8px;
          font-size: 12px;
          color: rgba(226, 232, 240, 0.85);
        }
        .objectives li {
          display: grid;
          grid-template-columns: 18px 1fr;
          gap: 8px;
          align-items: center;
        }
        .objectives li.done {
          color: rgba(134, 239, 172, 0.9);
        }
        .checkbox {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.4);
          font-size: 11px;
        }
        .objectives li.done .checkbox {
          border-color: rgba(134, 239, 172, 0.8);
          color: rgba(134, 239, 172, 0.9);
          animation: objectivePop 0.4s ease;
        }
        .hud-footer {
          position: absolute;
          left: 16px;
          bottom: 16px;
          display: flex;
          gap: 10px;
        }
        .status-chip {
          display: grid;
          gap: 2px;
          background: rgba(8, 10, 16, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(226, 232, 240, 0.7);
        }
        .status-chip .value {
          font-size: 12px;
          letter-spacing: 0.08em;
          color: #f8fafc;
        }
        .status-chip .value.on {
          color: #86efac;
        }
        .status-chip .value.off {
          color: #fca5a5;
        }
        .callout {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 6;
        }
        .callout line {
          stroke: rgba(56, 189, 248, 0.85);
          stroke-width: 2;
        }
        .callout circle {
          fill: rgba(56, 189, 248, 0.9);
          stroke: rgba(14, 116, 144, 0.9);
          stroke-width: 2;
        }
        @media (max-width: 900px) {
          .hud-top {
            grid-template-columns: 1fr;
            gap: 8px;
            text-align: center;
          }
          .hud-time {
            justify-self: center;
          }
          .hud-side {
            right: 12px;
            width: 210px;
          }
        }
        @keyframes criticalPulse {
          0%,
          100% {
            box-shadow: 0 0 0 rgba(248, 113, 113, 0);
          }
          50% {
            box-shadow: 0 0 10px rgba(248, 113, 113, 0.6);
          }
        }
        @keyframes objectivePop {
          0% {
            transform: scale(0.8);
          }
          70% {
            transform: scale(1.15);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
