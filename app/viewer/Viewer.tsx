"use client";

import {
  Color3,
  Material,
  PBRMaterial,
  StandardMaterial,
  type AbstractMesh,
  type ArcRotateCamera,
  type Engine,
  type HighlightLayer,
  type Scene,
  type TransformNode,
  Vector3
} from "@babylonjs/core";
import type { AdvancedDynamicTexture } from "@babylonjs/gui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startEngineLoop, stopEngineLoop } from "../../src/engine/store";
import { usePatientEngine } from "../../src/engine/usePatientEngine";
import { createEngine } from "./engine/createEngine";
import { attachHotspotSystem, type HotspotEntry } from "./interactions/hotspotSystem";
import { onHotspotRegistry } from "./interactions/hotspotRegistryEvents";
import { configureCamera, createScene } from "./scene/createScene";
import { DEFAULT_GLB_PATH, loadMainGlb, type LoadProgress } from "./load/loadMainGlb";
import { getM3dDebugState, setM3dReady } from "./utils/m3dDebug";
import Hud from "./ui/Hud";
import LoadingOverlay from "./ui/LoadingOverlay";
import Panels from "./ui/Panels";
import ZoomTestOverlay from "./ui/ZoomTestOverlay";

const READY_FLASH_MS = 900;
const IDLE_FREEZE_MS = 2000;
const MAX_SCENE_DIMENSION = 20;
const TARGET_SCENE_SIZE = 6;
const VENT_GLOW = new Color3(0.2, 0.9, 0.4);
const PRESSOR_GLOW = new Color3(0.3, 0.6, 1.0);
const MONITOR_GLOW = new Color3(1.0, 0.2, 0.2);
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

const collectMeshes = (node: AbstractMesh | TransformNode | null) => {
  if (!node) {
    return [] as AbstractMesh[];
  }
  if (node instanceof AbstractMesh) {
    return [node];
  }
  const meshes: AbstractMesh[] = [];
  node.getChildren().forEach((child) => {
    if (child instanceof AbstractMesh) {
      meshes.push(child);
    }
  });
  return meshes;
};

