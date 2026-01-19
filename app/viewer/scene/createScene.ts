import { ArcRotateCamera, Color4, Engine, HemisphericLight, Scene, Vector3 } from "@babylonjs/core";

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
  camera.lowerRadiusLimit = 1.5;
  camera.upperRadiusLimit = 120;
  camera.lowerBetaLimit = 0.2;
  camera.upperBetaLimit = Math.PI / 2.1;
  camera.wheelPrecision = 80;
  camera.pinchPrecision = 150;
  camera.panningSensibility = 90;
  camera.minZ = 0.05;
  camera.maxZ = 5000;

  new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);

  configureTextureCompression(scene);

  return { scene, camera };
};
