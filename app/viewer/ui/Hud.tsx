"use client";

import { useEffect, useMemo, useState } from "react";
import type { Engine, Scene } from "@babylonjs/core";
import { onPick, type M3DPickDetail } from "../interactions/m3dEvents";
import { onHotspotRegistry, type M3DHotspotRegistry } from "../interactions/hotspotRegistryEvents";
import { onScenarioVitals, type ScenarioVitals } from "../scenario/scenarioEngine";

type HudProps = {
  engine: Engine | null;
  scene: Scene | null;
  placeholderCount?: number;
};

const updateIntervalMs = 400;

export default function Hud({ engine, scene, placeholderCount }: HudProps) {
  const [fps, setFps] = useState(0);
  const [meshes, setMeshes] = useState(0);
  const [triangles, setTriangles] = useState(0);
  const [lastPick, setLastPick] = useState<M3DPickDetail | null>(null);
  const [registry, setRegistry] = useState<M3DHotspotRegistry | null>(null);
  const [vitals, setVitals] = useState<ScenarioVitals | null>(null);

  useEffect(() => onPick((detail) => setLastPick(detail)), []);
  useEffect(() => onHotspotRegistry((newRegistry) => setRegistry(newRegistry)), []);
  useEffect(() => onScenarioVitals((nextVitals) => setVitals(nextVitals)), []);

  useEffect(() => {
    if (!engine || !scene) {
      return;
    }

    const update = () => {
      setFps(Math.round(engine.getFps()));
      setMeshes(scene.meshes.length);
      const vertices = scene.getTotalVertices();
      setTriangles(Math.round(vertices / 3));
    };

    update();
    const interval = setInterval(update, updateIntervalMs);
    return () => clearInterval(interval);
  }, [engine, scene]);

  const registryJson = useMemo(() => (registry ? JSON.stringify(registry, null, 2) : ""), [registry]);

  const copyRegistry = async () => {
    if (!registryJson) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(registryJson);
        return;
      }
      throw new Error("clipboard unavailable");
    } catch {
      window.prompt("Copy hotspot registry JSON", registryJson);
    }
  };

  const downloadRegistry = () => {
    if (!registryJson) return;
    try {
      const blob = new Blob([registryJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "hotspots.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      window.prompt("Download hotspot registry JSON", registryJson);
    }
  };

  const hotspotsCount = registry?.count ?? 0;
  const bp = vitals ? `${vitals.bpSys}/${vitals.bpDia}` : "--";

  return (
    <div className="hud-root">
      <div className="hud">
        <div>FPS: {fps}</div>
        <div>Meshes: {meshes}</div>
        <div>Triangles: {triangles}</div>
        <div>Placeholders: {placeholderCount ?? 0}</div>
        <div>Last: {lastPick ? `${lastPick.prefix}${lastPick.id}` : "—"}</div>
        <div className="hotspot-row">
          <span>Hotspots: {hotspotsCount}</span>
          <div className="hotspot-actions">
            <button type="button" onClick={copyRegistry} disabled={!registryJson}>
              Copy
            </button>
            <button type="button" onClick={downloadRegistry} disabled={!registryJson}>
              Download
            </button>
          </div>
        </div>
      </div>
      <div className="vitals" role="status" aria-live="polite">
        <div className="vitals-title">Scenario Vitals</div>
        <div className="vitals-grid">
          <div className="vital">
            <span>HR</span>
            <strong>{vitals?.hr ?? "--"}</strong>
            <em>bpm</em>
          </div>
          <div className="vital">
            <span>BP</span>
            <strong>{bp}</strong>
            <em>mmHg</em>
          </div>
          <div className="vital">
            <span>SpO2</span>
            <strong>{vitals?.spo2 ?? "--"}</strong>
            <em>%</em>
          </div>
          <div className="vital">
            <span>RR</span>
            <strong>{vitals?.rr ?? "--"}</strong>
            <em>/min</em>
          </div>
          <div className="vital">
            <span>Temp</span>
            <strong>{vitals ? vitals.temp.toFixed(1) : "--"}</strong>
            <em>°C</em>
          </div>
          <div className="vital">
            <span>FiO2</span>
            <strong>{vitals ? vitals.fio2.toFixed(2) : "--"}</strong>
          </div>
          <div className="vital">
            <span>PEEP</span>
            <strong>{vitals ? vitals.peep.toFixed(1) : "--"}</strong>
            <em>cmH₂O</em>
          </div>
          <div className="vital">
            <span>Mode</span>
            <strong>{vitals?.mode ?? "--"}</strong>
          </div>
        </div>
      </div>
      <style jsx>{`
        .hud-root {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 5;
        }
        .hud {
          position: absolute;
          top: 12px;
          right: 12px;
          background: rgba(20, 20, 20, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 12px;
          display: grid;
          gap: 4px;
          color: #f8fafc;
          pointer-events: auto;
        }
        .hotspot-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .hotspot-actions {
          display: flex;
          gap: 6px;
        }
        .hotspot-actions button {
          background: rgba(148, 163, 184, 0.15);
          border: 1px solid rgba(148, 163, 184, 0.3);
          color: #e2e8f0;
          border-radius: 6px;
          padding: 2px 8px;
          font-size: 11px;
          cursor: pointer;
        }
        .hotspot-actions button:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .vitals {
          position: absolute;
          left: 12px;
          bottom: 12px;
          background: rgba(12, 16, 24, 0.78);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 10px;
          padding: 10px 12px;
          color: #f8fafc;
          min-width: 240px;
          pointer-events: none;
        }
        .vitals-title {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #cbd5f5;
          margin-bottom: 8px;
        }
        .vitals-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px 16px;
          font-size: 12px;
        }
        .vital {
          display: grid;
          gap: 2px;
        }
        .vital span {
          color: #94a3b8;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .vital strong {
          font-size: 14px;
        }
        .vital em {
          font-style: normal;
          font-size: 10px;
          color: #94a3b8;
        }
        @media (max-width: 600px) {
          .hud {
            font-size: 11px;
          }
          .vitals {
            min-width: 200px;
          }
          .vitals-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px 12px;
          }
        }
      `}</style>
    </div>
  );
}
