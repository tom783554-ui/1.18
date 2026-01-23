"use client";

import {
  Color3,
  PBRMaterial,
  type AbstractMesh,
  type ArcRotateCamera,
  type Engine,
  type Scene,
  Vector3
} from "@babylonjs/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createEngine } from "./engine/createEngine";
import { createScene } from "./scene/createScene";
import { DEFAULT_GLB_PATH, loadMainGlb, type LoadProgress } from "./load/loadMainGlb";
import Hud from "./ui/Hud";
import LoadingOverlay from "./ui/LoadingOverlay";

const READY_FLASH_MS = 900;
const IDLE_FREEZE_MS = 2000;
const MAX_SCENE_DIMENSION = 20;
const TARGET_SCENE_SIZE = 6;
const isRenderableMesh = (mesh: AbstractMesh) => mesh.getTotalVertices?.() > 0 && mesh.isEnabled();
const isValidHttpsUrl = (value: string | null) => {
  if (!value) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
};

const formatShareUrl = (glbUrl: string | null) => {
  if (typeof window === "undefined") {
    return "";
  }
  const base = `${window.location.origin}${window.location.pathname}`;
  if (glbUrl) {
    const share = new URL(base);
    share.searchParams.set("glb", glbUrl);
    return share.toString();
  }
  return base;
};

