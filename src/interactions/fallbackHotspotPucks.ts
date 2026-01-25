import { Color3, MeshBuilder, StandardMaterial, TransformNode, Vector3, type Scene } from "@babylonjs/core";
import { hotspotCatalog } from "./hotspotCatalog";
import { fallbackHotspotLayout } from "./fallbackHotspotLayout";

const kindColors: Record<string, Color3> = {
  airway: new Color3(0.45, 0.9, 1.0),
  vent: new Color3(0.6, 0.8, 1.0),
  monitor: new Color3(0.9, 0.45, 0.45),
  cpr: new Color3(1.0, 0.4, 0.4),
  med: new Color3(0.8, 0.6, 1.0),
  hemodynamic: new Color3(1.0, 0.75, 0.35),
  diagnostic: new Color3(0.5, 0.9, 0.6),
  consult: new Color3(0.75, 0.75, 1.0),
  safety: new Color3(0.9, 0.9, 0.3)
};

const fallbackName = (id: string, label: string) => `HP__${id}__${label}`;

const resolveNode = (scene: Scene, name: string) =>
  scene.getTransformNodeByName(name) ?? scene.getMeshByName(name);

export const ensureFallbackHotspots = (scene: Scene) => {
  const created: TransformNode[] = [];
  hotspotCatalog.forEach((entry) => {
    const hasMesh = entry.meshNameHints.some((hint) => Boolean(resolveNode(scene, hint)));
    if (hasMesh) {
      return;
    }
    const name = fallbackName(entry.id, entry.label);
    if (resolveNode(scene, name)) {
      return;
    }
    const node = new TransformNode(name, scene);
    const pos = fallbackHotspotLayout[entry.id] ?? Vector3.Zero();
    node.position = pos.clone();

    const puck = MeshBuilder.CreateDisc(`${name}__puck`, { radius: 0.07, tessellation: 24 }, scene);
    puck.parent = node;
    puck.position = Vector3.Zero();
    puck.rotation.x = Math.PI / 2;
    puck.isPickable = true;
    puck.billboardMode = 7;

    const material = new StandardMaterial(`${name}__mat`, scene);
    const color = kindColors[entry.kind] ?? new Color3(0.6, 0.9, 1.0);
    material.diffuseColor = color.scale(0.4);
    material.emissiveColor = color;
    material.alpha = 0.9;
    puck.material = material;

    created.push(node);
  });
  return created;
};
