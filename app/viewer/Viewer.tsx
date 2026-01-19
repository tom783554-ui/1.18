"use client";

import { useEffect, useRef, useState } from "react";
import "@babylonjs/loaders/glTF/2.0";
import type { ISceneLoaderPlugin, ISceneLoaderPluginAsync, Observer } from "@babylonjs/core";
import {
  AbstractMesh,
  ArcRotateCamera,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  Vector3
} from "@babylonjs/core";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { FilesInputStore } from "@babylonjs/core/Misc/filesInputStore";
import { AxesViewer } from "@babylonjs/core/Debug/axesViewer";
import { GLTFFileLoader } from "@babylonjs/loaders/glTF";

type OverlayMetrics = {
  fps: number;
  sceneMeshes: number;
  geomMeshes: number;
  activeVertices: number;
  totalVertices: number;
  materials: number;
  textures: number;
  registeredLoaders: string;
  lastLoaderEvent: string;
  glbFetch: string;
};

type AssetSummary = {
  nodes: number;
  meshes: number;
  materials: number;
  textures: number;
  glbMagicHex: string;
  glbVersion: number | null;
  glbLength: number | null;
  glbByteLength: number | null;
  glbMagicOk: boolean;
  glbSizeOk: boolean;
  glbFetchStatus: number | null;
  glbContentType: string;
};

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(" ");

const hasGeometryOrVertices = (mesh: AbstractMesh) => {
  const totalVertices = mesh.getTotalVertices?.() ?? 0;
  if (totalVertices > 0) {
    return true;
  }
  const geometry = (mesh as Mesh).geometry;
  const buffers = geometry?.getVertexBuffers?.() ?? {};
  return Object.keys(buffers).length > 0;
};