export default function Viewer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const cameraDefaults = useRef<{ alpha: number; beta: number; radius: number; target: [number, number, number] } | null>(
    null
  );
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const cleanupScalingRef = useRef<(() => void) | undefined>();

  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [missingMain, setMissingMain] = useState(false);
  const [missingMainDetails, setMissingMainDetails] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; details?: string } | null>(null);
  const [shareGlbParam, setShareGlbParam] = useState<string | null>(null);

  const shareUrl = useMemo(() => formatShareUrl(shareGlbParam), [shareGlbParam]);

  const clearIdleTimer = () => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  };

  const armIdleFreeze = useCallback(() => {
    clearIdleTimer();
    idleTimer.current = setTimeout(() => {
      sceneRef.current?.freezeActiveMeshes();
    }, IDLE_FREEZE_MS);
  }, []);

  const markInteraction = useCallback(() => {
    sceneRef.current?.unfreezeActiveMeshes();
    armIdleFreeze();
  }, [armIdleFreeze]);

  const flashReady = () => {
    setIsReady(true);
    setTimeout(() => setIsReady(false), READY_FLASH_MS);
  };

  const resetCamera = useCallback(() => {
    const camera = cameraRef.current;
    const defaults = cameraDefaults.current;
    if (!camera || !defaults) {
      return;
    }
    camera.alpha = defaults.alpha;
    camera.beta = defaults.beta;
    camera.radius = defaults.radius;
    camera.setTarget(new Vector3(defaults.target[0], defaults.target[1], defaults.target[2]));
  }, []);

  const handleReset = useCallback(() => {
    resetCamera();
    markInteraction();
  }, [markInteraction, resetCamera]);

  const frameScene = useCallback(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) {
      return;
    }

    let min: Vector3 | null = null;
    let max: Vector3 | null = null;

    const meshes = scene.meshes.filter((mesh) => isRenderableMesh(mesh));

    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true);
      const bi = mesh.getBoundingInfo?.();
      if (!bi) {
        continue;
      }
      const bb = bi.boundingBox;
      const vmin = bb.minimumWorld;
      const vmax = bb.maximumWorld;

      min = min ? Vector3.Minimize(min, vmin) : vmin.clone();
      max = max ? Vector3.Maximize(max, vmax) : vmax.clone();
    }

    if (!min || !max) {
      return;
    }

    const center = min.add(max).scale(0.5);
    const rootMesh = scene.getMeshByName("root");
    const rootCenter = rootMesh?.getBoundingInfo?.().boundingBox.centerWorld;
    const target = rootCenter ?? center;
    camera.setTarget(target);

    cameraDefaults.current = {
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: [target.x, target.y, target.z]
    };
  }, []);

  const normalizeScene = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }

    let min: Vector3 | null = null;
    let max: Vector3 | null = null;
    const meshes = scene.meshes.filter((mesh) => isRenderableMesh(mesh));

    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true);
      const bounds = mesh.getBoundingInfo?.();
      if (!bounds) {
        continue;
      }
      const bb = bounds.boundingBox;
      min = min ? Vector3.Minimize(min, bb.minimumWorld) : bb.minimumWorld.clone();
      max = max ? Vector3.Maximize(max, bb.maximumWorld) : bb.maximumWorld.clone();
    }

    if (!min || !max) {
      return;
    }

    const size = max.subtract(min);
    const maxDimension = Math.max(size.x, size.y, size.z);
    const rootMesh =
      scene.getMeshByName("root") ?? meshes[0] ?? scene.meshes[0] ?? null;

    if (rootMesh && maxDimension > MAX_SCENE_DIMENSION) {
      const scaleFactor = TARGET_SCENE_SIZE / maxDimension;
      rootMesh.scaling = rootMesh.scaling.scale(scaleFactor);
      rootMesh.computeWorldMatrix(true);
      rootMesh.freezeWorldMatrix();
    }

    for (const mesh of meshes) {
      const name = mesh.name.toLowerCase();
      let material = mesh.material;
      if (!material || !(material instanceof PBRMaterial)) {
        material = new PBRMaterial(`${mesh.name}-pbr`, scene);
        material.albedoColor = new Color3(0.9, 0.9, 0.9);
        material.roughness = 0.6;
        material.metallic = 0.0;
        mesh.material = material;
      }

      if (material instanceof PBRMaterial) {
        if (name.includes("bed")) {
          material.albedoColor = new Color3(0.85, 0.85, 0.88);
        } else if (name.includes("wall") || name.includes("floor")) {
          material.albedoColor = new Color3(0.75, 0.75, 0.75);
        }
      }
    }

    scene.freezeActiveMeshes();
  }, []);

  const copyShareLink = useCallback(async () => {
    if (!shareUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      window.prompt("Copy share link", shareUrl);
    }
  }, [shareUrl]);

  const loadScene = useCallback(
    async (url: string, isDefault: boolean, shareParam?: string | null) => {
      const scene = sceneRef.current;
      if (!scene) {
        return;
      }

      setIsLoading(true);
      setMissingMain(false);
      setMissingMainDetails(null);
      setError(null);
      setProgress(null);

      scene.meshes.slice().forEach((mesh) => {
        if (mesh.name !== "camera" && mesh.name !== "hemi") {
          mesh.dispose(false, true);
        }
      });

      try {
        await loadMainGlb(scene, url, (update) => setProgress({ ...update }));
        await scene.whenReadyAsync();
        normalizeScene();
        frameScene();
        setShareGlbParam(isDefault ? null : shareParam ?? null);
        setIsLoading(false);
        flashReady();
        armIdleFreeze();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (isDefault) {
          setMissingMain(true);
          setMissingMainDetails(`Missing default GLB at ${url}. ${message}`);
          setIsLoading(false);
          setError(null);
          return;
        }
        setError({ title: "Failed to load GLB", details: message });
        setIsLoading(false);
      }
    },
    [armIdleFreeze, frameScene]
  );

  const handleFilePick = useCallback(
    (file: File) => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      setShareGlbParam(null);
      void loadScene(objectUrl, false);
    },
    [loadScene]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const { engine, cleanupScaling } = createEngine(canvas);
    engineRef.current = engine;
    cleanupScalingRef.current = cleanupScaling;

    const { scene, camera } = createScene(engine, canvas);
    sceneRef.current = scene;
    cameraRef.current = camera;

    cameraDefaults.current = {
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: [camera.target.x, camera.target.y, camera.target.z]
    };

    engine.runRenderLoop(() => {
      scene.render();
    });

    const handleResize = () => {
      engine.resize();
    };

    const eventTarget: EventTarget = canvas;
    const interactionEvents = ["pointerdown", "pointermove", "wheel", "touchstart", "touchmove"];

    interactionEvents.forEach((eventName) => {
      eventTarget.addEventListener(eventName, markInteraction, { passive: true });
    });
    window.addEventListener("resize", handleResize, { passive: true });

    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get("glb");
    const shouldUseRemote = isValidHttpsUrl(urlParam) ? urlParam : null;

    void loadScene(shouldUseRemote ?? DEFAULT_GLB_PATH, !shouldUseRemote, shouldUseRemote);

    return () => {
      clearIdleTimer();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      interactionEvents.forEach((eventName) => {
        eventTarget.removeEventListener(eventName, markInteraction);
      });
      window.removeEventListener("resize", handleResize);
      cleanupScalingRef.current?.();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    };
  }, [loadScene, markInteraction]);

  return (
    <div className="viewer">
      <canvas ref={canvasRef} className="canvas" />
      <Hud engine={engineRef.current} scene={sceneRef.current} />
      <div className="control-bar" role="toolbar" aria-label="Viewer controls">
        <button type="button" onClick={handleReset}>
          Reset
        </button>
        <button type="button" onClick={copyShareLink}>
          Share
        </button>
      </div>
      {missingMain ? (
        <div className="banner" role="status">
          <strong>missing main.glb</strong>
          <span>{missingMainDetails ?? `Missing default GLB at ${DEFAULT_GLB_PATH}.`}</span>
        </div>
      ) : null}
      <LoadingOverlay
        isLoading={isLoading}
        progress={progress}
        isReady={isReady}
        missingMain={missingMain}
        missingMainDetails={missingMainDetails}
        error={error}
        onFilePick={handleFilePick}
      />
      <style jsx>{`
        .viewer {
          position: relative;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: #111;
        }
        .canvas {
          width: 100%;
          height: 100%;
          display: block;
          touch-action: none;
        }
        .banner {
          position: absolute;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(190, 30, 30, 0.92);
          color: #fff;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          z-index: 7;
          max-width: min(92vw, 520px);
          text-align: center;
        }
        .banner span {
          color: rgba(255, 255, 255, 0.9);
          font-weight: 500;
        }
        .control-bar {
          position: absolute;
          top: 12px;
          left: 12px;
          z-index: 8;
          display: inline-flex;
          gap: 8px;
          padding: 6px;
          border-radius: 10px;
          background: rgba(12, 12, 12, 0.65);
          backdrop-filter: blur(6px);
        }
        .control-bar button {
          appearance: none;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          padding: 6px 10px;
          border-radius: 8px;
          cursor: pointer;
        }
        .control-bar button:hover {
          background: rgba(255, 255, 255, 0.16);
        }
      `}</style>
    </div>
  );
}
