export const TOAST_EVENT = "m3d:toast" as const;

type ToastDetail = { message: string };

export const toast = (message: string) => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message } }));
};
