"use client";

import { type ArcRotateCamera, type Engine, type Scene, Vector3, VertexBuffer } from "@babylonjs/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createEngine } from "./engine/createEngine";
import { createScene, type ControlState as SceneControlState } from "./scene/createScene";
import { DEFAULT_GLB_PATH, loadMainGlb, type LoadProgress } from "./load/loadMainGlb";
import Hud from "./ui/Hud";
import LoadingOverlay from "./ui/LoadingOverlay";
import ControlsOverlay, { type ControlState as OverlayControlState } from "../../src/components/ControlsOverlay";

const READY_FLASH_MS = 900;
const IDLE_FREEZE_MS = 2000;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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

const findGreenDoorCenter = (scene: Scene, bounds: { min: Vector3; max: Vector3 }) => {
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestCenter: Vector3 | null = null;
  const extentX = bounds.max.x - bounds.min.x;
  const extentZ = bounds.max.z - bounds.min.z;
  const edgeScale = Math.max(extentX, extentZ);

  for (const mesh of scene.meshes) {
    if (!mesh.isEnabled() || mesh.name === "camera" || mesh.name === "hemi") {
      continue;
    }
    const colors = mesh.getVerticesData(VertexBuffer.ColorKind);
    if (!colors || colors.length < 3) {
      continue;
    }

    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let i = 0; i < colors.length; i += 4) {
      r += colors[i];
      g += colors[i + 1];
      b += colors[i + 2];
      count += 1;
    }
    if (!count) {
      continue;
    }
    r /= count;
    g /= count;
    b /= count;
    const greenScore = g - (r + b) / 2;
    if (greenScore <= 0) {
      continue;
    }
    const boundsInfo = mesh.getBoundingInfo?.().boundingBox;
    if (!boundsInfo) {
      continue;
    }
    const center = boundsInfo.minimumWorld.add(boundsInfo.maximumWorld).scale(0.5);
    const distToEdgeX = Math.min(Math.abs(center.x - bounds.min.x), Math.abs(bounds.max.x - center.x));
    const distToEdgeZ = Math.min(Math.abs(center.z - bounds.min.z), Math.abs(bounds.max.z - center.z));
    const minEdgeDist = Math.min(distToEdgeX, distToEdgeZ);
    const boundaryScore = edgeScale > 0 ? 1 - Math.min(minEdgeDist / edgeScale, 1) : 0;
    const nameBonus = mesh.name.toLowerCase().includes("door") ? 0.5 : 0;
    const combinedScore = greenScore + boundaryScore * 0.4 + nameBonus;
    if (combinedScore <= bestScore) {
      continue;
    }
    bestScore = combinedScore;
    bestCenter = center.clone();
  }

  return bestCenter;
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
  const setControlStateRef = useRef<((state: SceneControlState) => void) | null>(null);
  const resetControlsRef = useRef<(() => void) | null>(null);
  const overlayStateRef = useRef<OverlayControlState>({
    panVec: { x: 0, y: 0 },
    rotVec: { x: 0, y: 0 },
    zoomIn: false,
    zoomOut: false,
    speed: 1
  });
  const keyboardStateRef = useRef({
    panVec: { x: 0, y: 0 },
    rotVec: { x: 0, y: 0 },
    zoomIn: false,
    zoomOut: false
  });
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const [resetSignal, setResetSignal] = useState(0);

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

  const updateCombinedControls = useCallback(() => {
    const overlay = overlayStateRef.current;
    const keyboard = keyboardStateRef.current;
    const combined: SceneControlState = {
      panVec: {
        x: clamp(overlay.panVec.x + keyboard.panVec.x, -1, 1),
        y: clamp(overlay.panVec.y + keyboard.panVec.y, -1, 1)
      },
      rotVec: {
        x: clamp(overlay.rotVec.x + keyboard.rotVec.x, -1, 1),
        y: clamp(overlay.rotVec.y + keyboard.rotVec.y, -1, 1)
      },
      zoomIn: overlay.zoomIn || keyboard.zoomIn,
      zoomOut: overlay.zoomOut || keyboard.zoomOut,
      speed: overlay.speed
    };
    setControlStateRef.current?.(combined);
  }, []);

  const handleOverlayControls = useCallback(
    (state: OverlayControlState) => {
      overlayStateRef.current = state;
      updateCombinedControls();
    },
    [updateCombinedControls]
  );

  const handleReset = useCallback(() => {
    resetCamera();
    resetControlsRef.current?.();
    overlayStateRef.current = {
      panVec: { x: 0, y: 0 },
      rotVec: { x: 0, y: 0 },
      zoomIn: false,
      zoomOut: false,
      speed: overlayStateRef.current.speed
    };
    keyboardStateRef.current = {
      panVec: { x: 0, y: 0 },
      rotVec: { x: 0, y: 0 },
      zoomIn: false,
      zoomOut: false
    };
    pressedKeysRef.current.clear();
    updateCombinedControls();
    setResetSignal((value) => value + 1);
    markInteraction();
  }, [markInteraction, resetCamera, updateCombinedControls]);

  const frameScene = useCallback(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) {
      return;
    }

    let min: Vector3 | null = null;
    let max: Vector3 | null = null;

    const meshes = scene.meshes;

    for (const mesh of meshes) {
      if (mesh.name === "camera" || mesh.name === "hemi" || !mesh.isEnabled()) {
        continue;
      }
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
    const baseRadius = max.subtract(center).length();
    const paddedRadius = baseRadius * 2.6;
    const lowerRadius = camera.lowerRadiusLimit ?? 0;
    const upperRadius = camera.upperRadiusLimit ?? Number.POSITIVE_INFINITY;
    const targetRadius = Math.max(paddedRadius, lowerRadius || camera.radius);
    const clampedRadius = Math.min(upperRadius, Math.max(lowerRadius, targetRadius));

    const targetAlpha = -Math.PI / 2;
    const targetBeta = Math.PI / 2.4;
    const lowerBeta = camera.lowerBetaLimit ?? 0.01;
    const upperBeta = camera.upperBetaLimit ?? Math.PI - 0.01;

    const greenDoorCenter = findGreenDoorCenter(scene, { min, max });
    if (greenDoorCenter) {
      const direction = greenDoorCenter.subtract(center);
      const horizontal = Math.hypot(direction.x, direction.z);
      const distance = Math.hypot(horizontal, direction.y);
      if (horizontal > 0.01 && distance > 0.01) {
        const desiredBeta = Math.acos(direction.y / distance);
        const clampedBeta = Math.min(upperBeta, Math.max(lowerBeta, desiredBeta));
        const sinBeta = Math.sin(clampedBeta);
        const desiredRadius = sinBeta > 0.001 ? horizontal / sinBeta : clampedRadius;
        const doorRadius = desiredRadius * 1.05;
        const clampedDoorRadius = Math.min(upperRadius, Math.max(lowerRadius, doorRadius));
        camera.alpha = Math.atan2(direction.z, direction.x);
        camera.beta = clampedBeta;
        camera.radius = clampedDoorRadius;
        camera.setTarget(center);
        cameraDefaults.current = {
          alpha: camera.alpha,
          beta: camera.beta,
          radius: camera.radius,
          target: [center.x, center.y, center.z]
        };
        return;
      }
    }

    camera.alpha = targetAlpha;
    camera.beta = Math.min(upperBeta, Math.max(lowerBeta, targetBeta));
    camera.radius = clampedRadius;
    camera.setTarget(center);

    cameraDefaults.current = {
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: [center.x, center.y, center.z]
    };
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

    const { scene, camera, setControlState, resetControls } = createScene(engine, canvas);
    sceneRef.current = scene;
    cameraRef.current = camera;
    setControlStateRef.current = setControlState;
    resetControlsRef.current = resetControls;
    updateCombinedControls();

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
    const controlKeySet = new Set([
      "w",
      "a",
      "s",
      "d",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "+",
      "=",
      "-",
      "_"
    ]);

    const updateKeyboardState = () => {
      const keys = pressedKeysRef.current;
      const panY = (keys.has("w") ? 1 : 0) + (keys.has("s") ? -1 : 0);
      const panX = (keys.has("d") ? 1 : 0) + (keys.has("a") ? -1 : 0);
      const rotY = (keys.has("ArrowUp") ? -1 : 0) + (keys.has("ArrowDown") ? 1 : 0);
      const rotX = (keys.has("ArrowRight") ? 1 : 0) + (keys.has("ArrowLeft") ? -1 : 0);
      const zoomIn = keys.has("+") || keys.has("=");
      const zoomOut = keys.has("-") || keys.has("_");
      keyboardStateRef.current = {
        panVec: { x: clamp(panX, -1, 1), y: clamp(panY, -1, 1) },
        rotVec: { x: clamp(rotX, -1, 1), y: clamp(rotY, -1, 1) },
        zoomIn,
        zoomOut
      };
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!controlKeySet.has(event.key)) {
        return;
      }
      event.preventDefault();
      pressedKeysRef.current.add(event.key);
      updateKeyboardState();
      updateCombinedControls();
      markInteraction();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!controlKeySet.has(event.key)) {
        return;
      }
      event.preventDefault();
      pressedKeysRef.current.delete(event.key);
      updateKeyboardState();
      updateCombinedControls();
    };

    const handleBlur = () => {
      pressedKeysRef.current.clear();
      updateKeyboardState();
      updateCombinedControls();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
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
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("resize", handleResize);
      cleanupScalingRef.current?.();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    };
  }, [loadScene, markInteraction, updateCombinedControls]);

  return (
    <div className="viewer">
      <canvas ref={canvasRef} className="canvas" />
      <Hud engine={engineRef.current} scene={sceneRef.current} />
      <ControlsOverlay
        onControlChange={handleOverlayControls}
        onReset={handleReset}
        onShare={copyShareLink}
        onInteraction={markInteraction}
        resetSignal={resetSignal}
      />
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
      `}</style>
    </div>
  );
}
