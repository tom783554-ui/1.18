"use client";

import { useEffect, useState } from "react";
import type { Engine, Scene } from "@babylonjs/core";

type HudProps = {
  engine: Engine | null;
  scene: Scene | null;
};

export default function Hud({ engine, scene }: HudProps) {
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
      <div>FPS: {fps}</div>
      <div>Meshes: {meshes}</div>
      <div>Triangles: {triangles}</div>
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
      `}</style>
    </div>
  );
}
