"use client";

import { useEffect, useRef, useState } from "react";
import {
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

type Metrics = {
  fps: number;
  meshes: number;
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

export default function Viewer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [status, setStatus] = useState("Booting...");
  const [metrics, setMetrics] = useState<Metrics>({ fps: 0, meshes: 0 });
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
    const pluginObserver = SceneLoader.OnPluginActivatedObservable.add((plugin) => {
      console.log("SceneLoader plugin activated", plugin.name);
      if (plugin.name.toLowerCase().includes("gltf")) {
        const gltfLoader = plugin as GLTFFileLoader;
        gltfLoader.loggingEnabled = true;
        gltfLoader.capturePerformanceCounters = true;
        console.log("GLTF loader verbose logging enabled");
      }
      const loader = plugin as GLTFFileLoader & {
        onExtensionLoadedObservable?: { add: (cb: (extension: { name?: string } | string) => void) => void };
        onExtensionNotSupportedObservable?: { add: (cb: (extensionName: string) => void) => void };
      };
      loader.onExtensionLoadedObservable?.add((extension) => {
        const extensionName = typeof extension === "string" ? extension : extension.name ?? "unknown";
        console.log("GLTF extension loaded", extensionName);
      });
      loader.onExtensionNotSupportedObservable?.add((extensionName) => {
        console.warn("GLTF extension not supported", extensionName);
        if (
          extensionName.toLowerCase().includes("draco") ||
          extensionName.toLowerCase().includes("ktx2") ||
          extensionName.toLowerCase().includes("basisu")
        ) {
          console.warn("Draco/KTX2 extension detected but unsupported", extensionName);
        }
      });
    });
    const loadGlb = async () => {
      try {
        setStatus("Downloading GLB (for header check)...");
        const response = await fetch(GLB_URL);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} while fetching ${GLB_URL}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const dataView = new DataView(arrayBuffer);
        const magic = dataView.getUint32(0, true);
        const version = dataView.getUint32(4, true);
        const length = dataView.getUint32(8, true);
        const magicHex = `0x${magic.toString(16)}`;
        const magicOk = magic === 0x46546c67;
        const sizeOk = length === arrayBuffer.byteLength;
        console.log("GLB header validation", {
          magicHex,
          magicOk,
          version,
          declaredLength: length,
          byteLength: arrayBuffer.byteLength,
          sizeOk
        });
        setAssetSummary((prev) => ({
          ...prev,
          glbMagicHex: magicHex,
          glbVersion: version,
          glbLength: length,
          glbByteLength: arrayBuffer.byteLength,
          glbMagicOk: magicOk,
          glbSizeOk: sizeOk
        }));
        setStatus(
          `GLB header check: magic ${magicOk ? "OK" : "BAD"},` +
            ` size ${sizeOk ? "OK" : "MISMATCH"} (bytes ${arrayBuffer.byteLength})`
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

          const geometryMeshes = container.meshes.filter(
            (mesh): mesh is Mesh => mesh instanceof Mesh && Boolean(mesh.geometry)
          );
          console.log("GLB geometry meshes", geometryMeshes.length);
          container.meshes.forEach((mesh) => {
            const boundingInfo = mesh.getBoundingInfo?.();
            const hasGeometry = mesh instanceof Mesh ? Boolean(mesh.geometry) : false;
            console.log("GLB mesh", {
              name: mesh.name,
              isVisible: mesh.isVisible,
              isEnabled: mesh.isEnabled(),
              hasGeometry,
              boundingMin: boundingInfo ? boundingInfo.boundingBox.minimumWorld.toString() : "n/a",
              boundingMax: boundingInfo ? boundingInfo.boundingBox.maximumWorld.toString() : "n/a",
              scaling: mesh.scaling.toString(),
              position: mesh.position.toString()
            });
          });

          if (geometryMeshes.length === 0) {
            setStatus("GLB contains NO geometry — root node only");
            console.warn(
              "GLB has no renderable meshes. Likely empty export, LOD-only, or unsupported extension."
            );
            return;
          }

          geometryMeshes.forEach((mesh) => {
            mesh.setEnabled(true);
            mesh.isVisible = true;
            mesh.scaling.setAll(1);
            mesh.position.set(0, 0, 0);
            mesh.showBoundingBox = true;
            if (mesh.material) {
              const cloned = mesh.material.clone(`${mesh.material.name || mesh.name}-wireframe`);
              if (cloned) {
                cloned.wireframe = true;
                mesh.material = cloned;
              }
            }
          });

          let min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
          let max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
          geometryMeshes.forEach((mesh) => {
            const bounds = mesh.getHierarchyBoundingVectors(true);
            min = Vector3.Minimize(min, bounds.min);
            max = Vector3.Maximize(max, bounds.max);
          });
          const center = min.add(max).scale(0.5);
          const size = max.subtract(min);
          const radius = Math.max(size.x, size.y, size.z) * 1.5;
          camera.setTarget(center);
          camera.radius = radius;
          camera.lowerRadiusLimit = camera.radius * 0.1;
          camera.upperRadiusLimit = camera.radius * 10;

          const axesViewer = new AxesViewer(scene, Math.max(radius * 0.2, 0.5));
          axesViewer.update(center, Vector3.Right(), Vector3.Up(), Vector3.Forward());
          console.log("Debug helpers enabled: bounding boxes + axes", {
            axesCenter: center.toString(),
            axesSize: Math.max(radius * 0.2, 0.5)
          });

          cube.position = new Vector3(2, 1, 0);

          setStatus(`GLB geometry visible (forced) — ${geometryMeshes.length} meshes`);
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
        <div className="overlay-row">Meshes: {metrics.meshes}</div>
        <div className="overlay-row">
          GLB Header: {assetSummary.glbMagicHex} v{assetSummary.glbVersion ?? "?"}{" "}
          ({assetSummary.glbByteLength ?? "?"} bytes)
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
