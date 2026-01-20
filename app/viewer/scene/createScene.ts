import { ArcRotateCamera, Color4, Engine, HemisphericLight, Scene, Vector3 } from "@babylonjs/core";
import type { ArcRotateCameraPointersInput } from "@babylonjs/core/Cameras/Inputs/arcRotateCameraPointersInput";

export const configureTextureCompression = (_scene: Scene) => {
  // TODO: wire KTX2/Basis support without runtime downloads.
};

export const createScene = (engine: Engine, canvas: HTMLCanvasElement) => {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.2, 0.2, 0.2, 1);

  const camera = new ArcRotateCamera(
    "camera",
    Math.PI / 2,
    Math.PI / 3,
    10,
    new Vector3(0, 1, 0),
    scene
  );
  camera.attachControl(canvas, true);
  const pointerInput =
    camera.inputs.attached.pointers as unknown as ArcRotateCameraPointersInput | undefined;
  if (pointerInput) {
    pointerInput.multiTouchPanAndZoom = false;
    pointerInput.multiTouchPanning = false;
  }
  camera.lowerRadiusLimit = 1.5;
  camera.upperRadiusLimit = 120;
  camera.lowerBetaLimit = 0.2;
  camera.upperBetaLimit = Math.PI / 2.1;
  camera.wheelPrecision = 140;
  camera.pinchPrecision = 250;
  camera.panningSensibility = 90;
  camera.minZ = 0.01;
  camera.maxZ = 5000;

  new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);

  configureTextureCompression(scene);

  return { scene, camera };
};
