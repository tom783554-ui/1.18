import { Engine } from "@babylonjs/core";
import { isMobileDevice } from "../utils/device";

export const createEngine = (canvas: HTMLCanvasElement) => {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    antialias: true,
    adaptToDeviceRatio: true
  });

  const scaling = isMobileDevice() ? 2 : 1;
  engine.setHardwareScalingLevel(scaling);

  return engine;
};
