import {
  AbstractMesh,
  Camera,
  Color3,
  HighlightLayer,
  Matrix,
  Mesh,
  MeshBuilder,
  PointerEventTypes,
  Scene,
  TransformNode,
  Vector3
} from "@babylonjs/core";
import {
  AdvancedDynamicTexture,
  Control,
  Ellipse,
  Line,
  Rectangle,
  TextBlock
} from "@babylonjs/gui";
import { emitPick } from "./m3dEvents";
import { setM3dPick } from "../utils/m3dDebug";

const PANEL_EVENT = "m3d:panel" as const;

export type HotspotEntry = {
  prefix: string;
  id: string;
  label: string;
  type?: string;
  node: TransformNode | AbstractMesh;
  pickMesh: AbstractMesh;
  sourceName: string;
  radius: number;
};

type HotspotSystemOptions = {
  scene: Scene;
  camera: Camera;
  uiRef: { current: AdvancedDynamicTexture | null };
  highlightLayerRef: { current: HighlightLayer | null };
  selectedRef: { current: HotspotEntry | null };
};

type HudElements = {
  marker: Ellipse;
  line: Line;
  panel: Rectangle;
  title: TextBlock;
  details: TextBlock;
  debug: TextBlock;
};

const INTERACTIVE_PREFIXES = ["HS__", "HOTSPOT__", "HP__", "SOCKET__", "NAV__", "CAM__"] as const;
const getPrefix = (name: string): string | null => {
  const upper = name.toUpperCase();
  for (const prefix of INTERACTIVE_PREFIXES) {
    if (upper.startsWith(prefix)) {
      return prefix;
    }
  }
  return null;
};
const DEFAULT_RADIUS = 0.12;
const PANEL_WIDTH = 260;
const PANEL_HEIGHT = 116;
const PANEL_PADDING = 24;

const getNodePosition = (node: TransformNode | AbstractMesh) => {
  if (typeof node.getAbsolutePosition === "function") {
    return node.getAbsolutePosition();
  }
  return node.position;
};

const parseName = (name: string) => {
  const parts = name.split("__");
  if (parts.length >= 2) {
    const id = parts[1] || name;
    const label = parts[2] || id;
    return { id, label };
  }
  return { id: name, label: name };
};

const getMetadata = (node: TransformNode | AbstractMesh) => {
  const metadata = (node as { metadata?: Record<string, unknown> | null }).metadata;
  const hotspotMeta = (metadata?.hotspot as Record<string, unknown> | undefined) ?? null;
  if (hotspotMeta) {
    return {
      id: String(hotspotMeta.id ?? hotspotMeta.hotspotId ?? node.name),
      label: String(hotspotMeta.label ?? hotspotMeta.id ?? node.name),
      type: hotspotMeta.type ? String(hotspotMeta.type) : undefined,
      radius: hotspotMeta.radius ? Number(hotspotMeta.radius) : undefined
    };
  }
  if (metadata && (metadata.hotspotId || metadata.label || metadata.type)) {
    return {
      id: String(metadata.hotspotId ?? node.name),
      label: String(metadata.label ?? metadata.hotspotId ?? node.name),
      type: metadata.type ? String(metadata.type) : undefined,
      radius: metadata.radius ? Number(metadata.radius) : undefined
    };
  }
  const parsed = parseName(node.name);
  return { id: parsed.id, label: parsed.label };
};

const isRenderableMesh = (mesh: AbstractMesh) => mesh.getTotalVertices?.() > 0;

const createPickCollider = (
  scene: Scene,
  node: TransformNode | AbstractMesh,
  radius: number,
  id: string
): AbstractMesh => {
  const collider = MeshBuilder.CreateSphere(`HS__COLLIDER__${id}`, { diameter: radius * 2 }, scene);
  collider.parent = node;
  collider.isVisible = false;
  collider.isPickable = true;
  collider.position = Vector3.Zero();
  collider.metadata = {
    hotspotId: id,
    label: id,
    type: "hotspot",
    radius,
    __hotspotCollider: true
  };
  return collider;
};

const resolveHighlightMesh = (mesh: AbstractMesh): Mesh | null => {
  if (mesh instanceof Mesh) {
    return mesh;
  }
  const maybeSource = (mesh as { sourceMesh?: Mesh }).sourceMesh;
  if (maybeSource instanceof Mesh) {
    return maybeSource;
  }
  return null;
};

