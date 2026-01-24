export type M3dDebugState = {
  lastHotspotId: string;
  lastPickMeshName: string;
  ready: boolean;
};

declare global {
  interface Window {
    __m3d?: M3dDebugState;
  }
}

export const getM3dDebugState = (): M3dDebugState | null => {
  if (typeof window === "undefined") {
    return null;
  }
  if (!window.__m3d) {
    window.__m3d = {
      lastHotspotId: "none",
      lastPickMeshName: "none",
      ready: false
    };
  }
  return window.__m3d;
};

export const setM3dReady = (ready: boolean) => {
  const state = getM3dDebugState();
  if (!state) {
    return;
  }
  state.ready = ready;
};

export const setM3dPick = (hotspotId: string | null, meshName: string | null) => {
  const state = getM3dDebugState();
  if (!state) {
    return;
  }
  state.lastHotspotId = hotspotId ?? "none";
  state.lastPickMeshName = meshName ?? "none";
};
