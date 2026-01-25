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
import { emitHotspotRegistry } from "./hotspotRegistryEvents";
import {
  clearHotspotProjection,
  setHotspotProjection,
  setHotspotSelection
} from "./hotspotProjectionStore";
import { getEngineState, subscribe } from "../../../src/engine/store";
import type { PatientState } from "../../../src/engine/patientState";
import type { HotspotActionContext, HotspotEntry as CodeBlueHotspotEntry } from "../../../src/sim/codeblue/loadCodeBlueHotspots";
import { setM3dPick } from "../utils/m3dDebug";

const PANEL_EVENT = "m3d:panel" as const;
const emitPanelClose = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(PANEL_EVENT, { detail: { open: false, title: "", id: "" } }));
};

const emitPanelOpen = (title: string, id: string) => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(PANEL_EVENT, { detail: { open: true, title, id } }));
};

export type HotspotEntry = {
  prefix: string;
  id: string;
  label: string;
  type?: string;
  node: TransformNode | AbstractMesh;
  pickMesh: AbstractMesh;
  sourceName: string;
  radius: number;
  category?: string;
  onClick?: (ctx: HotspotActionContext) => void;
};

type HotspotSystemOptions = {
  scene: Scene;
  camera: Camera;
  uiRef: { current: AdvancedDynamicTexture | null };
  highlightLayerRef: { current: HighlightLayer | null };
  selectedRef: { current: HotspotEntry | null };
  onDeselect?: () => void;
  entries?: CodeBlueHotspotEntry[];
  actionContext?: HotspotActionContext;
};

type HudElements = {
  marker: Ellipse;
  line: Line;
  panel: Rectangle;
  title: TextBlock;
  details: TextBlock;
  debug: TextBlock;
};

const INTERACTIVE_NAME_REGEX =
  /^(HS__|HOTSPOT__|HP__|NAV__|CAM__|SOCKET__|hs__|hotspot__|hp__|nav__|cam__|socket__)/i;
const DEFAULT_RADIUS = 0.12;
const PANEL_WIDTH = 200;
const PANEL_HEIGHT = 140;
const PANEL_PADDING = 12;
const PANEL_OFFSET = 14;
const MONITOR_PANEL_SIZE = 170;

const getNodePosition = (node: TransformNode | AbstractMesh) => {
  if (typeof node.getAbsolutePosition === "function") {
    return node.getAbsolutePosition();
  }
  return node.position;
};

