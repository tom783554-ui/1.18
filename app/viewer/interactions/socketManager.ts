import {
  AbstractMesh,
  Color3,
  MeshBuilder,
  Scene,
  SceneLoader,
  StandardMaterial,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import { onSocketToggle, type M3DSocketToggle } from "./socketEvents";

const equipmentPath = (assetKey: string) => `/equipment/${assetKey}.glb`;

type SocketEntry = {
  id: string;
  node: TransformNode | AbstractMesh;
};

const isSocketName = (name: string) => name.toUpperCase().startsWith("SOCKET__");
const parseSocketId = (name: string) => name.slice("SOCKET__".length).split("__")[0].trim();

const attachedRootName = (socketId: string) => `__ATTACHED_ROOT__${socketId}`;

const createPlaceholderDevice = (scene: Scene, socketId: string): AbstractMesh => {
  const root = new TransformNode(attachedRootName(socketId), scene);

  const box = MeshBuilder.CreateBox(`__ATTACHED_BOX__${socketId}`, { size: 0.22 }, scene);
  box.parent = root;
  box.position = new Vector3(0, 0.12, 0);

  const mat = new StandardMaterial(`__ATTACHED_MAT__${socketId}`, scene);
  mat.diffuseColor = new Color3(0.8, 0.2, 1.0);
  mat.emissiveColor = new Color3(0.12, 0.03, 0.18);
  box.material = mat;

  return box;
};

const scaleToTargetSize = (meshes: AbstractMesh[], targetMeters: number) => {
  let min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  let max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

  meshes.forEach((m) => {
    const bi = m.getBoundingInfo?.();
    if (!bi) return;
    const bmin = bi.boundingBox.minimumWorld;
    const bmax = bi.boundingBox.maximumWorld;
    min = Vector3.Minimize(min, bmin);
    max = Vector3.Maximize(max, bmax);
  });

  const size = max.subtract(min);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDim) || maxDim <= 0.0001) return;

  const s = targetMeters / maxDim;
  meshes.forEach((m) => (m.scaling = m.scaling.scale(s)));
};

export function createSocketManager(scene: Scene): {
  refresh: () => void;
  toggle: (socketId: string, assetKey?: string) => Promise<void>;
  hasSocket: (socketId: string) => boolean;
  dispose: () => void;
} {
  const sockets = new Map<string, SocketEntry>();

  const build = () => {
    sockets.clear();
    const nodes: Array<TransformNode | AbstractMesh> = [...scene.transformNodes, ...scene.meshes];
    nodes.forEach((n) => {
      if (!isSocketName(n.name)) return;
      const id = parseSocketId(n.name);
      if (!id) return;
      sockets.set(id, { id, node: n });
    });
  };

  const detach = (socketId: string) => {
    const rootName = attachedRootName(socketId);
    const existingRoot = scene.getTransformNodeByName(rootName);
    if (existingRoot) {
      existingRoot.dispose(false, true);
      return true;
    }
    const legacy = scene.getMeshByName(`__ATTACHED__${socketId}`);
    if (legacy) {
      legacy.dispose(false, true);
      return true;
    }
    return false;
  };

  const attach = async (socketId: string, assetKey?: string) => {
    const entry = sockets.get(socketId);
    if (!entry) return;

    const root = new TransformNode(attachedRootName(socketId), scene);
    root.parent = entry.node;
    root.position = Vector3.Zero();
    root.rotation = Vector3.Zero();
    root.scaling = new Vector3(1, 1, 1);

    const key = (assetKey ?? socketId).trim();
    const path = equipmentPath(key);

    try {
      const result = await SceneLoader.ImportMeshAsync("", "", path, scene);
      const imported = result.meshes.filter((m) => m && m.name !== "__root__") as AbstractMesh[];

      imported.forEach((m) => {
        m.parent = root;
        m.isPickable = false;
      });

      root.position = new Vector3(0, 0.0, 0);

      scaleToTargetSize(imported, 0.6);
      return;
    } catch {
      const box = createPlaceholderDevice(scene, socketId);
      const placeholderRoot = box.parent as TransformNode;
      placeholderRoot.parent = entry.node;
      return;
    }
  };

  const toggle = async (socketId: string, assetKey?: string) => {
    if (!sockets.has(socketId)) return;
    const removed = detach(socketId);
    if (removed) return;
    await attach(socketId, assetKey);
  };

  build();

  const off = onSocketToggle(async (t: M3DSocketToggle) => {
    await toggle(t.socketId, t.assetKey);
  });

  return {
    refresh: () => build(),
    toggle,
    hasSocket: (socketId: string) => sockets.has(socketId),
    dispose: () => {
      off();
    }
  };
}
