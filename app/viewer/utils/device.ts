const getUserAgent = () => (typeof navigator === "undefined" ? "" : navigator.userAgent);

export const isMobileSafari = () => {
  const ua = getUserAgent();
  const isAppleMobile = /iP(ad|hone|od)/i.test(ua);
  const isWebKit = /WebKit/i.test(ua);
  const isSafari = /Safari/i.test(ua);
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|OPR/i.test(ua);
  return isAppleMobile && isWebKit && isSafari && !isOtherBrowser;
};

export const recommendedHardwareScaling = () => {
  if (typeof window === "undefined") {
    return 1;
  }

  const ratio = window.devicePixelRatio || 1;
  if (isMobileSafari()) {
    const targetEffectiveRatio = 1.5;
    const scaled = ratio / targetEffectiveRatio;
    return Math.min(2, Math.max(1, scaled));
  }

  if (ratio >= 2.5) {
    return 1.5;
  }

  return 1;
};

export const applyAdaptiveScaling = (engine: { setHardwareScalingLevel: (level: number) => void }) => {
  if (typeof window === "undefined") {
    return;
  }

  let lastLevel = recommendedHardwareScaling();
  engine.setHardwareScalingLevel(lastLevel);

  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  const onResize = () => {
    if (resizeTimer) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(() => {
      const nextLevel = recommendedHardwareScaling();
      const clamped = Math.min(2.5, Math.max(0.75, nextLevel));
      if (Math.abs(clamped - lastLevel) >= 0.1) {
        lastLevel = clamped;
        engine.setHardwareScalingLevel(clamped);
      }
    }, 200);
  };

  window.addEventListener("resize", onResize, { passive: true });

  return () => {
    window.removeEventListener("resize", onResize);
  };
};
