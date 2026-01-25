import type { AbstractMesh, Camera, Engine } from "@babylonjs/core";
import { Matrix, Vector3 } from "@babylonjs/core";

export type HotspotProjection = {
  x: number;
  y: number;
  visible: boolean;
  id: string | null;
};

type ProjectionListener = () => void;

const projectionState = {
  selectedMesh: null as AbstractMesh | null,
  selectedId: null as string | null,
  projection: { x: 0, y: 0, visible: false, id: null } as HotspotProjection,
  listeners: new Set<ProjectionListener>(),
  lastUpdate: 0
};

const notify = () => {
  projectionState.listeners.forEach((listener) => listener());
};

export const setSelectedHotspot = (mesh: AbstractMesh | null, id: string | null) => {
  projectionState.selectedMesh = mesh;
  projectionState.selectedId = id;
  if (!mesh) {
    projectionState.projection = { x: 0, y: 0, visible: false, id: null };
    notify();
  }
};

const getCenterWorld = (mesh: AbstractMesh) => {
  if (typeof mesh.getBoundingInfo === "function") {
    const info = mesh.getBoundingInfo();
    return info?.boundingBox?.centerWorld ?? mesh.getAbsolutePosition();
  }
  return mesh.getAbsolutePosition();
};

export const updateHotspotProjection = ({
  engine,
  camera,
  now
}: {
  engine: Engine;
  camera: Camera;
  now?: number;
}) => {
  const timestamp = now ?? (typeof performance === "undefined" ? Date.now() : performance.now());
  if (timestamp - projectionState.lastUpdate < 33) {
    return;
  }
  projectionState.lastUpdate = timestamp;

  const mesh = projectionState.selectedMesh;
  if (!mesh) {
    if (projectionState.projection.visible || projectionState.projection.id !== null) {
      projectionState.projection = { x: 0, y: 0, visible: false, id: null };
      notify();
    }
    return;
  }

  const center = getCenterWorld(mesh);
  const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
  const viewProjection = camera.getViewMatrix().multiply(camera.getProjectionMatrix(true));
  const projected = Vector3.Project(center, Matrix.Identity(), viewProjection, viewport);
  const isVisible =
    Number.isFinite(projected.x) &&
    Number.isFinite(projected.y) &&
    Number.isFinite(projected.z) &&
    projected.z >= 0 &&
    projected.z <= 1;

  const next: HotspotProjection = {
    x: projected.x,
    y: projected.y,
    visible: isVisible,
    id: projectionState.selectedId
  };

  const prev = projectionState.projection;
  const delta = Math.hypot(next.x - prev.x, next.y - prev.y);
  if (prev.visible !== next.visible || prev.id !== next.id || delta > 0.5) {
    projectionState.projection = next;
    notify();
  }
};

export const getHotspotProjection = () => projectionState.projection;

export const subscribeHotspotProjection = (listener: ProjectionListener) => {
  projectionState.listeners.add(listener);
  return () => projectionState.listeners.delete(listener);
};
