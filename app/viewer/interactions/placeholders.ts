import {
  AbstractMesh,
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

type PlaceholderPrefixMatch = {
  prefix: string;
  name: string;
};

type PlaceholderMatch = PlaceholderPrefixMatch & {
  node: Node;
};

type PlaceholderPickProxyMetadata = {
  isPlaceholderPickProxy?: boolean;
  placeholderTarget?: TransformNode;
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
  sphere.isVisible = true;
  sphere.visibility = 0;
  sphere.isPickable = true;
  sphere.isNearPickable = true;
  sphere.parent = node;
  sphere.position = Vector3.Zero();
  const metadata: PlaceholderPickProxyMetadata = {
    ...(sphere.metadata as PlaceholderPickProxyMetadata | null),
    isPlaceholderPickProxy: true,
    placeholderTarget: node
  };
  sphere.metadata = metadata;
  return sphere;
};

const setAbstractMeshPickable = (mesh: AbstractMesh) => {
  mesh.isPickable = true;
  mesh.isNearPickable = true;
  if (mesh instanceof Mesh) {
    for (const child of mesh.getChildMeshes()) {
      child.isPickable = true;
      child.isNearPickable = true;
    }
  }
};

const resolvePickedTarget = (pickedMesh: Mesh): Node => {
  const metadata = pickedMesh.metadata as PlaceholderPickProxyMetadata | null;
  if (metadata?.isPlaceholderPickProxy) {
    const proxyTarget = metadata.placeholderTarget;
    if (proxyTarget) {
      return proxyTarget;
    }
    if (pickedMesh.parent) {
      return pickedMesh.parent;
    }
  }
  return pickedMesh;
};

export function wirePlaceholders(scene: Scene): { count: number; dispose: () => void } {
  const pickSpheres: Mesh[] = [];
  const placeholderNames = new Set<string>();

  for (const mesh of scene.meshes) {
    mesh.isPickable = false;
    mesh.isNearPickable = false;
  }

  for (const mesh of scene.meshes) {
    const match = matchPrefix(mesh.name);
    if (!match) {
      continue;
    }
    placeholderNames.add(match.name);
    setAbstractMeshPickable(mesh);
  }

  for (const node of scene.transformNodes) {
    const match = matchPrefix(node.name);
    if (!match) {
      continue;
    }
    placeholderNames.add(match.name);
    if (node instanceof Mesh) {
      setAbstractMeshPickable(node);
      continue;
    }
    const sphere = createPickSphere(scene, node);
    pickSpheres.push(sphere);
  }

  const placeholderList = Array.from(placeholderNames).sort();
  console.log("PLACEHOLDERS:", placeholderList);

  const observer = scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type !== PointerEventTypes.POINTERPICK) {
      return;
    }

    const pickedMesh = pointerInfo.pickInfo?.pickedMesh ?? null;
    if (!pickedMesh || !(pickedMesh instanceof Mesh)) {
      return;
    }

    const targetNode = resolvePickedTarget(pickedMesh);
    const match = findPlaceholderAncestor(targetNode);
    if (!match) {
      return;
    }

    const rest = match.name.slice(match.prefix.length);
    const parts = rest.split("__");
    const id = (parts[0] ?? "").trim();
    const label = (parts[1] ?? "").trim() || id;

    if (!id) {
      console.warn("BAD_PLACEHOLDER_NAME (missing id):", match.name);
      return;
    }

    emitPick({
      prefix: match.prefix,
      id,
      name: match.name,
      label,
      pickedMeshName: pickedMesh.name,
      pickedNodeName: match.node.name,
      time: Date.now()
    });
  });

  const dispose = () => {
    if (observer) {
      scene.onPointerObservable.remove(observer);
    }
    pickSpheres.forEach((sphere) => sphere.dispose(false, true));
  };

  return { count: placeholderNames.size, dispose };
}
