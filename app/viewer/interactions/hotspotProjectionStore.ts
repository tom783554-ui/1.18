export type HotspotProjectionSnapshot = {
  id: string | null;
  label?: string;
  x: number;
  y: number;
  visible: boolean;
};

type ProjectionState = HotspotProjectionSnapshot & {
  updatedAtMs: number;
};

const subscribers = new Set<() => void>();
let lastEmitMs = 0;
let selection: { id: string | null; label?: string } = { id: null };
let projection: ProjectionState = {
  id: null,
  label: undefined,
  x: 0,
  y: 0,
  visible: false,
  updatedAtMs: 0
};

const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

const notify = () => {
  subscribers.forEach((listener) => listener());
};

export const subscribeHotspotProjection = (listener: () => void) => {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
};

export const getHotspotProjection = (): HotspotProjectionSnapshot => ({
  id: selection.id,
  label: selection.label,
  x: projection.x,
  y: projection.y,
  visible: projection.visible
});

const shouldEmit = (next: HotspotProjectionSnapshot, atMs: number) => {
  if (next.id !== selection.id || next.visible !== projection.visible) {
    return true;
  }
  if (atMs - lastEmitMs >= 33) {
    return true;
  }
  const dx = Math.abs(next.x - projection.x);
  const dy = Math.abs(next.y - projection.y);
  return dx > 0.75 || dy > 0.75;
};

export const setHotspotSelection = (next: { id: string; label?: string } | null) => {
  selection = next ? { id: next.id, label: next.label } : { id: null, label: undefined };
  projection = {
    ...projection,
    id: selection.id,
    label: selection.label,
    visible: false,
    updatedAtMs: nowMs()
  };
  notify();
};

export const clearHotspotProjection = () => {
  selection = { id: null, label: undefined };
  projection = {
    id: null,
    label: undefined,
    x: 0,
    y: 0,
    visible: false,
    updatedAtMs: nowMs()
  };
  notify();
};

export const setHotspotProjection = (next: Omit<HotspotProjectionSnapshot, "id" | "label">) => {
  const atMs = nowMs();
  const snapshot: HotspotProjectionSnapshot = {
    id: selection.id,
    label: selection.label,
    x: next.x,
    y: next.y,
    visible: next.visible
  };
  if (!shouldEmit(snapshot, atMs)) {
    projection = { ...projection, ...snapshot, updatedAtMs: atMs };
    return;
  }
  projection = { ...snapshot, updatedAtMs: atMs };
  lastEmitMs = atMs;
  notify();
};
