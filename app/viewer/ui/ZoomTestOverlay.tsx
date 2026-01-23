"use client";

import { useEffect, useRef, useState } from "react";
import type { ArcRotateCamera, Scene } from "@babylonjs/core";

type ZoomTestOverlayProps = {
  scene: Scene | null;
  camera: ArcRotateCamera | null;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  onResetLimits: () => void;
  onNormalize: () => void;
};

type DebugState = {
  radius: number;
  minZ: number;
  alpha: number;
  beta: number;
  target: string;
};

const updateIntervalMs = 100;

const formatNumber = (value: number) => value.toFixed(3);

export default function ZoomTestOverlay({
  scene,
  camera,
  onZoomIn,
  onZoomOut,
  onRecenter,
  onResetLimits,
  onNormalize
}: ZoomTestOverlayProps) {
  const [debug, setDebug] = useState<DebugState | null>(null);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (!scene || !camera) {
      return undefined;
    }

    const update = () => {
      const now = performance.now();
      if (now - lastUpdateRef.current < updateIntervalMs) {
        return;
      }
      lastUpdateRef.current = now;
      const target = camera.target;
      setDebug({
        radius: camera.radius,
        minZ: camera.minZ,
        alpha: camera.alpha,
        beta: camera.beta,
        target: `${formatNumber(target.x)}, ${formatNumber(target.y)}, ${formatNumber(target.z)}`
      });
    };

    update();
    const observer = scene.onBeforeRenderObservable.add(update);
    return () => {
      scene.onBeforeRenderObservable.remove(observer);
    };
  }, [camera, scene]);

  return (
    <div className="zoom-panel" role="region" aria-label="Zoom test panel">
      <div className="zoom-header">Zoom Test</div>
      <div className="zoom-buttons">
        <button type="button" onClick={onZoomIn}>
          Zoom+
        </button>
        <button type="button" onClick={onZoomOut}>
          Zoom-
        </button>
        <button type="button" onClick={onRecenter}>
          Recenter
        </button>
        <button type="button" onClick={onResetLimits}>
          Reset Limits
        </button>
        <button type="button" onClick={onNormalize}>
          Normalize GLB
        </button>
      </div>
      <div className="zoom-debug">
        <div>
          <strong>radius</strong>: {debug ? formatNumber(debug.radius) : "--"}
        </div>
        <div>
          <strong>minZ</strong>: {debug ? formatNumber(debug.minZ) : "--"}
        </div>
        <div>
          <strong>target</strong>: {debug ? debug.target : "--"}
        </div>
        <div>
          <strong>beta</strong>: {debug ? formatNumber(debug.beta) : "--"}
        </div>
        <div>
          <strong>alpha</strong>: {debug ? formatNumber(debug.alpha) : "--"}
        </div>
      </div>
      <style jsx>{`
        .zoom-panel {
          position: absolute;
          left: 12px;
          bottom: 12px;
          background: rgba(12, 12, 12, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          padding: 10px;
          display: grid;
          gap: 8px;
          color: #f8fafc;
          font-size: 12px;
          z-index: 8;
          min-width: min(280px, 86vw);
        }
        .zoom-header {
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 11px;
          color: rgba(248, 250, 252, 0.8);
        }
        .zoom-buttons {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
        }
        .zoom-buttons button {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 8px;
          border-radius: 8px;
          cursor: pointer;
        }
        .zoom-buttons button:hover {
          background: rgba(255, 255, 255, 0.16);
        }
        .zoom-debug {
          display: grid;
          gap: 2px;
          font-family: "SFMono-Regular", ui-monospace, SFMono-Regular, Menlo, Monaco,
            Consolas, "Liberation Mono", "Courier New", monospace;
        }
        .zoom-debug strong {
          font-weight: 600;
          color: rgba(248, 250, 252, 0.9);
        }
      `}</style>
    </div>
  );
}
