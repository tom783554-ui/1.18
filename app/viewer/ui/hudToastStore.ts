type HudToastState = {
  message: string;
  visibleUntil: number;
};

const listeners = new Set<() => void>();
let state: HudToastState = { message: "", visibleUntil: 0 };
let clearTimer: number | null = null;

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const getHudToast = (): HudToastState => state;

export const subscribeHudToast = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setHudToast = (message: string, durationMs = 2000) => {
  state = { message, visibleUntil: Date.now() + durationMs };
  notify();

  if (typeof window === "undefined") {
    return;
  }

  if (clearTimer !== null) {
    window.clearTimeout(clearTimer);
  }

  clearTimer = window.setTimeout(() => {
    state = { message: "", visibleUntil: 0 };
    notify();
    clearTimer = null;
  }, durationMs);
};
