"use client";

import {
  Color3,
  Material,
  PBRMaterial,
  type AbstractMesh,
  type ArcRotateCamera,
  type Engine,
  type HighlightLayer,
  type Scene,
  Vector3
} from "@babylonjs/core";
import type { AdvancedDynamicTexture } from "@babylonjs/gui";
import { useCallback, useEffect, useRef, useState } from "react";
import { startEngineLoop, stopEngineLoop } from "../../src/engine/store";
import { createEngine } from "./engine/createEngine";
import { attachHotspotSystem, type HotspotMeshEntry } from "./interactions/hotspotSystem";
import { buildCodeBlueHotspotEntries } from "../../src/sim/codeblue/buildCodeBlueHotspotEntries";
import { expandCompactManifest } from "../../src/sim/codeblue/expandCompactManifest";
import { createScene } from "./scene/createScene";
import { DEFAULT_GLB_PATH, loadMainGlb, type LoadProgress } from "./load/loadMainGlb";
import { getM3dDebugState, setM3dReady } from "./utils/m3dDebug";
import Hud from "./ui/Hud";
import LoadingOverlay from "./ui/LoadingOverlay";
import Panels from "./ui/Panels";

const READY_FLASH_MS = 900;
const IDLE_FREEZE_MS = 2000;
const MAX_SCENE_DIMENSION = 20;
const TARGET_SCENE_SIZE = 6;
const isRenderableMesh = (mesh: AbstractMesh) => mesh.getTotalVertices?.() > 0 && mesh.isEnabled();
const isUtilityMesh = (mesh: AbstractMesh) => {
  const name = mesh.name.toLowerCase();
  return name.includes("sky") || name.includes("skybox") || name.includes("utility");
};
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