const shouldTreatAsHotspot = (node: TransformNode | AbstractMesh) => {
  const metadata = (node as { metadata?: Record<string, unknown> | null }).metadata;
  return Boolean(getPrefix(node.name) || metadata?.hotspot || metadata?.hotspotId);
};

const buildHotspots = (
  scene: Scene,
  colliders: AbstractMesh[],
  hotspotMap: Map<number, HotspotEntry>
): HotspotEntry[] => {
  hotspotMap.clear();
  const entries: HotspotEntry[] = [];

  const nodes: Array<TransformNode | AbstractMesh> = [
    ...scene.transformNodes,
    ...scene.meshes
  ];

  nodes.forEach((node) => {
    if (!shouldTreatAsHotspot(node)) {
      return;
    }

    const meta = getMetadata(node);
    const radius = Number.isFinite(meta.radius) ? (meta.radius as number) : DEFAULT_RADIUS;
    const prefix = getPrefix(node.name) ?? "HS__";

    let pickMesh: AbstractMesh;
    if (node instanceof AbstractMesh && isRenderableMesh(node)) {
      node.isPickable = true;
      pickMesh = node;
    } else {
      pickMesh = createPickCollider(scene, node, radius, meta.id);
      colliders.push(pickMesh);
    }

    const entry: HotspotEntry = {
      prefix,
      id: meta.id,
      label: meta.label,
      type: meta.type ?? "hotspot",
      node,
      pickMesh,
      sourceName: node.name,
      radius
    };

    hotspotMap.set(pickMesh.uniqueId, entry);
    if (node instanceof AbstractMesh) {
      hotspotMap.set(node.uniqueId, entry);
    } else {
      hotspotMap.set(node.uniqueId, entry);
    }
    entries.push(entry);
  });

  return entries;
};

const createTestHotspots = (scene: Scene, camera: Camera): TransformNode[] => {
  if (process.env.NODE_ENV === "production") {
    return [];
  }
  const forward = camera.getDirection(Vector3.Forward()).normalize();
  const base = camera.position.add(forward.scale(2.4));
  const offsets = [
    new Vector3(-0.4, 0.2, 0),
    new Vector3(0.2, 0.4, 0.1),
    new Vector3(0.4, -0.1, -0.1)
  ];

  const nodes: TransformNode[] = [];
  offsets.forEach((offset, index) => {
    const node = new TransformNode(`HS__Test${index + 1}__Demo`, scene);
    node.position = base.add(offset);
    node.metadata = {
      hotspotId: `Test${index + 1}`,
      label: `Test Hotspot ${index + 1}`,
      type: "hotspot",
      radius: 0.12
    };

    const collider = createPickCollider(scene, node, 0.12, `Test${index + 1}`);
    collider.parent = node;

    const visible = MeshBuilder.CreateSphere(`HS__VISIBLE__${index + 1}`, { diameter: 0.06 }, scene);
    visible.parent = node;
    visible.isPickable = false;
    visible.visibility = 0.9;
    visible.position = Vector3.Zero();
    visible.metadata = { __debugOnly: true };
    visible.renderOutline = true;
    visible.outlineWidth = 0.02;
    visible.outlineColor = new Color3(0.2 + index * 0.2, 0.6, 1.0);
    nodes.push(node);
  });
  return nodes;
};

const ensureHighlightLayer = (scene: Scene, ref: { current: HighlightLayer | null }) => {
  if (!ref.current) {
    ref.current = new HighlightLayer("hotspot-highlight", scene, {
      blurHorizontalSize: 0.8,
      blurVerticalSize: 0.8
    });
  }
  return ref.current;
};

