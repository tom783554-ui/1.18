"use client";

import { useEffect, useState } from "react";
import type { Engine, Scene } from "@babylonjs/core";

type HudProps = {
  engine: Engine | null;
  scene: Scene | null;
};

const updateIntervalMs = 400;

export default function Hud({ engine, scene }: HudProps) {
  const [fps, setFps] = useState(0);
  const [meshes, setMeshes] = useState(0);
  const [triangles, setTriangles] = useState(0);

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

  return (
    <div className="hud">
      <div>FPS: {fps}</div>
      <div>Meshes: {meshes}</div>
      <div>Triangles: {triangles}</div>
      <style jsx>{`
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
          z-index: 5;
          color: #f8fafc;
        }
      `}</style>
    </div>
  );
}
