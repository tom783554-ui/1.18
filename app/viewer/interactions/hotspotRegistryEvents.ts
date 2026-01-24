export const M3D_HOTSPOT_REGISTRY_EVENT = "m3d:hotspotRegistry" as const;

export type M3DHotspotRegistryEntry = {
  prefix: string;
  id: string;
  label: string;
  nodeName: string;
  worldPos: [number, number, number];
};

export type M3DHotspotRegistry = {
  generatedAt: number;
  count: number;
  entries: M3DHotspotRegistryEntry[];
};

export function emitHotspotRegistry(registry: M3DHotspotRegistry): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<M3DHotspotRegistry>(M3D_HOTSPOT_REGISTRY_EVENT, { detail: registry })
  );
}

export function onHotspotRegistry(handler: (registry: M3DHotspotRegistry) => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<M3DHotspotRegistry>;
    handler(customEvent.detail);
  };
  window.addEventListener(M3D_HOTSPOT_REGISTRY_EVENT, listener as EventListener);
  return () => window.removeEventListener(M3D_HOTSPOT_REGISTRY_EVENT, listener as EventListener);
}
