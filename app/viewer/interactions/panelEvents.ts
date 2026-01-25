const PANEL_EVENT = "m3d:panel" as const;

export const emitPanelClose = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(PANEL_EVENT, { detail: { open: false, title: "", id: "" } }));
};

export const emitPanelOpen = (title: string, id: string) => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(PANEL_EVENT, { detail: { open: true, title, id } }));
};