const isEmissiveMaterial = (material: Material | null): material is StandardMaterial | PBRMaterial => {
  return material instanceof StandardMaterial || material instanceof PBRMaterial;
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
  const { state, config } = usePatientEngine();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const uiRef = useRef<AdvancedDynamicTexture | null>(null);
  const highlightLayerRef = useRef<HighlightLayer | null>(null);
  const selectedHotspotRef = useRef<HotspotEntry | null>(null);
  const hotspotSystemRef = useRef<ReturnType<typeof attachHotspotSystem> | null>(null);
  const cameraDefaults = useRef<{ alpha: number; beta: number; radius: number; target: [number, number, number] } | null>(
    null
  );
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const cleanupScalingRef = useRef<(() => void) | undefined>();
  const placeholderCleanupRef = useRef<(() => void) | null>(null);
  const actionRouterCleanupRef = useRef<(() => void) | null>(null);
  const isNormalizedRef = useRef(false);
  const resizeRafRef = useRef<number | null>(null);
  const worldSyncRef = useRef<{
    ventMeshes: AbstractMesh[];
    monitorMeshes: AbstractMesh[];
    pressorMeshes: AbstractMesh[];
    highlightLayer: HighlightLayer | null;
    emissiveCache: Map<Material, Color3>;
    lastVentOn: boolean | null;
    lastPressorActive: boolean | null;
    lastCriticalPulse: boolean | null;
  }>({
    ventMeshes: [],
    monitorMeshes: [],
    pressorMeshes: [],
    highlightLayer: null,
    emissiveCache: new Map(),
    lastVentOn: null,
    lastPressorActive: null,
    lastCriticalPulse: null
  });
  const engineStateRef = useRef(state);
  const configRef = useRef(config);

  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [missingMain, setMissingMain] = useState(false);
  const [missingMainDetails, setMissingMainDetails] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; details?: string } | null>(null);
  const [shareGlbParam, setShareGlbParam] = useState<string | null>(null);
  const [placeholderCount, setPlaceholderCount] = useState(0);
  const [panel, setPanel] = useState<{ title: string; id: string } | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{ lastHotspotId: string; lastPickMeshName: string }>({
    lastHotspotId: "none",
    lastPickMeshName: "none"
  });

  const shareUrl = useMemo(() => formatShareUrl(shareGlbParam), [shareGlbParam]);

  useEffect(() => {
    engineStateRef.current = state;
  }, [state]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

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

  const handleReset = useCallback(() => {
    resetCamera();
    clearSelection();
    markInteraction();
  }, [clearSelection, markInteraction, resetCamera]);

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
      return;
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

  const handleRecenter = useCallback(() => {
    reframeScene();
    markInteraction();
  }, [markInteraction, reframeScene]);

  const adjustZoom = useCallback((direction: 1 | -1) => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }
    const step = Math.max(camera.radius * 0.1, 0.02);
    const nextRadius = camera.radius + step * direction;
    const lowerLimit = camera.lowerRadiusLimit ?? 0;
    const upperLimit = camera.upperRadiusLimit ?? nextRadius;
    camera.radius = Math.min(Math.max(nextRadius, lowerLimit), upperLimit);
    markInteraction();
  }, [markInteraction]);

  const handleZoomIn = useCallback(() => adjustZoom(-1), [adjustZoom]);
  const handleZoomOut = useCallback(() => adjustZoom(1), [adjustZoom]);

  const handleResetLimits = useCallback(() => {
    const camera = cameraRef.current;
    const canvas = canvasRef.current;
    if (!camera || !canvas) {
      return;
    }
    configureCamera(camera, canvas);
    const lowerLimit = camera.lowerRadiusLimit ?? 0;
    const upperLimit = camera.upperRadiusLimit ?? camera.radius;
    camera.radius = Math.min(Math.max(camera.radius, lowerLimit), upperLimit);
    markInteraction();
  }, [markInteraction]);

  const handleNormalizeGlb = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene || isNormalizedRef.current) {
      return;
    }
    const roots = scene.meshes.filter((mesh) => !mesh.parent);
    roots.forEach((mesh) => {
      mesh.scaling = mesh.scaling.scale(0.01);
      mesh.computeWorldMatrix(true);
    });
    isNormalizedRef.current = true;
    reframeScene();
    markInteraction();
  }, [markInteraction, reframeScene]);

  const cacheWorldMeshes = useCallback(
    (registry: { entries: Array<{ id: string; nodeName: string }> }) => {
      const scene = sceneRef.current;
      if (!scene) {
        return;
      }
      const findMeshGroup = (ids: string[]) => {
        for (const id of ids) {
          const entry = registry.entries.find((item) => item.id.toLowerCase() === id.toLowerCase());
          const nodeName = entry?.nodeName ?? id;
          const node =
            scene.getMeshByName(nodeName) ??
            scene.getTransformNodeByName(nodeName) ??
            scene.getMeshByName(id) ??
            scene.getTransformNodeByName(id) ??
            null;
          const meshes = collectMeshes(node);
          if (meshes.length > 0) {
            return meshes;
          }
        }
        return [] as AbstractMesh[];
      };

      worldSyncRef.current.ventMeshes = findMeshGroup(["Ventilator", "ventilator", "vent", "HP__Ventilator"]);
      worldSyncRef.current.monitorMeshes = findMeshGroup(["Monitor", "monitor", "PatientMonitor", "HP__Monitor"]);
      worldSyncRef.current.pressorMeshes = findMeshGroup(["norepi_pump", "NorepiPump", "IVPump", "iv_fluids"]);
    },
    []
  );

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
      const sync = worldSyncRef.current;
      sync.ventMeshes = [];
      sync.monitorMeshes = [];
      sync.pressorMeshes = [];
      sync.emissiveCache.clear();
      sync.lastVentOn = null;
      sync.lastPressorActive = null;
      sync.lastCriticalPulse = null;

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
    [armIdleFreeze, normalizeScene, reframeScene]
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
    if (typeof window === "undefined") {
      return undefined;
    }
    return onHotspotRegistry((registry) => {
      cacheWorldMeshes(registry);
    });
  }, [cacheWorldMeshes]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const interval = window.setInterval(() => {
      const scene = sceneRef.current;
      if (!scene) {
        return;
      }
      const sync = worldSyncRef.current;
      const engineState = engineStateRef.current;
      const scenario = configRef.current;
      if (!sync.highlightLayer) {
        sync.highlightLayer = highlightLayerRef.current ?? new HighlightLayer("world-sync", scene);
      }
      const highlightLayer = sync.highlightLayer;

      const setEmissive = (meshes: AbstractMesh[], color: Color3, intensity: number) => {
        meshes.forEach((mesh) => {
          const material = mesh.material ?? null;
          if (!isEmissiveMaterial(material)) {
            return;
          }
          if (!sync.emissiveCache.has(material)) {
            sync.emissiveCache.set(material, material.emissiveColor.clone());
          }
          const emissive = material.emissiveColor ?? new Color3(0, 0, 0);
          emissive.copyFrom(color).scaleInPlace(intensity);
          material.emissiveColor = emissive;
        });
      };

      const restoreEmissive = (meshes: AbstractMesh[]) => {
        meshes.forEach((mesh) => {
          const material = mesh.material ?? null;
          if (!isEmissiveMaterial(material)) {
            return;
          }
          const cached = sync.emissiveCache.get(material);
          if (cached) {
            material.emissiveColor = cached;
          }
        });
      };

      const setHighlight = (meshes: AbstractMesh[], color: Color3, enabled: boolean) => {
        meshes.forEach((mesh) => {
          if (enabled) {
            highlightLayer.addMesh(mesh, color);
          } else {
            highlightLayer.removeMesh(mesh);
          }
        });
      };

      const ventOn = engineState.devices.ventOn;
      if (sync.lastVentOn !== ventOn) {
        if (ventOn) {
          setEmissive(sync.ventMeshes, VENT_GLOW, 0.8);
        } else {
          restoreEmissive(sync.ventMeshes);
        }
        setHighlight(sync.ventMeshes, VENT_GLOW, ventOn);
        sync.lastVentOn = ventOn;
      }

      const pressorActive = engineState.interventions.pressorDose > 0.01;
      if (sync.lastPressorActive !== pressorActive) {
        if (pressorActive) {
          setEmissive(sync.pressorMeshes, PRESSOR_GLOW, 0.7);
        } else {
          restoreEmissive(sync.pressorMeshes);
        }
        setHighlight(sync.pressorMeshes, PRESSOR_GLOW, pressorActive);
        sync.lastPressorActive = pressorActive;
      }

      const criticalSpo2 = engineState.vitals.spo2Pct <= scenario.thresholds.spo2.critical;
      const shouldPulse = !ventOn && criticalSpo2;
      if (shouldPulse) {
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 450));
        setEmissive(sync.monitorMeshes, MONITOR_GLOW, pulse);
      } else if (sync.lastCriticalPulse) {
        restoreEmissive(sync.monitorMeshes);
      }
      sync.lastCriticalPulse = shouldPulse;
    }, 200);
    return () => window.clearInterval(interval);
  }, []);

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

    hotspotSystemRef.current = attachHotspotSystem({
      scene,
      camera,
      uiRef,
      highlightLayerRef,
      selectedRef: selectedHotspotRef,
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

    void loadScene(shouldUseRemote ?? DEFAULT_GLB_PATH, !shouldUseRemote, shouldUseRemote);

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
      <ZoomTestOverlay
        scene={sceneRef.current}
        camera={cameraRef.current}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onRecenter={handleRecenter}
        onResetLimits={handleResetLimits}
        onNormalize={handleNormalizeGlb}
      />
      {debugEnabled ? (
        <div className="debug-hud" role="status" aria-live="polite">
          <div>debug: on</div>
          <div>lastHotspot: {debugInfo.lastHotspotId || "none"}</div>
          <div>lastPick: {debugInfo.lastPickMeshName || "none"}</div>
        </div>
      ) : null}
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