const ensureHud = (scene: Scene, ref: { current: AdvancedDynamicTexture | null }): HudElements => {
  if (!ref.current) {
    ref.current = AdvancedDynamicTexture.CreateFullscreenUI("hotspot-ui", true, scene);
  }
  const ui = ref.current;

  const marker = new Ellipse("hotspot-marker");
  marker.widthInPixels = 16;
  marker.heightInPixels = 16;
  marker.color = "white";
  marker.thickness = 2;
  marker.background = "rgba(255,255,255,0.1)";
  marker.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  marker.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  marker.isVisible = false;
  ui.addControl(marker);

  const line = new Line("hotspot-line");
  line.lineWidth = 2;
  line.color = "white";
  line.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  line.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  line.isVisible = false;
  ui.addControl(line);

  const panel = new Rectangle("hotspot-panel");
  panel.widthInPixels = PANEL_WIDTH;
  panel.heightInPixels = PANEL_HEIGHT;
  panel.cornerRadius = 10;
  panel.color = "rgba(255,255,255,0.2)";
  panel.thickness = 1;
  panel.background = "rgba(10,10,12,0.85)";
  panel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  panel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  panel.isVisible = false;
  ui.addControl(panel);

  const title = new TextBlock("hotspot-title");
  title.color = "#f8fafc";
  title.fontSize = 16;
  title.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  title.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  title.paddingTopInPixels = 12;
  title.paddingLeftInPixels = 12;
  title.paddingRightInPixels = 12;
  title.height = "28px";
  title.text = "";
  panel.addControl(title);

  const details = new TextBlock("hotspot-details");
  details.color = "#cbd5f5";
  details.fontSize = 12;
  details.textWrapping = true;
  details.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  details.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  details.paddingLeftInPixels = 12;
  details.paddingRightInPixels = 12;
  details.paddingTopInPixels = 44;
  details.height = "60px";
  details.text = "";
  panel.addControl(details);

  const debug = new TextBlock("hotspot-debug");
  debug.color = "#e2e8f0";
  debug.fontSize = 12;
  debug.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  debug.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
  debug.paddingLeftInPixels = 10;
  debug.paddingTopInPixels = 10;
  debug.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
  debug.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
  debug.text = "";
  ui.addControl(debug);

  return { marker, line, panel, title, details, debug };
};

