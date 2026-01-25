import {
  Color3,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  TransformNode,
  Vector3,
  type Scene
} from "@babylonjs/core";

export const createICUDressing = (scene: Scene) => {
  const root = new TransformNode("icu-dressing-root", scene);

  const floor = MeshBuilder.CreateGround("icu-floor", { width: 10, height: 8 }, scene);
  floor.parent = root;
  const floorMat = new PBRMaterial("icu-floor-mat", scene);
  floorMat.albedoColor = new Color3(0.62, 0.65, 0.68);
  floorMat.roughness = 0.75;
  floorMat.metallic = 0.0;
  floor.material = floorMat;

  const wallMat = new PBRMaterial("icu-wall-mat", scene);
  wallMat.albedoColor = new Color3(0.82, 0.84, 0.88);
  wallMat.roughness = 0.8;

  const backWall = MeshBuilder.CreatePlane("icu-wall-back", { width: 10, height: 4 }, scene);
  backWall.parent = root;
  backWall.position = new Vector3(0, 2, -4);
  backWall.rotation.y = Math.PI;
  backWall.material = wallMat;

  const sideWall = MeshBuilder.CreatePlane("icu-wall-side", { width: 8, height: 4 }, scene);
  sideWall.parent = root;
  sideWall.position = new Vector3(-5, 2, 0);
  sideWall.rotation.y = Math.PI / 2;
  sideWall.material = wallMat;

  const ceiling = MeshBuilder.CreatePlane("icu-ceiling", { width: 10, height: 8 }, scene);
  ceiling.parent = root;
  ceiling.position = new Vector3(0, 4, 0);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.material = wallMat;

  const headwall = MeshBuilder.CreatePlane("icu-headwall", { width: 3.4, height: 1.4 }, scene);
  headwall.parent = root;
  headwall.position = new Vector3(0, 1.6, -3.2);
  const headwallMat = new PBRMaterial("icu-headwall-mat", scene);
  headwallMat.albedoColor = new Color3(0.68, 0.7, 0.75);
  headwallMat.roughness = 0.55;
  headwall.material = headwallMat;

  const curtain = MeshBuilder.CreatePlane("icu-curtain", { width: 3.5, height: 2.6 }, scene);
  curtain.parent = root;
  curtain.position = new Vector3(3.2, 1.4, -1.8);
  curtain.rotation.y = -Math.PI / 2.1;
  const curtainMat = new StandardMaterial("icu-curtain-mat", scene);
  curtainMat.diffuseColor = new Color3(0.5, 0.65, 0.7);
  curtainMat.alpha = 0.75;
  curtainMat.emissiveColor = new Color3(0.08, 0.1, 0.12);
  curtain.material = curtainMat;

  const stripe = MeshBuilder.CreatePlane("icu-hazard-stripe", { width: 2.2, height: 0.22 }, scene);
  stripe.parent = root;
  stripe.position = new Vector3(2.2, 0.02, 1.8);
  stripe.rotation.x = Math.PI / 2;
  const stripeMat = new StandardMaterial("icu-stripe-mat", scene);
  stripeMat.diffuseColor = new Color3(0.9, 0.7, 0.2);
  stripeMat.emissiveColor = new Color3(0.3, 0.2, 0.05);
  stripe.material = stripeMat;

  const panelMat = new StandardMaterial("icu-panel-mat", scene);
  panelMat.diffuseColor = new Color3(0.95, 0.97, 1.0);
  panelMat.emissiveColor = new Color3(0.1, 0.12, 0.16);

  for (let i = 0; i < 3; i += 1) {
    const panel = MeshBuilder.CreatePlane(`icu-light-${i}`, { width: 1.4, height: 0.6 }, scene);
    panel.parent = root;
    panel.position = new Vector3(-2 + i * 2, 3.8, -0.4);
    panel.rotation.x = Math.PI / 2;
    panel.material = panelMat;
  }

  return root;
};
