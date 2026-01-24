import {
  Color3,
  HighlightLayer,
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
const HIGHLIGHT_MS = 250;

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

export function wirePlaceholders(scene: Scene): { count: number; dispose: () => void } {
  const pickSpheres: Mesh[] = [];
  const placeholderNames = new Set<string>();

  for (const mesh of scene.meshes) {
    mesh.isPickable = false;
    mesh.isNearPickable = false;
    const match = matchPrefix(mesh.name);
    if (match && mesh instanceof Mesh) {
      mesh.isPickable = true;
      mesh.isNearPickable = true;
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

  const highlightLayer = new HighlightLayer("m3d-placeholder-highlight", scene);
  let disposed = false;

  const highlightMesh = (mesh: Mesh) => {
    highlightLayer.addMesh(mesh, Color3.White());
    window.setTimeout(() => {
      if (!disposed) {
        highlightLayer.removeMesh(mesh);
      }
    }, HIGHLIGHT_MS);
  };

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
    if (match.node instanceof Mesh) {
      highlightMesh(match.node);
    } else if (pickedMesh instanceof Mesh) {
      highlightMesh(pickedMesh);
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
    highlightLayer.dispose();
    pickSpheres.forEach((sphere) => sphere.dispose(false, true));
  };

  return { count: placeholderNames.size, dispose };
}