export function attachHotspotSystem({
  scene,
  camera,
  uiRef,
  highlightLayerRef,
  selectedRef
}: HotspotSystemOptions): { refresh: () => void; dispose: () => void } {
  const createdColliders: AbstractMesh[] = [];
  const testNodes: TransformNode[] = [];
  const hotspotMap = new Map<number, HotspotEntry>();
  const hud = ensureHud(scene, uiRef);
  const highlightLayer = ensureHighlightLayer(scene, highlightLayerRef);
  let hotspots: HotspotEntry[] = [];

  let lastPointer = { x: 0, y: 0 };
  let lastPick = "none";

  const updateHudVisibility = (visible: boolean) => {
    hud.marker.isVisible = visible;
    hud.line.isVisible = visible;
    hud.panel.isVisible = visible;
  };

  const closePanel = () => {
    if (typeof window === "undefined") {
      return;
    }
    window.dispatchEvent(new CustomEvent(PANEL_EVENT, { detail: { open: false, title: "", id: "" } }));
  };

  const deselect = () => {
    selectedRef.current = null;
    highlightLayer.removeAllMeshes();
    updateHudVisibility(false);
    closePanel();
  };

  const selectHotspot = (entry: HotspotEntry, pickedMesh?: AbstractMesh | null) => {
    selectedRef.current = entry;
    highlightLayer.removeAllMeshes();
    const highlightMesh = resolveHighlightMesh(pickedMesh ?? entry.pickMesh);
    if (highlightMesh) {
      highlightLayer.addMesh(highlightMesh, Color3.White());
    }
    hud.title.text = entry.label || entry.id;
    updateHudVisibility(true);
    setM3dPick(entry.id, pickedMesh?.name ?? entry.pickMesh.name);
  };

  const resolveHotspotFromMesh = (mesh: AbstractMesh | null | undefined) => {
    if (!mesh) {
      return null;
    }
    const direct = hotspotMap.get(mesh.uniqueId);
    if (direct) {
      return direct;
    }
    let current: TransformNode | AbstractMesh | null = mesh.parent as TransformNode | AbstractMesh | null;
    while (current) {
      const found = hotspotMap.get(current.uniqueId);
      if (found) {
        return found;
      }
      current = current.parent as TransformNode | AbstractMesh | null;
    }
    return null;
  };

  const isHotspotMesh = (mesh: AbstractMesh) => {
    if (!mesh.isPickable) {
      return false;
    }
    if (hotspotMap.has(mesh.uniqueId)) {
      return true;
    }
    if (getPrefix(mesh.name)) {
      return true;
    }
    const metadata = (mesh as { metadata?: Record<string, unknown> | null }).metadata;
    if (metadata?.hotspot || metadata?.hotspotId) {
      return true;
    }
    if (mesh.parent && hotspotMap.has(mesh.parent.uniqueId)) {
      return true;
    }
    return false;
  };

  const updateHudLayout = () => {
    const engine = scene.getEngine();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();

    const panelLeft = width - PANEL_WIDTH - PANEL_PADDING;
    const panelTop = Math.max(20, (height - PANEL_HEIGHT) * 0.5);

    hud.panel.leftInPixels = panelLeft;
    hud.panel.topInPixels = panelTop;

    const selected = selectedRef.current;
    if (!selected) {
      hud.debug.text = `lastPointer: ${Math.round(lastPointer.x)}, ${Math.round(lastPointer.y)}\nlastPick: ${lastPick}\nselected: —`;
      return;
    }

    const worldPos = getNodePosition(selected.node);
    const viewport = camera.viewport.toGlobal(width, height);
    const projected = Vector3.Project(worldPos, Matrix.Identity(), scene.getTransformMatrix(), viewport);

    if (!Number.isFinite(projected.x) || projected.z < 0 || projected.z > 1) {
      updateHudVisibility(false);
      return;
    }

    hud.marker.leftInPixels = projected.x - hud.marker.widthInPixels / 2;
    hud.marker.topInPixels = projected.y - hud.marker.heightInPixels / 2;

    hud.line.x1 = projected.x;
    hud.line.y1 = projected.y;
    hud.line.x2 = panelLeft;
    hud.line.y2 = panelTop + PANEL_HEIGHT * 0.5;

    const distance = Vector3.Distance(camera.position, worldPos);
    hud.details.text = `Prefix: ${selected.prefix}\nID: ${selected.id}\nDistance: ${distance.toFixed(2)}m\nNode: ${selected.sourceName}`;
    hud.debug.text = `lastPointer: ${Math.round(lastPointer.x)}, ${Math.round(lastPointer.y)}\nlastPick: ${lastPick}\nselected: ${selected.id}`;
  };

  const refresh = () => {
    deselect();
    createdColliders.splice(0).forEach((collider) => collider.dispose(false, true));
    testNodes.splice(0).forEach((node) => node.dispose(false, true));

    hotspots = buildHotspots(scene, createdColliders, hotspotMap);
    if (hotspots.length === 0) {
      testNodes.push(...createTestHotspots(scene, camera));
      hotspots = buildHotspots(scene, createdColliders, hotspotMap);
    }

    hotspots.forEach((entry) => {
      if (!entry.pickMesh.isPickable) {
        entry.pickMesh.isPickable = true;
      }
    });
  };

  const pointerObserver = scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type !== PointerEventTypes.POINTERPICK) {
      return;
    }

    lastPointer = { x: scene.pointerX, y: scene.pointerY };
    const pickInfo = pointerInfo.pickInfo ?? null;
    const pickedMesh = pickInfo?.pickedMesh ?? null;
    lastPick = pickedMesh?.name ?? "none";

    if (pickInfo?.hit && pickedMesh && isHotspotMesh(pickedMesh)) {
      const entry = resolveHotspotFromMesh(pickedMesh);
      if (entry) {
        selectHotspot(entry, pickedMesh);
        // Avoid duplicating HP__/SOCKET__/NAV__/CAM picks which are already emitted by placeholders.ts.
        if (entry.prefix === "HS__" || entry.prefix === "HOTSPOT__") {
          emitPick({
            prefix: entry.prefix,
            id: entry.id,
            name: entry.label,
            pickedMeshName: pickedMesh.name,
            time: Date.now()
          });
        }
        return;
      }
    }

    deselect();
  });

  const beforeRenderObserver = scene.onBeforeRenderObservable.add(() => {
    updateHudLayout();
  });

  return {
    refresh,
    dispose: () => {
      scene.onPointerObservable.remove(pointerObserver);
      scene.onBeforeRenderObservable.remove(beforeRenderObserver);
      deselect();
      createdColliders.splice(0).forEach((collider) => collider.dispose(false, true));
      testNodes.splice(0).forEach((node) => node.dispose(false, true));
      highlightLayer.dispose();
      uiRef.current?.dispose();
      uiRef.current = null;
      highlightLayerRef.current = null;
    }
  };
}
