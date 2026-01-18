"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArcRotateCamera, Scene, Vector3 } from "@babylonjs/core";
import { createEngine } from "./engine/createEngine";
import { createScene } from "./scene/createScene";
import { loadMainGlb } from "./load/loadMainGlb";
import Hud from "./ui/Hud";
import ErrorOverlay from "./ui/ErrorOverlay";

const DEFAULT_GLB = "/assets/main/main.glb";

type ViewerError = { message: string; stack?: string };

export default function Viewer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ReturnType<typeof createEngine> | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const cameraResetRef = useRef({
    alpha: Math.PI / 2,
    beta: Math.PI / 3,
    radius: 12,
    target: new Vector3(0, 1.2, 0)
  });
  const freezeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<ViewerError | null>(null);
  const [currentGlb, setCurrentGlb] = useState(DEFAULT_GLB);
  const [reloadToken, setReloadToken] = useState(0);

  const scheduleFreeze = useCallback((scene: Scene) => {
    if (freezeTimeoutRef.current) {
      clearTimeout(freezeTimeoutRef.current);
    }
    freezeTimeoutRef.current = setTimeout(() => {
      if (scene.isReady()) {
        scene.freezeActiveMeshes();
      }
    }, 2000);
  }, []);

  const unfreeze = useCallback((scene: Scene) => {
    scene.unfreezeActiveMeshes();
    scheduleFreeze(scene);
  }, [scheduleFreeze]);

  const attachInteractionListeners = useCallback((scene: Scene, canvas: HTMLCanvasElement) => {
    const handleInteraction = () => unfreeze(scene);
    canvas.addEventListener("pointerdown", handleInteraction);
    canvas.addEventListener("pointermove", handleInteraction);
    canvas.addEventListener("wheel", handleInteraction, { passive: true });
    window.addEventListener("keydown", handleInteraction);

    return () => {
      canvas.removeEventListener("pointerdown", handleInteraction);
      canvas.removeEventListener("pointermove", handleInteraction);
      canvas.removeEventListener("wheel", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, [unfreeze]);

  const resetCamera = useCallback(() => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }
    camera.alpha = cameraResetRef.current.alpha;
    camera.beta = cameraResetRef.current.beta;
    camera.radius = cameraResetRef.current.radius;
    camera.setTarget(cameraResetRef.current.target.clone());
  }, []);

  const loadGlb = useCallback(
    async (scene: Scene, url: string) => {
      setIsReady(false);
      setError(null);

      try {
        await loadMainGlb(scene, url);
        setIsReady(true);
        setCurrentGlb(url);
        scheduleFreeze(scene);
      } catch (error) {
        console.error("Failed to load GLB", error);
        const err = error instanceof Error ? error : new Error("Unknown error");
        setError({ message: err.message, stack: err.stack });
        setIsReady(false);
      }
    },
    [scheduleFreeze]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const engine = createEngine(canvas);
    engineRef.current = engine;

    const scene = new Scene(engine);
    const { camera } = createScene(scene);
    camera.attachControl(canvas, true);
    sceneRef.current = scene;
    cameraRef.current = camera;
    cameraResetRef.current = {
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: camera.target.clone()
    };

    engine.runRenderLoop(() => {
      scene.render();
    });

    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);
    const detachInteraction = attachInteractionListeners(scene, canvas);

    const glbUrl = DEFAULT_GLB;
    setCurrentGlb(glbUrl);
    loadGlb(scene, glbUrl);

    const handleError = (event: ErrorEvent) => {
      const err = event.error instanceof Error ? event.error : new Error(event.message);
      setError({ message: err.message, stack: err.stack });
      setIsReady(false);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const err =
        event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      setError({ message: err.message, stack: err.stack });
      setIsReady(false);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      detachInteraction();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      if (freezeTimeoutRef.current) {
        clearTimeout(freezeTimeoutRef.current);
      }
      scene.dispose();
      engine.dispose();
    };
  }, [attachInteractionListeners, loadGlb, reloadToken]);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsReady(false);
    setReloadToken((prev) => prev + 1);
  }, []);

  const statusLabel = error
    ? "ERROR"
    : isReady
      ? `Loaded: ${currentGlb.split("/").pop() ?? "main.glb"}`
      : "Loading...";

  return (
    <div className="viewer">
      <canvas ref={canvasRef} className="canvas" />
      <div className="controls">
        <button type="button" onClick={resetCamera}>
          Reset Camera
        </button>
      </div>
      <Hud
        engine={engineRef.current}
        scene={sceneRef.current}
        status={statusLabel}
        error={error}
      />
      {error ? <ErrorOverlay error={error} onRetry={handleRetry} /> : null}
      <style jsx>{`
        .viewer {
          position: relative;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: #2b2b2b;
        }
        .canvas {
          width: 100%;
          height: 100%;
          display: block;
        }
        .controls {
          position: absolute;
          bottom: 20px;
          left: 20px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          z-index: 5;
        }
        button {
          background: rgba(30, 30, 30, 0.8);
          color: #f5f5f5;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 13px;
        }
        button:hover {
          border-color: rgba(255, 255, 255, 0.4);
        }
      `}</style>
    </div>
  );
}
