import {
  ArcRotateCamera,
  Color4,
  HemisphericLight,
  Scene,
  Vector3
} from "@babylonjs/core";

export const createScene = (scene: Scene) => {
  scene.clearColor = new Color4(0.18, 0.18, 0.18, 1);

  const camera = new ArcRotateCamera(
    "camera",
    Math.PI / 2,
    Math.PI / 3,
    12,
    new Vector3(0, 1.2, 0),
    scene
  );
  camera.lowerRadiusLimit = 2;
  camera.upperRadiusLimit = 80;
  camera.wheelPrecision = 50;
  camera.panningSensibility = 80;
  camera.minZ = 0.05;
  camera.maxZ = 4000;

  new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);

  return { scene, camera };
};
