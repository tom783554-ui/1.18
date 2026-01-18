"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArcRotateCamera,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  SceneLoader,
  Vector3
} from "@babylonjs/core";
import "@babylonjs/loaders";

const GLB_URL = "/assets/main/main.glb";

type Metrics = {
  fps: number;
  meshes: number;
};

export default function Viewer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [status, setStatus] = useState("Booting...");
  const [metrics, setMetrics] = useState<Metrics>({ fps: 0, meshes: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    setStatus("Booting...");

    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true
    });
    engineRef.current = engine;
    setStatus("Engine initialized");

    const scene = new Scene(engine);
    sceneRef.current = scene;
    setStatus("Scene created");

    const camera = new ArcRotateCamera(
      "camera",
      Math.PI / 2,
      Math.PI / 3,
      8,
      new Vector3(0, 1, 0),
      scene
    );
    camera.attachControl(canvas, true);

    new HemisphericLight("hemi-light", new Vector3(0, 1, 0), scene);

    const cube = MeshBuilder.CreateBox("debug-cube", { size: 1 }, scene);
    cube.position = new Vector3(0, 1, 0);
    setStatus("Render loop running (cube visible)");

    engine.runRenderLoop(() => {
      scene.render();
      setMetrics({
        fps: Math.round(engine.getFps()),
        meshes: scene.meshes.length
      });
    });

    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);

    setStatus("Loading GLB...");
    SceneLoader.ImportMeshAsync(null, "", GLB_URL, scene)
      .then((result) => {
        const loadedMeshes = result.meshes.filter((mesh) => mesh.name !== "__root__");
        console.log(
          "GLB loaded",
          loadedMeshes.length,
          loadedMeshes.map((mesh) => mesh.name)
        );
        setStatus(`GLB loaded ✅ meshes=${loadedMeshes.length}`);

        if (loadedMeshes.length > 0) {
          let min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
          let max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

          loadedMeshes.forEach((mesh) => {
            const bounds = mesh.getHierarchyBoundingVectors(true);
            min = Vector3.Minimize(min, bounds.min);
            max = Vector3.Maximize(max, bounds.max);
          });

          const center = min.add(max).scale(0.5);
          const radius = Math.max(Vector3.Distance(min, max) * 0.75, 3);
          camera.setTarget(center);
          camera.radius = radius;
        }
      })
      .catch((error) => {
        console.error("GLB load failed", error);
        setStatus("GLB load failed ❌ (see console)");
      });

    return () => {
      window.removeEventListener("resize", handleResize);
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <div className="viewer">
      <canvas ref={canvasRef} className="canvas" />
      <div className="overlay">
        <div className="overlay-title">Babylon Viewer</div>
        <div className="overlay-row">Status: {status}</div>
        <div className="overlay-row">FPS: {metrics.fps}</div>
        <div className="overlay-row">Meshes: {metrics.meshes}</div>
      </div>
      <style jsx>{`
        .viewer {
          position: relative;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: #111;
        }
        .canvas {
          width: 100vw;
          height: 100vh;
          display: block;
          touch-action: none;
        }
        .overlay {
          position: absolute;
          top: 16px;
          left: 16px;
          background: rgba(0, 0, 0, 0.6);
          color: #fff;
          padding: 12px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          z-index: 10;
          max-width: 280px;
        }
        .overlay-title {
          font-weight: 600;
          margin-bottom: 6px;
        }
        .overlay-row {
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
