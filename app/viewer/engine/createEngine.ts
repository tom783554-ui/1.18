import { Engine } from "@babylonjs/core";
import { applyAdaptiveScaling, isMobileSafari } from "../utils/device";

export const createEngine = (canvas: HTMLCanvasElement) => {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: false,
    antialias: !isMobileSafari(),
    audioEngine: false,
    powerPreference: "high-performance"
  });

  const cleanupScaling = applyAdaptiveScaling(engine);

  return { engine, cleanupScaling };
};
