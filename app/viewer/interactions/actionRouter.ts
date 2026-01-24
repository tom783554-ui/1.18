import {
  AbstractMesh,
  ArcRotateCamera,
  Camera,
  Color3,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import { onPick } from "./m3dEvents";

export type ActionCtx = { scene: Scene; camera: ArcRotateCamera | Camera | null };

type ArcDefaults = {
  alpha: number;
  beta: number;
  radius: number;
  target: Vector3;
};

const PANEL_EVENT = "m3d:panel" as const;

const PANEL_TITLES: Record<string, string> = {
  monitor: "Monitor",
  ventilator: "Ventilator",
  bed: "Bed"
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const emitPanel = (title: string, id: string) => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(PANEL_EVENT, { detail: { open: true, title, id } }));
};

const resolveNode = (scene: Scene, name: string): TransformNode | AbstractMesh | null => {
  return scene.getTransformNodeByName(name) ?? scene.getMeshByName(name);
};

const getNodePosition = (node: TransformNode | AbstractMesh) => {
  if (typeof node.getAbsolutePosition === "function") {
    return node.getAbsolutePosition();
  }
  return node.position;
};

const setCameraTarget = (camera: Camera | null, target: Vector3) => {
  if (!camera) {
    return;
  }
  const maybeTargetCamera = camera as Camera & { setTarget?: (target: Vector3) => void; target?: Vector3 };
  if (typeof maybeTargetCamera.setTarget === "function") {
    maybeTargetCamera.setTarget(target);
    return;
  }
  if (maybeTargetCamera.target) {
    maybeTargetCamera.target.copyFrom(target);
  }
};

const handleHotspot = (id: string) => {
  const title = PANEL_TITLES[id] ?? "Hotspot";
  emitPanel(title, id);
};

const handleNavDoor = (scene: Scene, camera: ArcRotateCamera | Camera | null) => {
  const navDoor = resolveNode(scene, "NAV__door");
  if (!navDoor) {
    return;
  }
  const target = getNodePosition(navDoor).clone();

  if (camera instanceof ArcRotateCamera) {
    camera.setTarget(target);
    camera.radius = clamp(camera.radius, 3, 8);
    if (!Number.isFinite(camera.radius)) {
      camera.radius = 6;
    }
    camera.alpha = 1.2;
    camera.beta = 1.1;
    return;
  }

  setCameraTarget(camera, target);
};

const captureArcDefaults = (camera: ArcRotateCamera | Camera | null): ArcDefaults => {
  if (camera instanceof ArcRotateCamera) {
    return {
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      target: camera.target.clone()
    };
  }
  return {
    alpha: 1.6,
    beta: 0.9,
    radius: 4.5,
    target: new Vector3(0, 1.2, 0)
  };
};

const handleCameraSpawn = (camera: ArcRotateCamera | Camera | null, defaults: ArcDefaults) => {
  if (camera instanceof ArcRotateCamera) {
    camera.alpha = defaults.alpha;
    camera.beta = defaults.beta;
    camera.radius = defaults.radius;
    camera.setTarget(defaults.target.clone());
    return;
  }

  setCameraTarget(camera, defaults.target.clone());
};

const handleSocketToggle = (scene: Scene, id: string) => {
  const socketName = `SOCKET__${id}`;
  const socketNode = resolveNode(scene, socketName);
  if (!socketNode) {
    return;
  }

  const attachedName = `__ATTACHED__${id}`;
  const existing = scene.getMeshByName(attachedName);
  if (existing) {
    existing.dispose(false, true);
    return;
  }

  const attached = MeshBuilder.CreateBox(attachedName, { size: 0.18 }, scene);
  attached.parent = socketNode;
  attached.position = new Vector3(0, 0.12, 0);

  const material = new StandardMaterial(`__ATTACHED__MAT__${id}`, scene);
  material.diffuseColor = new Color3(0.2, 0.8, 1.0);
  material.emissiveColor = new Color3(0.05, 0.2, 0.25);
  attached.material = material;
};

export function attachActionRouter(ctx: ActionCtx): () => void {
  const defaults = captureArcDefaults(ctx.camera);

  const unsubscribe = onPick((detail) => {
    const camera = ctx.scene.activeCamera ?? ctx.camera;
    switch (detail.prefix) {
      case "HP__":
        handleHotspot(detail.id);
        break;
      case "NAV__":
        if (detail.id === "door") {
          handleNavDoor(ctx.scene, camera);
        }
        break;
      case "CAM__":
        if (detail.id === "spawn") {
          handleCameraSpawn(camera, defaults);
        }
        break;
      case "SOCKET__":
        handleSocketToggle(ctx.scene, detail.id);
        break;
      default:
        break;
    }
  });

  return () => unsubscribe();
}
