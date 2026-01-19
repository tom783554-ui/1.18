import { Engine } from "@babylonjs/core";
import { applyAdaptiveScaling } from "../utils/device";

export const createEngine = (canvas: HTMLCanvasElement) => {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: false,
    antialias: true,
    audioEngine: false
  });

  const cleanupScaling = applyAdaptiveScaling(engine);

  return { engine, cleanupScaling };
};
