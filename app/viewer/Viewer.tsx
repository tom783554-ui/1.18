"use client";

import { useEffect, useRef, useState } from "react";
import {
  AbstractMesh,
  ArcRotateCamera,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  SceneLoader,
  Vector3
} from "@babylonjs/core";
import { AxesViewer } from "@babylonjs/core/Debug/axesViewer";
import { GLTFFileLoader } from "@babylonjs/loaders/glTF";
import "@babylonjs/loaders";

const GLB_URL = "/assets/main/main.glb";

type OverlayMetrics = {
  fps: number;
  sceneMeshes: number;
  geomMeshes: number;
  activeVertices: number;
  totalVertices: number;
  materials: number;
  textures: number;
  lastLoaderEvent: string;
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

const isRenderable = (mesh: AbstractMesh) => {
  if (hasGeometryOrVertices(mesh)) {
    return true;
  }
  mesh.refreshBoundingInfo?.(true);
  const boundingInfo = mesh.getBoundingInfo?.();
  if (!boundingInfo) {
    return false;
  }
  return boundingInfo.boundingBox.extendSizeWorld.length() > 0;
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
    lastLoaderEvent: "n/a"
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
    glbSizeOk: false
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

    setStatus("Loading GLB...");
    const pluginObserver = SceneLoader.OnPluginActivatedObservable.add((plugin) => {
      console.log("SceneLoader plugin activated", plugin.name);
      setMetrics((prev) => ({
        ...prev,
        lastLoaderEvent: `Plugin activated: ${plugin.name}`
      }));
      if (plugin.name.toLowerCase().includes("gltf")) {
        const gltfLoader = plugin as GLTFFileLoader;
        gltfLoader.loggingEnabled = true;
        gltfLoader.capturePerformanceCounters = true;
        gltfLoader.validate = false;
        gltfLoader.onLoaderStateChangedObservable?.add((state) => {
          console.log("GLTF loader state", state);
          setMetrics((prev) => ({
            ...prev,
            lastLoaderEvent: `GLTF state: ${state}`
          }));
        });
        console.log("GLTF loader verbose logging enabled");
      }
    });

    const loadGlb = async () => {
      try {
        setStatus("Downloading GLB (for header check)...");
        const response = await fetch(GLB_URL, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} while fetching ${GLB_URL}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const byteLength = arrayBuffer.byteLength;
        const bytes = new Uint8Array(arrayBuffer.slice(0, 32));
        const hex = toHex(bytes);
        console.log("GLB first 32 bytes (hex)", hex);
        console.log("GLB file size (bytes)", byteLength);

        if (byteLength < 12) {
          console.error("GLB_MAGIC_BAD", { size: byteLength, hex });
          setStatus("GLB INVALID (bad header or tiny file)");
          return;
        }

        const dataView = new DataView(arrayBuffer);
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
          glbSizeOk: sizeOk
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

        const blobUrl = URL.createObjectURL(
          new Blob([arrayBuffer], { type: "model/gltf-binary" })
        );
        try {
          setStatus("Loading GLB into AssetContainer...");
          const container = await SceneLoader.LoadAssetContainerAsync("", blobUrl, scene);
          console.log("GLB AssetContainer loaded", {
            meshes: container.meshes.length,
            transformNodes: container.transformNodes.length,
            materials: container.materials.length,
            textures: container.textures.length,
            animationGroups: container.animationGroups.length
          });
          container.addAllToScene();
          const nodeCount = container.transformNodes.length + container.meshes.length;
          setAssetSummary((prev) => ({
            ...prev,
            nodes: nodeCount,
            meshes: container.meshes.length,
            materials: container.materials.length,
            textures: container.textures.length
          }));
          setStatus(
            `Container loaded: meshes=${container.meshes.length}, mats=${container.materials.length}, tex=${container.textures.length}`
          );

          const renderables = container.meshes.filter(isRenderable);
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

          setStatus(`GLB VISIBLE FORCED (renderables=${renderables.length})`);
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      } catch (error) {
        console.error("GLB load failed", error);
        setStatus("GLB load failed ❌ (see console)");
      }
    };

    void loadGlb();

    return () => {
      window.removeEventListener("resize", handleResize);
      SceneLoader.OnPluginActivatedObservable.remove(pluginObserver);
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
        <div className="overlay-row">scene.meshes.length: {metrics.sceneMeshes}</div>
        <div className="overlay-row">geomMeshes: {metrics.geomMeshes}</div>
        <div className="overlay-row">activeVertices: {metrics.activeVertices}</div>
        <div className="overlay-row">totalVertices: {metrics.totalVertices}</div>
        <div className="overlay-row">materials: {metrics.materials}</div>
        <div className="overlay-row">textures: {metrics.textures}</div>
        <div className="overlay-row">last loader event: {metrics.lastLoaderEvent}</div>
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
