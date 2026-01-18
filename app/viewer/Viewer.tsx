"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Scene, Vector3 } from "@babylonjs/core";
import { useSearchParams } from "next/navigation";
import { createEngine } from "./engine/createEngine";
import { createScene } from "./scene/createScene";
import { loadMainGlb } from "./load/loadMainGlb";
import Hud from "./ui/Hud";
import LoadingOverlay from "./ui/LoadingOverlay";

const DEFAULT_GLB = "/assets/main/main.glb";

export default function Viewer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ReturnType<typeof createEngine> | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraResetRef = useRef({
    alpha: Math.PI / 2,
    beta: Math.PI / 3,
    radius: 12,
    target: new Vector3(0, 1.2, 0)
  });
  const freezeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState("Idle");
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [missingMain, setMissingMain] = useState(false);
  const [currentGlb, setCurrentGlb] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("Copy Share Link");

  const searchParams = useSearchParams();
  const glbParam = useMemo(() => searchParams.get("glb"), [searchParams]);

  const resolveGlbUrl = useCallback(() => {
    if (glbParam) {
      return glbParam;
    }
    const envUrl = process.env.NEXT_PUBLIC_MAIN_GLB_URL?.trim();
    if (envUrl) {
      return envUrl;
    }
    return DEFAULT_GLB;
  }, [glbParam]);

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
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }
    const camera = scene.activeCamera;
    if (!camera || !("setTarget" in camera)) {
      return;
    }
    camera.alpha = cameraResetRef.current.alpha;
    camera.beta = cameraResetRef.current.beta;
    camera.radius = cameraResetRef.current.radius;
    camera.setTarget(cameraResetRef.current.target.clone());
  }, []);

  const copyShareLink = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    if (glbParam) {
      url.searchParams.set("glb", glbParam);
    } else {
      url.searchParams.delete("glb");
    }
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus("Copy Share Link"), 1500);
    } catch {
      setCopyStatus("Copy failed");
      setTimeout(() => setCopyStatus("Copy Share Link"), 2000);
    }
  }, [glbParam]);

  const loadGlb = useCallback(
    async (scene: Scene, url: string) => {
      setStatus("Loading");
      setProgress(0);
      setIsReady(false);
      setHasError(false);

      try {
        await loadMainGlb(scene, url, ({ status: nextStatus, progress: pct }) => {
          setStatus(nextStatus);
          setProgress(pct);
        });
        setStatus("Scene ready");
        setProgress(100);
        setIsReady(true);
        setCurrentGlb(url);
        setMissingMain(false);
        scheduleFreeze(scene);
      } catch (error) {
        console.error("Failed to load GLB", error);
        setStatus("Failed to load");
        setProgress(0);
        setHasError(true);
        setIsReady(false);
        setMissingMain(true);
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

    const glbUrl = resolveGlbUrl();
    loadGlb(scene, glbUrl);

    return () => {
      detachInteraction();
      window.removeEventListener("resize", handleResize);
      if (freezeTimeoutRef.current) {
        clearTimeout(freezeTimeoutRef.current);
      }
      scene.dispose();
      engine.dispose();
    };
  }, [attachInteractionListeners, loadGlb, resolveGlbUrl]);

  const handleFilePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !sceneRef.current) {
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setCurrentGlb(objectUrl);
    setMissingMain(false);
    await loadGlb(sceneRef.current, objectUrl);
    URL.revokeObjectURL(objectUrl);
  };

  return (
    <div className="viewer">
      <canvas ref={canvasRef} className="canvas" />
      <LoadingOverlay
        status={status}
        progress={progress}
        isReady={isReady}
        hasError={hasError}
      />
      {missingMain && (
        <div className="banner">
          Missing main.glb. Add it to /public/assets/main or pick a local file.
        </div>
      )}
      <div className="controls">
        <button type="button" onClick={resetCamera}>
          Reset Camera
        </button>
        <button type="button" onClick={copyShareLink}>
          {copyStatus}
        </button>
        <label className="file">
          Load Local GLB
          <input type="file" accept=".glb" onChange={handleFilePick} />
        </label>
      </div>
      <Hud engine={engineRef.current} scene={sceneRef.current} />
      <div className="status">
        <div>Source: {currentGlb ?? "None"}</div>
      </div>
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
        button,
        .file {
          background: rgba(30, 30, 30, 0.8);
          color: #f5f5f5;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          padding: 8px 12px;
          cursor: pointer;
          font-size: 13px;
        }
        button:hover,
        .file:hover {
          border-color: rgba(255, 255, 255, 0.4);
        }
        .file input {
          display: none;
        }
        .banner {
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(180, 60, 60, 0.9);
          padding: 10px 16px;
          border-radius: 8px;
          z-index: 6;
          font-size: 13px;
        }
        .status {
          position: absolute;
          bottom: 20px;
          right: 20px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          z-index: 5;
        }
      `}</style>
    </div>
  );
}
