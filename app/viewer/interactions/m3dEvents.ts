export const M3D_PICK_EVENT = "m3d:pick" as const;

export type M3DPickDetail = {
  prefix: string;
  id: string;
  name: string;
  pickedMeshName?: string;
  time: number;
};

export function emitPick(detail: M3DPickDetail): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent<M3DPickDetail>(M3D_PICK_EVENT, { detail }));
}

export function onPick(handler: (detail: M3DPickDetail) => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<M3DPickDetail>;
    handler(customEvent.detail);
  };
  window.addEventListener(M3D_PICK_EVENT, listener as EventListener);
  return () => window.removeEventListener(M3D_PICK_EVENT, listener as EventListener);
}
