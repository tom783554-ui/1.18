"use client";

import { useEffect, useState } from "react";
import type { Engine, Scene } from "@babylonjs/core";

type HudProps = {
  engine: Engine | null;
  scene: Scene | null;
  status: string;
  error: { message: string; stack?: string } | null;
};

export default function Hud({ engine, scene, status, error }: HudProps) {
  const [fps, setFps] = useState(0);
  const [meshes, setMeshes] = useState(0);
  const [triangles, setTriangles] = useState(0);

  useEffect(() => {
    if (!engine || !scene) {
      return;
    }

    let rafId = 0;
    const update = () => {
      setFps(Math.round(engine.getFps()));
      setMeshes(scene.meshes.length);
      const indices = scene.getActiveIndices();
      setTriangles(Math.round((indices ?? 0) / 3));
      rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [engine, scene]);

  return (
    <div className="hud">
      <div className={`status ${error ? "error" : ""}`}>{status}</div>
      {error ? (
        <>
          <div className="message">{error.message}</div>
          {error.stack ? <pre className="stack">{error.stack}</pre> : null}
        </>
      ) : (
        <>
          <div>FPS: {fps}</div>
          <div>Meshes: {meshes}</div>
          <div>Triangles: {triangles}</div>
        </>
      )}
      <style jsx>{`
        .hud {
          position: absolute;
          top: 16px;
          right: 16px;
          background: rgba(20, 20, 20, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 13px;
          display: grid;
          gap: 4px;
          z-index: 5;
        }
        .status {
          font-weight: 600;
          color: #facc15;
        }
        .status.error {
          color: #fca5a5;
        }
        .message {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.85);
          word-break: break-word;
        }
        .stack {
          margin: 6px 0 0;
          font-size: 11px;
          line-height: 1.4;
          background: rgba(0, 0, 0, 0.35);
          padding: 8px;
          border-radius: 6px;
          white-space: pre-wrap;
          color: rgba(248, 250, 252, 0.75);
        }
      `}</style>
    </div>
  );
}
