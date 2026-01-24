export const M3D_SOCKET_TOGGLE_EVENT = "m3d:socketToggle" as const;

export type M3DSocketToggle = {
  socketId: string;
  assetKey?: string;
};

export function emitSocketToggle(toggle: M3DSocketToggle): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<M3DSocketToggle>(M3D_SOCKET_TOGGLE_EVENT, { detail: toggle }));
}

export function onSocketToggle(handler: (toggle: M3DSocketToggle) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<M3DSocketToggle>;
    handler(customEvent.detail);
  };
  window.addEventListener(M3D_SOCKET_TOGGLE_EVENT, listener as EventListener);
  return () => window.removeEventListener(M3D_SOCKET_TOGGLE_EVENT, listener as EventListener);
}
