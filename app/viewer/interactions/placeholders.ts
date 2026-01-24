import {
  Color3,
  Mesh,
  MeshBuilder,
  Node,
  PointerEventTypes,
  Scene,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import { emitPick } from "./m3dEvents";

const PLACEHOLDER_PREFIXES = ["HP__", "SOCKET__", "NAV__", "CAM__", "COLLIDER__", "UI__"] as const;
const PICK_SPHERE_DIAMETER = 0.25;
const OUTLINE_FLASH_MS = 160;
const OUTLINE_WIDTH = 0.06;

type PlaceholderPrefixMatch = {
  prefix: string;
  name: string;
};

type PlaceholderMatch = PlaceholderPrefixMatch & {
  node: Node;
};

const matchPrefix = (name: string): PlaceholderPrefixMatch | null => {
  for (const prefix of PLACEHOLDER_PREFIXES) {
    if (name.startsWith(prefix)) {
      return { prefix, name };
    }
  }
  return null;
};

const findPlaceholderAncestor = (node: Node | null): PlaceholderMatch | null => {
  let current: Node | null = node;
  while (current) {
    const match = matchPrefix(current.name);
    if (match) {
      return { ...match, node: current };
    }
    current = current.parent;
  }
  return null;
};

const createPickSphere = (scene: Scene, node: TransformNode) => {
  const sphere = MeshBuilder.CreateSphere(`__pick__${node.name}`, { diameter: PICK_SPHERE_DIAMETER }, scene);
  sphere.isVisible = false;
  sphere.isPickable = true;
  sphere.isNearPickable = true;
  sphere.parent = node;
  sphere.position = Vector3.Zero();
  sphere.metadata = {
    ...(sphere.metadata ?? {}),
    isPlaceholderPickProxy: true
  };
  return sphere;
};

const findVisibleMesh = (mesh: Mesh): Mesh => {
  let current: Node | null = mesh;
  while (current) {
    if (current instanceof Mesh && current.isVisible !== false) {
      return current;
    }
    current = current.parent;
  }
  return mesh;
};

const flashOutline = (mesh: Mesh, isDisposed?: () => boolean) => {
  const targetMesh = findVisibleMesh(mesh);
  const prev = {
    renderOutline: targetMesh.renderOutline,
    outlineWidth: targetMesh.outlineWidth,
    outlineColor: targetMesh.outlineColor.clone()
  };

  targetMesh.renderOutline = true;
  targetMesh.outlineWidth = OUTLINE_WIDTH;
  targetMesh.outlineColor = Color3.White();

  window.setTimeout(() => {
    if (isDisposed?.()) {
      return;
    }
    targetMesh.renderOutline = prev.renderOutline;
    targetMesh.outlineWidth = prev.outlineWidth;
    targetMesh.outlineColor = prev.outlineColor;
  }, OUTLINE_FLASH_MS);
};

export function wirePlaceholders(scene: Scene): { count: number; dispose: () => void } {
  const pickSpheres: Mesh[] = [];
  const placeholderNames = new Set<string>();
  let disposed = false;

  for (const mesh of scene.meshes) {
    mesh.isPickable = true;
    mesh.isNearPickable = true;
    const match = matchPrefix(mesh.name);
    if (match && mesh instanceof Mesh) {
      placeholderNames.add(match.name);
    }
  }

  for (const node of scene.transformNodes) {
    const match = matchPrefix(node.name);
    if (!match) {
      continue;
    }
    placeholderNames.add(match.name);
    if (node instanceof Mesh) {
      node.isPickable = true;
      node.isNearPickable = true;
      continue;
    }
    const sphere = createPickSphere(scene, node);
    pickSpheres.push(sphere);
  }

  for (const sphere of pickSpheres) {
    sphere.isPickable = true;
    sphere.isNearPickable = true;
  }

  const placeholderList = Array.from(placeholderNames).sort();
  console.log("PLACEHOLDERS:", placeholderList);

  const observer = scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type !== PointerEventTypes.POINTERPICK) {
      return;
    }

    const pickedMesh = pointerInfo.pickInfo?.pickedMesh ?? null;
    if (!pickedMesh) {
      return;
    }

    const match = findPlaceholderAncestor(pickedMesh);
    if (!match) {
      return;
    }

    const id = match.name.slice(match.prefix.length);
    if (pickedMesh instanceof Mesh) {
      flashOutline(pickedMesh, () => disposed);
    }

    emitPick({
      prefix: match.prefix,
      id,
      name: match.name,
      pickedMeshName: pickedMesh.name,
      time: Date.now()
    });
  });

  const dispose = () => {
    if (observer) {
      scene.onPointerObservable.remove(observer);
    }
    disposed = true;
    pickSpheres.forEach((sphere) => sphere.dispose(false, true));
  };

  return { count: placeholderNames.size, dispose };
}
