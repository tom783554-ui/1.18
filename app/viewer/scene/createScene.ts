import {
  ArcRotateCamera,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Scene,
  Vector3
} from "@babylonjs/core";
import type { ArcRotateCameraPointersInput } from "@babylonjs/core/Cameras/Inputs/arcRotateCameraPointersInput";

export const configureTextureCompression = (_scene: Scene) => {
  // TODO: wire KTX2/Basis support without runtime downloads.
};

export const createScene = (engine: Engine, canvas: HTMLCanvasElement) => {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.2, 0.2, 0.2, 1);
  scene.environmentIntensity = 1.0;
  scene.imageProcessingConfiguration.exposure = 1.1;
  scene.imageProcessingConfiguration.contrast = 1.1;
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.blockMaterialDirtyMechanism = true;
  scene.shadowsEnabled = false;
  scene.postProcessesEnabled = false;
  scene.postProcessRenderPipelineManager?.dispose();

  const camera = new ArcRotateCamera(
    "camera",
    Math.PI / 2,
    Math.PI / 3,
    8,
    Vector3.Zero(),
    scene
  );
  camera.attachControl(canvas, true);
  const pointerInput =
    camera.inputs.attached.pointers as unknown as ArcRotateCameraPointersInput | undefined;
  if (pointerInput) {
    pointerInput.multiTouchPanAndZoom = false;
    pointerInput.multiTouchPanning = false;
  }
  camera.lowerRadiusLimit = 4;
  camera.upperRadiusLimit = 20;
  camera.lowerBetaLimit = 0.2;
  camera.upperBetaLimit = Math.PI / 2.1;
  camera.wheelPrecision = 140;
  camera.pinchPrecision = 250;
  camera.panningSensibility = 90;
  camera.minZ = 0.05;
  camera.maxZ = 5000;

  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.7;
  const directional = new DirectionalLight("dir", new Vector3(-0.5, -1, -0.3), scene);
  directional.position = new Vector3(5, 10, 5);
  directional.intensity = 0.9;

  configureTextureCompression(scene);

  return { scene, camera };
};