const getNodeWorldCenter = (node: TransformNode | AbstractMesh) => {
  if (node instanceof AbstractMesh) {
    const info = node.getBoundingInfo?.();
    if (info) {
      return info.boundingBox.centerWorld;
    }
  }
  return getNodePosition(node);
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const normalizePrefix = (prefix?: string | null) => {
  if (!prefix) {
    return "HS__";
  }
  const upper = prefix.toUpperCase();
  return upper.endsWith("__") ? upper : `${upper}__`;
};

const parseName = (name: string) => {
  const parts = name.split("__");
  if (parts.length >= 2) {
    const prefix = normalizePrefix(`${parts[0]}__`);
    const id = parts[1] || name;
    const label = parts[2] || id;
    return { prefix, id, label };
  }
  return { prefix: "HS__", id: name, label: name };
};

const getMetadata = (node: TransformNode | AbstractMesh) => {
  const metadata = (node as { metadata?: Record<string, unknown> | null }).metadata;
  const hotspotMeta = (metadata?.hotspot as Record<string, unknown> | undefined) ?? null;
  const parsed = parseName(node.name);
  if (hotspotMeta) {
    const prefixOverride = hotspotMeta.prefix ?? hotspotMeta.kind;
    return {
      prefix: normalizePrefix(
        typeof prefixOverride === "string" ? prefixOverride : parsed.prefix
      ),
      id: String(hotspotMeta.id ?? hotspotMeta.hotspotId ?? parsed.id),
      label: String(hotspotMeta.label ?? hotspotMeta.id ?? parsed.label),
      type: hotspotMeta.type ? String(hotspotMeta.type) : undefined,
      radius: hotspotMeta.radius ? Number(hotspotMeta.radius) : undefined
    };
  }
  if (metadata && (metadata.hotspotId || metadata.label || metadata.type)) {
    const prefixOverride = metadata.prefix ?? metadata.kind;
    return {
      prefix: normalizePrefix(
        typeof prefixOverride === "string" ? prefixOverride : parsed.prefix
      ),
      id: String(metadata.hotspotId ?? parsed.id),
      label: String(metadata.label ?? metadata.hotspotId ?? parsed.label),
      type: metadata.type ? String(metadata.type) : undefined,
      radius: metadata.radius ? Number(metadata.radius) : undefined
    };
  }
  return { prefix: parsed.prefix, id: parsed.id, label: parsed.label };
};

const isRenderableMesh = (mesh: AbstractMesh) => mesh.getTotalVertices?.() > 0;

const createPickCollider = (
  scene: Scene,
  node: TransformNode | AbstractMesh,
  radius: number,
  id: string,
  prefix: string,
  label: string,
  type?: string
): AbstractMesh => {
  const collider = MeshBuilder.CreateSphere(
    `${prefix}COLLIDER__${id}`,
    { diameter: radius * 2 },
    scene
  );
  collider.parent = node;
  collider.isVisible = false;
  collider.isPickable = true;
  collider.position = Vector3.Zero();
  collider.metadata = {
    prefix,
    hotspotId: id,
    label,
    type: type ?? "hotspot",
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

const shouldTreatAsInteractive = (node: TransformNode | AbstractMesh) => {
  const metadata = (node as { metadata?: Record<string, unknown> | null }).metadata;
  if (metadata?.__debugOnly === true) {
    return false;
  }
  return Boolean(INTERACTIVE_NAME_REGEX.test(node.name) || metadata?.hotspot || metadata?.hotspotId);
};

const buildHotspots = (
  scene: Scene,
  colliders: AbstractMesh[],
  hotspotMap: Map<number, HotspotEntry>,
  manifestEntries?: CodeBlueHotspotEntry[]
): HotspotEntry[] => {
  hotspotMap.clear();
  const entries: HotspotEntry[] = [];

  const nodes: Array<TransformNode | AbstractMesh> = [
    ...scene.transformNodes,
    ...scene.meshes
  ];

  if (manifestEntries && manifestEntries.length > 0) {
    manifestEntries.forEach((manifestEntry) => {
      const node =
        scene.getTransformNodeByName(manifestEntry.meshName) ??
        scene.getMeshByName(manifestEntry.meshName);
      if (!node) {
        return;
      }

      const meta = getMetadata(node);
      const radius = Number.isFinite(meta.radius) ? (meta.radius as number) : DEFAULT_RADIUS;

      let pickMesh: AbstractMesh;
      if (node instanceof AbstractMesh && isRenderableMesh(node)) {
        node.isPickable = true;
        pickMesh = node;
      } else {
        pickMesh = createPickCollider(
          scene,
          node,
          radius,
          manifestEntry.id,
          meta.prefix,
          manifestEntry.label,
          manifestEntry.type
        );
        colliders.push(pickMesh);
      }

      const entry: HotspotEntry = {
        prefix: meta.prefix,
        id: manifestEntry.id,
        label: manifestEntry.label,
        type: manifestEntry.type ?? meta.type ?? "hotspot",
        node,
        pickMesh,
        sourceName: node.name,
        radius,
        category: manifestEntry.category,
        onClick: manifestEntry.onClick
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
  }

  nodes.forEach((node) => {
    if (!shouldTreatAsInteractive(node)) {
      return;
    }

    const meta = getMetadata(node);
    const radius = Number.isFinite(meta.radius) ? (meta.radius as number) : DEFAULT_RADIUS;

    let pickMesh: AbstractMesh;
    if (node instanceof AbstractMesh && isRenderableMesh(node)) {
      node.isPickable = true;
      pickMesh = node;
    } else {
      pickMesh = createPickCollider(scene, node, radius, meta.id, meta.prefix, meta.label, meta.type);
      colliders.push(pickMesh);
    }

    const entry: HotspotEntry = {
      prefix: meta.prefix,
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
  const testHotspots = [
    { id: "Ventilator", label: "Ventilator", offset: new Vector3(-0.42, 0.18, 0.02) },
    { id: "Monitor", label: "Patient Monitor", offset: new Vector3(-0.08, 0.34, 0.12) },
    { id: "Suction", label: "Suction Regulator", offset: new Vector3(0.32, 0.22, -0.04) },
    { id: "IVPump", label: "IV Pump", offset: new Vector3(0.18, 0.05, 0.1) },
    { id: "Oxygen", label: "Oxygen Flow", offset: new Vector3(0.46, -0.08, -0.08) },
    { id: "BedRail", label: "Bed Rail", offset: new Vector3(-0.2, -0.18, -0.12) },
    { id: "CrashCart", label: "Crash Cart", offset: new Vector3(0.52, 0.12, 0.2) }
  ];

  const nodes: TransformNode[] = [];
  testHotspots.forEach((hotspot, index) => {
    const node = new TransformNode(`HP__${hotspot.id}__${hotspot.label}`, scene);
    node.position = base.add(hotspot.offset);
    node.metadata = {
      hotspotId: hotspot.id,
      label: hotspot.label,
      type: "hotspot",
      radius: 0.12
    };

    const collider = createPickCollider(
      scene,
      node,
      0.12,
      hotspot.id,
      "HP__",
      hotspot.label,
      "hotspot"
    );
    collider.parent = node;

    const visible = MeshBuilder.CreateSphere(
      `__DEBUG__VISIBLE__${index + 1}`,
      { diameter: 0.06 },
      scene
    );
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
  selectedRef,
  onDeselect,
  entries: manifestEntries,
  actionContext
}: HotspotSystemOptions): { refresh: () => void; dispose: () => void } {
  const createdColliders: AbstractMesh[] = [];
  const testNodes: TransformNode[] = [];
  const hotspotMap = new Map<number, HotspotEntry>();
  const hud = ensureHud(scene, uiRef);
  const highlightLayer = ensureHighlightLayer(scene, highlightLayerRef);
  let hotspots: HotspotEntry[] = [];
  let latestVitals: PatientState | null = getEngineState();
  const unsubscribeVitals = subscribe(() => {
    latestVitals = getEngineState();
  });

  let lastPointer = { x: 0, y: 0 };
  let lastPick = "none";
  let pingTarget: AbstractMesh | null = null;
  let pingBaseScale: Vector3 | null = null;
  let pingStartMs = 0;

  const updateHudVisibility = (visible: boolean) => {
    hud.marker.isVisible = visible;
    hud.line.isVisible = false;
    hud.panel.isVisible = visible;
  };

  const deselect = () => {
    selectedRef.current = null;
    highlightLayer.removeAllMeshes();
    updateHudVisibility(false);
    emitPanelClose();
    onDeselect?.();
    clearHotspotProjection();
    if (pingTarget && pingBaseScale) {
      pingTarget.scaling.copyFrom(pingBaseScale);
    }
    pingTarget = null;
    pingBaseScale = null;
  };

  const selectHotspot = (entry: HotspotEntry, pickedMesh?: AbstractMesh | null) => {
    if (selectedRef.current?.id === entry.id) {
      return;
    }
    selectedRef.current = entry;
    highlightLayer.removeAllMeshes();
    const highlightMesh = resolveHighlightMesh(pickedMesh ?? entry.pickMesh);
    if (highlightMesh) {
      highlightLayer.addMesh(highlightMesh, Color3.White());
    }
    hud.title.text = entry.label || entry.id;
    updateHudVisibility(true);
    emitPanelOpen(entry.label || entry.id, entry.id);
    setM3dPick(entry.id, pickedMesh?.name ?? entry.pickMesh.name);
    setHotspotSelection({ id: entry.id, label: entry.label });
    const pingMesh = highlightMesh ?? pickedMesh ?? entry.pickMesh;
    if (pingMesh) {
      if (pingTarget && pingBaseScale) {
        pingTarget.scaling.copyFrom(pingBaseScale);
      }
      pingTarget = pingMesh;
      pingBaseScale = pingMesh.scaling.clone();
      pingStartMs = performance.now();
    }
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
    if (shouldTreatAsInteractive(mesh)) {
      return true;
    }
    if (mesh.parent && hotspotMap.has(mesh.parent.uniqueId)) {
      return true;
    }
    return false;
  };

  const formatMonitorVitals = (vitals: PatientState | null) => {
    if (!vitals) {
      return "HR -- bpm\nSpO₂ --%\nRR -- /min\nMAP -- mmHg";
    }
    return [
      `HR ${Math.round(vitals.hr)} bpm`,
      `SpO₂ ${vitals.spo2.toFixed(1)}%`,
      `RR ${Math.round(vitals.rr)} /min`,
      `MAP ${Math.round(vitals.map)} mmHg`
    ].join("\n");
  };

  const updateHudLayout = () => {
    const engine = scene.getEngine();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();

    const selected = selectedRef.current;
    if (!selected) {
      updateHudVisibility(false);
      hud.debug.text = `lastPointer: ${Math.round(lastPointer.x)}, ${Math.round(lastPointer.y)}\nlastPick: ${lastPick}\nselected: —`;
      return;
    }

    const isMonitor = selected.id.toLowerCase().includes("monitor") || selected.label.toLowerCase().includes("monitor");
    const panelWidth = isMonitor ? MONITOR_PANEL_SIZE : PANEL_WIDTH;
    const panelHeight = isMonitor ? MONITOR_PANEL_SIZE : PANEL_HEIGHT;

    hud.panel.widthInPixels = panelWidth;
    hud.panel.heightInPixels = panelHeight;
    hud.panel.cornerRadius = isMonitor ? 8 : 10;
    hud.title.fontSize = isMonitor ? 14 : 16;
    hud.details.fontSize = isMonitor ? 12 : 11;
    hud.details.height = isMonitor ? `${panelHeight - 48}px` : "92px";
    hud.details.paddingTopInPixels = isMonitor ? 40 : 44;

    const worldPos = getNodeWorldCenter(selected.node);
    const viewport = camera.viewport.toGlobal(width, height);
    const projected = Vector3.Project(worldPos, Matrix.Identity(), scene.getTransformMatrix(), viewport);

    const projectionVisible = Number.isFinite(projected.x) && projected.z >= 0 && projected.z <= 1;
    if (!projectionVisible) {
      updateHudVisibility(false);
      setHotspotProjection({ x: 0, y: 0, visible: false });
      return;
    }

    hud.marker.leftInPixels = projected.x - hud.marker.widthInPixels / 2;
    hud.marker.topInPixels = projected.y - hud.marker.heightInPixels / 2;

    const clampedLeft = Math.min(
      Math.max(projected.x - panelWidth / 2, PANEL_PADDING),
      width - panelWidth - PANEL_PADDING
    );
    const aboveTop = projected.y - panelHeight - PANEL_OFFSET;
    const placeBelow = aboveTop < PANEL_PADDING;
    const panelTop = placeBelow
      ? Math.min(projected.y + PANEL_OFFSET, height - panelHeight - PANEL_PADDING)
      : aboveTop;
    const clampedTop = Math.min(Math.max(panelTop, PANEL_PADDING), height - panelHeight - PANEL_PADDING);

    hud.panel.leftInPixels = clampedLeft;
    hud.panel.topInPixels = clampedTop;

    if (isMonitor) {
      hud.title.text = "Monitor";
      hud.details.text = formatMonitorVitals(latestVitals);
    } else {
      const distance = Vector3.Distance(camera.position, worldPos);
      const position = `${round3(worldPos.x)}, ${round3(worldPos.y)}, ${round3(worldPos.z)}`;
      hud.details.text = [
        `ID: ${selected.id}`,
        `Label: ${selected.label || selected.id}`,
        `Type: ${selected.type ?? "hotspot"}`,
        `Distance: ${distance.toFixed(2)}m`,
        `Radius: ${selected.radius.toFixed(2)}m`,
        `World: ${position}`,
        `Node: ${selected.sourceName}`
      ].join("\n");
    }
    hud.debug.text = `lastPointer: ${Math.round(lastPointer.x)}, ${Math.round(lastPointer.y)}\nlastPick: ${lastPick}\nselected: ${selected.id}`;
    setHotspotProjection({ x: projected.x, y: projected.y, visible: true });
  };

  const refresh = () => {
    deselect();
    createdColliders.splice(0).forEach((collider) => collider.dispose(false, true));
    testNodes.splice(0).forEach((node) => node.dispose(false, true));

    const hasManifestEntries = Boolean(manifestEntries && manifestEntries.length > 0);
    hotspots = buildHotspots(scene, createdColliders, hotspotMap, manifestEntries);
    if (hotspots.length === 0 && !hasManifestEntries) {
      testNodes.push(...createTestHotspots(scene, camera));
      hotspots = buildHotspots(scene, createdColliders, hotspotMap, manifestEntries);
    }

    hotspots.forEach((entry) => {
      if (!entry.pickMesh.isPickable) {
        entry.pickMesh.isPickable = true;
      }
    });

    // Emit hotspot registry (for JSON export + debugging)
    try {
      const entries = hotspots.map((entry) => {
        const pos = getNodePosition(entry.node);
        return {
          prefix: entry.prefix,
          id: entry.id,
          label: entry.label ?? entry.id,
          nodeName: entry.sourceName ?? entry.node.name ?? entry.id,
          worldPos: [round3(pos.x), round3(pos.y), round3(pos.z)] as [number, number, number]
        };
      });
      emitHotspotRegistry({
        generatedAt: Date.now(),
        count: entries.length,
        entries
      });
    } catch (error) {
      console.warn("Failed to emit hotspot registry", error);
    }
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
        emitPick({
          prefix: entry.prefix ?? "HS__",
          id: entry.id,
          name: entry.sourceName ?? entry.node.name ?? entry.id,
          label: entry.label ?? entry.id,
          pickedMeshName: pickedMesh.name,
          pickedNodeName: entry.node.name ?? entry.sourceName ?? undefined,
          time: Date.now()
        });
        if (entry.onClick && actionContext) {
          entry.onClick(actionContext);
        }
        return;
      }
    }

    deselect();
  });

  const beforeRenderObserver = scene.onBeforeRenderObservable.add(() => {
    updateHudLayout();
    if (pingTarget && pingBaseScale) {
      const elapsed = (performance.now() - pingStartMs) / 1000;
      const duration = 1.2;
      if (elapsed >= duration) {
        pingTarget.scaling.copyFrom(pingBaseScale);
        pingTarget = null;
        pingBaseScale = null;
      } else {
        const intensity = 1 - elapsed / duration;
        const pulse = Math.sin(elapsed * 8) * intensity;
        const scale = 1 + 0.08 * pulse;
        pingTarget.scaling.copyFrom(pingBaseScale);
        pingTarget.scaling.scaleInPlace(scale);
      }
    }
  });

  return {
    refresh,
    dispose: () => {
      scene.onPointerObservable.remove(pointerObserver);
      scene.onBeforeRenderObservable.remove(beforeRenderObserver);
      deselect();
      unsubscribeVitals();
      clearHotspotProjection();
      createdColliders.splice(0).forEach((collider) => collider.dispose(false, true));
      testNodes.splice(0).forEach((node) => node.dispose(false, true));
      highlightLayer.dispose();
      uiRef.current?.dispose();
      uiRef.current = null;
      highlightLayerRef.current = null;
    }
  };
}