export default function Viewer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [status, setStatus] = useState("Booting...");
  const [metrics, setMetrics] = useState<OverlayMetrics>({
    fps: 0,
    sceneMeshes: 0,
    geomMeshes: 0,
    activeVertices: 0,
    totalVertices: 0,
    materials: 0,
    textures: 0,
    registeredLoaders: "n/a",
    lastLoaderEvent: "n/a",
    glbFetch: "n/a"
  });
  const [assetSummary, setAssetSummary] = useState<AssetSummary>({
    nodes: 0,
    meshes: 0,
    materials: 0,
    textures: 0,
    glbMagicHex: "n/a",
    glbVersion: null,
    glbLength: null,
    glbByteLength: null,
    glbMagicOk: false,
    glbSizeOk: false,
    glbFetchStatus: null,
    glbContentType: "n/a"
  });

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
    console.log("Engine caps", engine.getCaps());
    console.log("Loaders: @babylonjs/loaders import active");

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
    cube.position = new Vector3(0, 0.8, 0);
    setStatus("Render loop running (cube visible)");

    scene.onNewMeshAddedObservable.add((mesh) => {
      console.log("Scene new mesh", mesh.name);
      setMetrics((prev) => ({
        ...prev,
        lastLoaderEvent: `New mesh: ${mesh.name}`
      }));
    });
    scene.onNewMaterialAddedObservable.add((material) => {
      console.log("Scene new material", material.name);
      setMetrics((prev) => ({
        ...prev,
        lastLoaderEvent: `New material: ${material.name}`
      }));
    });
    scene.onNewTextureAddedObservable.add((texture) => {
      console.log("Scene new texture", texture.name);
      setMetrics((prev) => ({
        ...prev,
        lastLoaderEvent: `New texture: ${texture.name}`
      }));
    });

    engine.runRenderLoop(() => {
      scene.render();
      const geomMeshes = scene.meshes.filter(hasGeometryOrVertices).length;
      setMetrics((prev) => ({
        ...prev,
        fps: Math.round(engine.getFps()),
        sceneMeshes: scene.meshes.length,
        geomMeshes,
        activeVertices: (scene as Scene & { getActiveVertices?: () => number }).getActiveVertices?.() ?? 0,
        totalVertices: (scene as Scene & { getTotalVertices?: () => number }).getTotalVertices?.() ?? 0,
        materials: scene.materials.length,
        textures: scene.textures.length
      }));
    });

    const handleResize = () => engine.resize();
    window.addEventListener("resize", handleResize);

    const ensureGltfLoader = () => {
      const has = (ext: string) => {
        try {
          return SceneLoader.IsPluginForExtensionAvailable(ext);
        } catch {
          return false;
        }
      };

      let available = has(".glb") || has(".gltf") || has("glb") || has("gltf");

      if (!available) {
        try {
          SceneLoader.RegisterPlugin(new GLTFFileLoader());
        } catch (error) {
          console.error("RegisterPlugin(GLTFFileLoader) failed", error);
        }
        available = has(".glb") || has(".gltf") || has("glb") || has("gltf");
      }

      setMetrics((prev) => ({
        ...prev,
        registeredLoaders: available ? "glTF/GLB available" : "glTF/GLB unavailable"
      }));

      return available;
    };

    let pluginObserver: Observer<ISceneLoaderPlugin | ISceneLoaderPluginAsync> | null = null;
    const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      });
      try {
        return await Promise.race([promise, timeout]);
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };

    const loadGlb = async () => {
      try {
        const url = "/assets/main/main.glb";
        setStatus("Fetching GLB...");
        const response = await fetch(url, { cache: "no-store" });
        const contentType = response.headers.get("content-type") ?? "unknown";
        const statusCode = response.status;
        setMetrics((prev) => ({
          ...prev,
          glbFetch: `HTTP ${statusCode} (${contentType})`
        }));
        setAssetSummary((prev) => ({
          ...prev,
          glbFetchStatus: statusCode,
          glbContentType: contentType
        }));
        if (!response.ok) {
          throw new Error(`GLB fetch failed: HTTP ${statusCode}`);
        }
        const glbBuf = await response.arrayBuffer();
        const byteLength = glbBuf.byteLength;
        const bytes = new Uint8Array(glbBuf.slice(0, 32));
        const hex = toHex(bytes);
        console.log("GLB first 32 bytes (hex)", hex);
        console.log("GLB file size (bytes)", byteLength);

        if (byteLength < 12) {
          console.error("GLB_MAGIC_BAD", { size: byteLength, hex });
          setStatus("GLB INVALID (bad header or tiny file)");
          return;
        }

        const dataView = new DataView(glbBuf);
        const magic = dataView.getUint32(0, true);
        const version = dataView.getUint32(4, true);
        const length = dataView.getUint32(8, true);
        const magicHex = `0x${magic.toString(16)}`;
        const magicOk = magic === 0x46546c67;
        const sizeOk = length === byteLength;
        console.log(magicOk ? "GLB_MAGIC_OK" : "GLB_MAGIC_BAD");
        console.log("GLB header validation", {
          magicHex,
          magicOk,
          version,
          declaredLength: length,
          byteLength,
          sizeOk
        });

        setAssetSummary((prev) => ({
          ...prev,
          glbMagicHex: magicHex,
          glbVersion: version,
          glbLength: length,
          glbByteLength: byteLength,
          glbMagicOk: magicOk,
          glbSizeOk: sizeOk,
          glbFetchStatus: statusCode,
          glbContentType: contentType
        }));

        if (!magicOk || byteLength < 1000) {
          console.error("GLB INVALID", { size: byteLength, hex, magicOk });
          setStatus("GLB INVALID (bad header or tiny file)");
          return;
        }

        setStatus(
          `GLB header check: magic ${magicOk ? "OK" : "BAD"},` +
            ` size ${sizeOk ? "OK" : "MISMATCH"} (bytes ${byteLength})`
        );

        const glbFile = new File([new Uint8Array(glbBuf)], "main.glb", {
          type: "model/gltf-binary"
        });
        (FilesInputStore as any).FilesToLoad = (FilesInputStore as any).FilesToLoad || {};
        (FilesInputStore as any).FilesToLoad["main.glb"] = glbFile;

        setStatus("Load path: file:+AppendAsync (memory)");
        const stage = { done: false };
        let appendTimedOut = false;
        let appendFailed = false;
        let appendErrorMessage = "";
        let watchdog: ReturnType<typeof setTimeout> | undefined;
        const appendTimeout = new Promise<never>((_, reject) => {
          watchdog = setTimeout(() => {
            if (stage.done) {
              return;
            }
            appendTimedOut = true;
            setStatus("TIMEOUT: AppendAsync(file:) hung (8s)");
            setMetrics((prev) => ({
              ...prev,
              lastLoaderEvent: "TIMEOUT fired (8s)"
            }));
            reject(new Error("AppendAsync timed out after 8000ms"));
          }, 8000);
        });

        try {
          await Promise.race([
            SceneLoader.AppendAsync("file:", "main.glb", scene, undefined, ".glb"),
            appendTimeout
          ]);
          stage.done = true;
          if (watchdog) {
            clearTimeout(watchdog);
          }
          setStatus(
            `Loaded OK: meshes=${scene.meshes.length} nodes=${scene.transformNodes.length} mats=${scene.materials.length}`
          );
        } catch (err: unknown) {
          stage.done = true;
          if (watchdog) {
            clearTimeout(watchdog);
          }
          const message = (err as Error)?.message ?? String(err);
          appendFailed = true;
          appendErrorMessage = message;
          if (!appendTimedOut) {
            setStatus(`AppendAsync failed: ${message}`);
          }
        }

        if (appendTimedOut || appendFailed) {
          setStatus("Fallback: ImportMeshAsync (URL) ...");
          try {
            const rootUrl = "/assets/main/";
            const file = "main.glb";
            const result = await withTimeout(
              SceneLoader.ImportMeshAsync(null, rootUrl, file, scene, undefined, ".glb"),
              12000,
              "ImportMeshAsync"
            );
            setStatus(`Fallback OK: meshes=${result.meshes?.length ?? 0}`);
          } catch (error) {
            const message = (error as Error)?.message ?? String(error);
            setStatus(
              appendTimedOut
                ? `Fallback failed after AppendAsync timeout: ${message}`
                : `Fallback failed after AppendAsync error: ${appendErrorMessage || message}`
            );
            return;
          }
        }

        const glbMeshes = scene.meshes.filter((mesh) => mesh.name !== "debug-cube");
        const glbNodes = scene.transformNodes.filter((node) => node.name !== "debug-cube");
        setAssetSummary((prev) => ({
          ...prev,
          nodes: glbNodes.length + glbMeshes.length,
          meshes: glbMeshes.length,
          materials: scene.materials.length,
          textures: scene.textures.length
        }));

        const renderables = glbMeshes.filter((mesh) => mesh.getTotalVertices() > 0);
        if (renderables.length === 0) {
          setStatus("GLB HAS NO RENDERABLE GEOMETRY (root/nodes only)");
          console.warn("No vertices found. Export is empty or only empties/transforms.");
          return;
        }

        renderables.forEach((mesh) => {
          mesh.setEnabled(true);
          mesh.isVisible = true;
          mesh.alwaysSelectAsActiveMesh = true;
          mesh.receiveShadows = false;
          mesh.unfreezeWorldMatrix();
          mesh.computeWorldMatrix(true);
          mesh.refreshBoundingInfo(true);
        });

        let min = new Vector3(
          Number.POSITIVE_INFINITY,
          Number.POSITIVE_INFINITY,
          Number.POSITIVE_INFINITY
        );
        let max = new Vector3(
          Number.NEGATIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
          Number.NEGATIVE_INFINITY
        );

        renderables.forEach((mesh) => {
          const bounds = mesh.getHierarchyBoundingVectors(true);
          min = Vector3.Minimize(min, bounds.min);
          max = Vector3.Maximize(max, bounds.max);
        });

        const center = min.add(max).scale(0.5);
        const size = max.subtract(min);
        const maxSize = Math.max(size.x, size.y, size.z);
        const radius = Math.min(200, Math.max(2, maxSize * 2));

        camera.setTarget(center);
        camera.radius = radius;
        camera.minZ = 0.01;
        camera.maxZ = 10000;

        scene.forceShowBoundingBoxes = true;
        new AxesViewer(scene, Math.max(maxSize * 0.2, 0.5));
        const centerAxes = new AxesViewer(scene, Math.max(maxSize * 0.2, 0.5));
        centerAxes.update(center, Vector3.Right(), Vector3.Up(), Vector3.Forward());

        console.log("Forced visibility and camera framing", {
          renderables: renderables.length,
          center: center.toString(),
          radius,
          min: min.toString(),
          max: max.toString()
        });

        setMetrics((prev) => ({
          ...prev,
          lastLoaderEvent: `GLB visible forced (renderables=${renderables.length})`
        }));
      } catch (error) {
        console.error("GLB load failed", error);
        setStatus("GLB load failed ❌ (see console)");
      }
    };

    const startLoading = async () => {
      const ok = ensureGltfLoader();
      if (ok) {
        setStatus("glTF/GLB loader available");
      } else {
        setStatus("glTF/GLB loader unavailable (attempting load anyway)");
        console.warn("glTF loader unavailable — attempting load anyway");
      }

      pluginObserver = SceneLoader.OnPluginActivatedObservable.add((plugin) => {
        console.log("Plugin activated:", plugin.name);
        setMetrics((prev) => ({
          ...prev,
          lastLoaderEvent: `Plugin activated: ${plugin.name}`
        }));
        const name = String((plugin as { name?: string })?.name ?? "").toLowerCase();
        if (!name.includes("gltf")) {
          return;
        }
        const gltfLoader = plugin as GLTFFileLoader;
        try {
          (gltfLoader as { useRangeRequests?: boolean }).useRangeRequests = false;
        } catch {}
        try {
          (gltfLoader as { incrementalLoading?: boolean }).incrementalLoading = false;
        } catch {}
        try {
          (gltfLoader as { compileMaterials?: boolean }).compileMaterials = false;
        } catch {}
        try {
          (gltfLoader as { compileShadowGenerators?: boolean }).compileShadowGenerators = false;
        } catch {}
        try {
          gltfLoader.loggingEnabled = true;
        } catch {}
        gltfLoader.capturePerformanceCounters = true;
        gltfLoader.validate = false;
        gltfLoader.onLoaderStateChangedObservable?.add((state) => {
          console.log("GLTF loader state", state);
          setMetrics((prev) => ({
            ...prev,
            lastLoaderEvent: `GLTF state: ${state}`
          }));
        });
        setMetrics((prev) => ({
          ...prev,
          lastLoaderEvent: "glTF activated (range/incremental OFF)"
        }));
        console.log("GLTF loader verbose logging enabled");
      });

      await loadGlb();
    };

    const cleanup = () => {
      window.removeEventListener("resize", handleResize);
      if (pluginObserver) {
        SceneLoader.OnPluginActivatedObservable.remove(pluginObserver);
      }
      engine.stopRenderLoop();
      scene.dispose();
      engine.dispose();
    };

    void startLoading();

    return cleanup;
  }, []);

  return (
    <div className="viewer">
      <canvas ref={canvasRef} className="canvas" />
      <div className="overlay">
        <div className="overlay-title">Babylon Viewer</div>
        <div className="overlay-row">
          build: {process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev"}
        </div>
        <div className="overlay-row">
          built: {process.env.NEXT_PUBLIC_BUILD_TIME ?? "n/a"}
        </div>
        <div className="overlay-row">Status: {status}</div>
        <div className="overlay-row">FPS: {metrics.fps}</div>
        <div className="overlay-row">scene.meshes.length: {metrics.sceneMeshes}</div>
        <div className="overlay-row">geomMeshes: {metrics.geomMeshes}</div>
        <div className="overlay-row">activeVertices: {metrics.activeVertices}</div>
        <div className="overlay-row">totalVertices: {metrics.totalVertices}</div>
        <div className="overlay-row">materials: {metrics.materials}</div>
        <div className="overlay-row">textures: {metrics.textures}</div>
        <div className="overlay-row">Registered loaders: {metrics.registeredLoaders}</div>
        <div className="overlay-row">
          glTF loader available: {String(SceneLoader.IsPluginForExtensionAvailable(".glb"))}
        </div>
        <div className="overlay-row">last loader event: {metrics.lastLoaderEvent}</div>
        <div className="overlay-row">GLB Fetch: {metrics.glbFetch}</div>
        <div className="overlay-row">Load path: file:+AppendAsync (memory)</div>
        <div className="overlay-row">
          GLB Header: {assetSummary.glbMagicHex} v{assetSummary.glbVersion ?? "?"} ( 
          {assetSummary.glbByteLength ?? "?"} bytes)
        </div>
        <div className="overlay-row">
          GLB Valid: magic {assetSummary.glbMagicOk ? "OK" : "BAD"}, size{" "}
          {assetSummary.glbSizeOk ? "OK" : "MISMATCH"}
        </div>
        <div className="overlay-row">
          GLB Nodes/Meshes: {assetSummary.nodes}/{assetSummary.meshes}
        </div>
        <div className="overlay-row">
          GLB Materials/Textures: {assetSummary.materials}/{assetSummary.textures}
        </div>
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
          font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono",
            "Courier New", monospace;
          z-index: 10;
          max-width: 320px;
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
