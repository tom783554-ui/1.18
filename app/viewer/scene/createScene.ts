import {
  ArcRotateCamera,
  Color4,
  CubeTexture,
  DefaultRenderingPipeline,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Scene,
  ShadowGenerator,
  Vector3
} from "@babylonjs/core";
import type { ArcRotateCameraPointersInput } from "@babylonjs/core/Cameras/Inputs/arcRotateCameraPointersInput";
import { createICUDressing } from "../../../src/scene/icuDressing";

export const configureTextureCompression = (_scene: Scene) => {
  // TODO: wire KTX2/Basis support without runtime downloads.
};

export const configureCamera = (camera: ArcRotateCamera, canvas: HTMLCanvasElement) => {
  camera.attachControl(canvas, true);
  const pointerInput =
    camera.inputs.attached.pointers as unknown as ArcRotateCameraPointersInput | undefined;
  if (pointerInput) {
    pointerInput.multiTouchPanAndZoom = false;
    pointerInput.multiTouchPanning = false;
  }
  camera.lowerRadiusLimit = 0.05;
  camera.upperRadiusLimit = 1000;
  camera.lowerBetaLimit = 0.2;
  camera.upperBetaLimit = Math.PI / 2.1;
  camera.wheelPrecision = 20;
  camera.pinchPrecision = 100;
  camera.panningSensibility = 90;
  camera.minZ = 0.01;
  camera.maxZ = 5000;
  camera.inertia = 0.7;
  camera.checkCollisions = false;
};

export const createScene = (engine: Engine, canvas: HTMLCanvasElement) => {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.2, 0.2, 0.2, 1);
  scene.environmentIntensity = 0.9;
  scene.imageProcessingConfiguration.exposure = 1.2;
  scene.imageProcessingConfiguration.contrast = 1.08;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.blockMaterialDirtyMechanism = true;
  scene.shadowsEnabled = true;
  scene.postProcessesEnabled = true;

  const camera = new ArcRotateCamera(
    "camera",
    Math.PI / 2,
    Math.PI / 3,
    8,
    Vector3.Zero(),
    scene
  );
  configureCamera(camera, canvas);

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.9;
  const directional = new DirectionalLight("dir", new Vector3(-0.5, -1, -0.3), scene);
  directional.position = new Vector3(5, 10, 5);
  directional.intensity = 1.0;

  const shadowGenerator = new ShadowGenerator(1024, directional);
  shadowGenerator.usePercentageCloserFiltering = true;
  shadowGenerator.bias = 0.0005;

  scene.environmentTexture = CubeTexture.CreateFromPrefilteredData(
    "https://assets.babylonjs.com/environments/environmentSpecular.env",
    scene
  );

  const pipeline = new DefaultRenderingPipeline("icu-pipeline", true, scene, [camera]);
  pipeline.bloomEnabled = true;
  pipeline.bloomKernel = 28;
  pipeline.bloomWeight = 0.15;
  pipeline.bloomThreshold = 0.88;
  pipeline.fxaaEnabled = true;

  const dressing = createICUDressing(scene);
  let dressingVisible = true;
  const handleLightingToggle = (event: KeyboardEvent) => {
    if (event.key.toLowerCase() !== "l") {
      return;
    }
    dressingVisible = !dressingVisible;
    dressing.setEnabled(dressingVisible);
  };
  window.addEventListener("keydown", handleLightingToggle);
  scene.onDisposeObservable.add(() => {
    window.removeEventListener("keydown", handleLightingToggle);
  });

  configureTextureCompression(scene);

  return { scene, camera };
};