export default function Viewer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const uiRef = useRef<AdvancedDynamicTexture | null>(null);
  const highlightLayerRef = useRef<HighlightLayer | null>(null);
  const selectedHotspotRef = useRef<HotspotMeshEntry | null>(null);
  const hotspotSystemRef = useRef<ReturnType<typeof attachHotspotSystem> | null>(null);
  const cameraDefaults = useRef<{ alpha: number; beta: number; radius: number; target: [number, number, number] } | null>(
    null
  );
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const cleanupScalingRef = useRef<(() => void) | undefined>();
  const placeholderCleanupRef = useRef<(() => void) | null>(null);
  const actionRouterCleanupRef = useRef<(() => void) | null>(null);
  const resizeRafRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [missingMain, setMissingMain] = useState(false);
  const [missingMainDetails, setMissingMainDetails] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; details?: string } | null>(null);
  const [placeholderCount, setPlaceholderCount] = useState(0);
  const [panel, setPanel] = useState<{ title: string; id: string } | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{ lastHotspotId: string; lastPickMeshName: string }>({
    lastHotspotId: "none",
    lastPickMeshName: "none"
  });


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

  const clearSelection = useCallback(() => {
    setPanel(null);
    selectedHotspotRef.current = null;
    highlightLayerRef.current?.removeAllMeshes();
  }, []);

  const reframeScene = useCallback(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) {
      return;
    }

    let min: Vector3 | null = null;
    let max: Vector3 | null = null;

    const meshes = scene.meshes.filter(
      (mesh) => isRenderableMesh(mesh) && mesh.isVisible && !isUtilityMesh(mesh)
    );

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
      const nodes = scene.transformNodes.filter((node) => {
        const name = node.name.toLowerCase();
        return name !== "camera" && name !== "hemi";
      });
      for (const node of nodes) {
        const position = node.getAbsolutePosition?.() ?? node.position;
        if (!position) {
          continue;
        }
        min = min ? Vector3.Minimize(min, position) : position.clone();
        max = max ? Vector3.Maximize(max, position) : position.clone();
      }
      if (!min || !max) {
        return;
      }
    }

    const center = min.add(max).scale(0.5);
    camera.setTarget(center);

    const size = max.subtract(min);
    const extents = size.scale(0.5);
    const targetRadius = Math.max(extents.x, extents.y, extents.z) * 2.0;
    const lowerLimit = camera.lowerRadiusLimit ?? 0;
    const upperLimit = camera.upperRadiusLimit ?? targetRadius;
    camera.radius = Math.min(Math.max(targetRadius, lowerLimit), upperLimit);

    cameraDefaults.current = {
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: [center.x, center.y, center.z]
    };
  }, []);

  const removeCeilingAndWall = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) {
      return;
    }
    let wallHidden = false;
    scene.meshes.forEach((mesh) => {
      const name = mesh.name.toLowerCase();
      if (name.includes("ceiling")) {
        mesh.setEnabled(false);
        return;
      }
      if (!wallHidden && name.includes("wall")) {
        mesh.setEnabled(false);
        wallHidden = true;
      }
    });
  }, []);

  const focusCameraAtBed = useCallback(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) {
      return;
    }
    const bedMesh = scene.meshes.find((mesh) => mesh.name.toLowerCase().includes("bed"));
    if (!bedMesh) {
      return;
    }
    bedMesh.computeWorldMatrix(true);
    const bounds = bedMesh.getBoundingInfo?.();
    if (!bounds) {
      return;
    }
    const center = bounds.boundingBox.centerWorld.clone();
    const size = bounds.boundingBox.maximumWorld.subtract(bounds.boundingBox.minimumWorld);
    const length = Math.max(size.x, size.z);
    const height = Math.max(0.6, size.y * 0.6);
    const offset = new Vector3(0, height, -length * 1.4);
    camera.setTarget(center);
    camera.setPosition(center.add(offset));
    cameraDefaults.current = {
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: [camera.target.x, camera.target.y, camera.target.z]
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
      const material = mesh.material as Material | null;
      let pbr: PBRMaterial;
      if (material instanceof PBRMaterial) {
        pbr = material;
      } else {
        pbr = new PBRMaterial(`${mesh.name}-pbr`, scene);
        mesh.material = pbr;
      }

      pbr.albedoColor = new Color3(0.9, 0.9, 0.9);
      pbr.roughness = 0.6;
      pbr.metallic = 0.0;

      if (name.includes("bed")) {
        pbr.albedoColor = new Color3(0.85, 0.85, 0.88);
      } else if (name.includes("wall") || name.includes("floor")) {
        pbr.albedoColor = new Color3(0.75, 0.75, 0.75);
      }
    }

    scene.freezeActiveMeshes();
  }, []);


  const loadScene = useCallback(
    async (url: string, isDefault: boolean) => {
      const scene = sceneRef.current;
      if (!scene) {
        return;
      }

      setM3dReady(false);
      setIsLoading(true);
      setMissingMain(false);
      setMissingMainDetails(null);
      setError(null);
      setProgress(null);

      placeholderCleanupRef.current?.();
      placeholderCleanupRef.current = null;
      const existingRouterCleanup = actionRouterCleanupRef.current as (() => void) | null;
      if (existingRouterCleanup) {
        existingRouterCleanup();
      }
      actionRouterCleanupRef.current = null;
      setPlaceholderCount(0);
      setPanel(null);
      selectedHotspotRef.current = null;
      highlightLayerRef.current?.removeAllMeshes();

      scene.meshes.slice().forEach((mesh) => {
        if (mesh.name !== "camera" && mesh.name !== "hemi") {
          mesh.dispose(false, true);
        }
      });
      scene.transformNodes.slice().forEach((node) => {
        if (node.name !== "camera" && node.name !== "hemi") {
          node.dispose(false, true);
        }
      });

      try {
        await loadMainGlb(scene, url, (update) => setProgress({ ...update }));
        await scene.whenReadyAsync();
        setM3dReady(true);
        removeCeilingAndWall();
        const { wirePlaceholders } = await import("./interactions/placeholders");
        const wired = wirePlaceholders(scene);
        placeholderCleanupRef.current = wired.dispose;
        setPlaceholderCount(wired.count);
        normalizeScene();
        reframeScene();
        const { attachActionRouter } = await import("./interactions/actionRouter");
        const existingRouterCleanup = actionRouterCleanupRef.current as (() => void) | null;
        if (existingRouterCleanup) {
          existingRouterCleanup();
        }
        actionRouterCleanupRef.current = attachActionRouter({
          scene,
          camera: scene.activeCamera
        }) as () => void;
        hotspotSystemRef.current?.refresh();
        reframeScene();
        focusCameraAtBed();
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
    [armIdleFreeze, focusCameraAtBed, normalizeScene, reframeScene, removeCeilingAndWall]
  );

  const handleFilePick = useCallback(
    (file: File) => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      void loadScene(objectUrl, false);
    },
    [loadScene]
  );

  useEffect(() => {
    const handlePanelEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ open: boolean; title: string; id: string }>;
      const detail = customEvent.detail;
      if (!detail) {
        return;
      }
      if (detail.open) {
        setPanel({ title: detail.title, id: detail.id });
        return;
      }
      setPanel(null);
    };
    window.addEventListener("m3d:panel", handlePanelEvent as EventListener);
    return () => window.removeEventListener("m3d:panel", handlePanelEvent as EventListener);
  }, []);

  useEffect(() => {
    startEngineLoop();
    return () => {
      stopEngineLoop();
    };
  }, []);

  useEffect(() => {
    const state = getM3dDebugState();
    if (state) {
      setDebugInfo({
        lastHotspotId: state.lastHotspotId ?? "none",
        lastPickMeshName: state.lastPickMeshName ?? "none"
      });
    }
    const params = new URLSearchParams(window.location.search);
    setDebugEnabled(params.get("debug") === "1");
  }, []);

  useEffect(() => {
    if (!debugEnabled) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      const state = getM3dDebugState();
      if (!state) {
        return;
      }
      setDebugInfo({
        lastHotspotId: state.lastHotspotId ?? "none",
        lastPickMeshName: state.lastPickMeshName ?? "none"
      });
    }, 250);
    return () => window.clearInterval(interval);
  }, [debugEnabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const { engine, cleanupScaling } = createEngine(canvas);
    engineRef.current = engine;
    cleanupScalingRef.current = cleanupScaling;

    const { scene, camera } = createScene(engine, canvas);
    setM3dReady(false);
    sceneRef.current = scene;
    cameraRef.current = camera;

    const { version, nodes } = expandCompactManifest();
    const entries = buildCodeBlueHotspotEntries();
    console.log(`[CodeBlue] compact=${version} expanded=${nodes.length} registered=${entries.length}`);
    if (entries.length < 150) {
      console.warn("[CodeBlue] hotspot registry below expected count", {
        registered: entries.length
      });
    }

    hotspotSystemRef.current = attachHotspotSystem({
      scene,
      camera,
      uiRef,
      highlightLayerRef,
      selectedRef: selectedHotspotRef,
      entries,
      onDeselect: () => {
        resetCamera();
        clearSelection();
      }
    });

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
      if (resizeRafRef.current !== null) {
        return;
      }
      resizeRafRef.current = window.requestAnimationFrame(() => {
        engine.resize();
        resizeRafRef.current = null;
      });
    };

    const eventTarget: EventTarget = canvas;
    const interactionEvents = ["pointerdown", "pointermove", "wheel", "touchstart", "touchmove"];

    interactionEvents.forEach((eventName) => {
      eventTarget.addEventListener(eventName, markInteraction, { passive: true });
    });
    const preventScroll = (event: TouchEvent) => {
      event.preventDefault();
    };
    canvas.addEventListener("touchstart", preventScroll, { passive: false });
    canvas.addEventListener("touchmove", preventScroll, { passive: false });
    canvas.addEventListener("touchend", preventScroll, { passive: false });
    window.addEventListener("resize", handleResize, { passive: true });

    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get("glb");
    const shouldUseRemote = isValidHttpsUrl(urlParam) ? urlParam : null;

    void loadScene(shouldUseRemote ?? DEFAULT_GLB_PATH, !shouldUseRemote);

    return () => {
      clearIdleTimer();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      placeholderCleanupRef.current?.();
      placeholderCleanupRef.current = null;
      const existingRouterCleanup = actionRouterCleanupRef.current as (() => void) | null;
      if (existingRouterCleanup) {
        existingRouterCleanup();
      }
      actionRouterCleanupRef.current = null;
      interactionEvents.forEach((eventName) => {
        eventTarget.removeEventListener(eventName, markInteraction);
      });
      canvas.removeEventListener("touchstart", preventScroll);
      canvas.removeEventListener("touchmove", preventScroll);
      canvas.removeEventListener("touchend", preventScroll);
      window.removeEventListener("resize", handleResize);
      if (resizeRafRef.current !== null) {
        window.cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
      hotspotSystemRef.current?.dispose();
      hotspotSystemRef.current = null;
      cleanupScalingRef.current?.();
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    };
  }, [loadScene, markInteraction]);

  return (
    <div className="viewer">
      <canvas ref={canvasRef} className="canvas" />
      <Hud placeholderCount={placeholderCount} />
      <Panels panel={panel} onClose={clearSelection} />
      {debugEnabled ? (
        <div className="debug-hud" role="status" aria-live="polite">
          <div>debug: on</div>
          <div>lastHotspot: {debugInfo.lastHotspotId || "none"}</div>
          <div>lastPick: {debugInfo.lastPickMeshName || "none"}</div>
        </div>
      ) : null}
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
        .debug-hud {
          position: absolute;
          top: 12px;
          left: 12px;
          z-index: 9;
          padding: 8px 10px;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.6);
          color: #f1f5f9;
          font-size: 12px;
          line-height: 1.4;
          pointer-events: none;
          white-space: pre-line;
        }
      `}</style>
    </div>
  );
}
