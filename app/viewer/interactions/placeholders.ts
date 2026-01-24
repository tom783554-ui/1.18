import { Scene } from "@babylonjs/core";

const PLACEHOLDER_PREFIXES = ["HP__", "SOCKET__", "NAV__", "CAM__", "COLLIDER__", "UI__"] as const;

type PlaceholderPrefixMatch = {
  prefix: string;
  name: string;
};

const matchPrefix = (name: string): PlaceholderPrefixMatch | null => {
  for (const prefix of PLACEHOLDER_PREFIXES) {
    if (name.startsWith(prefix)) {
      return { prefix, name };
    }
  }
  return null;
};

export function wirePlaceholders(scene: Scene): { count: number; dispose: () => void } {
  const placeholderNames = new Set<string>();

  for (const mesh of scene.meshes) {
    const match = matchPrefix(mesh.name);
    if (!match) {
      continue;
    }
    placeholderNames.add(match.name);
  }

  for (const node of scene.transformNodes) {
    const match = matchPrefix(node.name);
    if (!match) {
      continue;
    }
    placeholderNames.add(match.name);
  }

  const placeholderList = Array.from(placeholderNames).sort();
  console.log("PLACEHOLDERS:", placeholderList);

  const dispose = () => {};

  return { count: placeholderNames.size, dispose };
}
