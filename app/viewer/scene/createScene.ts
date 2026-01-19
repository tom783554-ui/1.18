import { ArcRotateCamera, Color4, Engine, HemisphericLight, Scene, Vector3 } from "@babylonjs/core";

export type ControlState = {
  panVec: { x: number; y: number };
  rotVec: { x: number; y: number };
  zoomIn: boolean;
  zoomOut: boolean;
  speed: number;
};

export const configureTextureCompression = (_scene: Scene) => {
  // TODO: wire KTX2/Basis support without runtime downloads.
};

export const createScene = (engine: Engine, canvas: HTMLCanvasElement) => {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.2, 0.2, 0.2, 1);

  const camera = new ArcRotateCamera(
    "camera",
    Math.PI / 2,
    Math.PI / 3,
    10,
    new Vector3(0, 1, 0),
    scene
  );
  camera.attachControl(canvas, true);
  const pointerInput = camera.inputs.attached.pointers;
  if (pointerInput) {
    pointerInput.multiTouchPanAndZoom = false;
    pointerInput.multiTouchPanning = false;
  }
  camera.lowerRadiusLimit = 1.5;
  camera.upperRadiusLimit = 120;
  camera.lowerBetaLimit = 0.2;
  camera.upperBetaLimit = Math.PI / 2.1;
  camera.wheelPrecision = 140;
  camera.pinchPrecision = 250;
  camera.panningSensibility = 90;
  camera.minZ = 0.01;
  camera.maxZ = 5000;

  new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);

  configureTextureCompression(scene);

  const controlState: ControlState = {
    panVec: { x: 0, y: 0 },
    rotVec: { x: 0, y: 0 },
    zoomIn: false,
    zoomOut: false,
    speed: 1
  };

  const velocity = {
    panX: 0,
    panY: 0,
    rotX: 0,
    rotY: 0,
    zoom: 0
  };

  const smoothing = 8;
  const friction = 6;

  const applySmoothing = (current: number, target: number, delta: number, shouldFriction: boolean) => {
    const factor = 1 - Math.exp(-smoothing * delta);
    let next = current + (target - current) * factor;
    if (shouldFriction) {
      next *= Math.exp(-friction * delta);
    }
    return next;
  };

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const setControlState = (next: ControlState) => {
    controlState.panVec = next.panVec;
    controlState.rotVec = next.rotVec;
    controlState.zoomIn = next.zoomIn;
    controlState.zoomOut = next.zoomOut;
    controlState.speed = next.speed;
  };

  const resetControls = () => {
    velocity.panX = 0;
    velocity.panY = 0;
    velocity.rotX = 0;
    velocity.rotY = 0;
    velocity.zoom = 0;
  };

  scene.onBeforeRenderObservable.add(() => {
    const delta = engine.getDeltaTime() / 1000;
    if (!delta) {
      return;
    }

    const speed = clamp(controlState.speed || 1, 0.5, 2.5);
    const rotSpeed = 1.8 * speed;
    const zoomSpeed = 6 * speed;
    const panSpeed = Math.max(2, camera.radius * 0.6) * speed;

    const rotTargetX = controlState.rotVec.x * rotSpeed;
    const rotTargetY = controlState.rotVec.y * rotSpeed;
    const panTargetX = controlState.panVec.x * panSpeed;
    const panTargetY = controlState.panVec.y * panSpeed;
    const zoomDirection = (controlState.zoomIn ? -1 : 0) + (controlState.zoomOut ? 1 : 0);
    const zoomTarget = zoomDirection * zoomSpeed;

    velocity.rotX = applySmoothing(velocity.rotX, rotTargetX, delta, Math.abs(rotTargetX) < 0.01);
    velocity.rotY = applySmoothing(velocity.rotY, rotTargetY, delta, Math.abs(rotTargetY) < 0.01);
    velocity.panX = applySmoothing(velocity.panX, panTargetX, delta, Math.abs(panTargetX) < 0.01);
    velocity.panY = applySmoothing(velocity.panY, panTargetY, delta, Math.abs(panTargetY) < 0.01);
    velocity.zoom = applySmoothing(velocity.zoom, zoomTarget, delta, Math.abs(zoomTarget) < 0.01);

    camera.alpha += velocity.rotX * delta;
    camera.beta = clamp(
      camera.beta + velocity.rotY * delta,
      camera.lowerBetaLimit ?? 0.01,
      camera.upperBetaLimit ?? Math.PI - 0.01
    );

    const right = camera.getDirection(Vector3.Right());
    const forward = camera.getDirection(Vector3.Forward());
    forward.y = 0;
    if (forward.lengthSquared() < 0.0001) {
      forward.z = 1;
    }
    forward.normalize();
    const panDelta = right.scale(velocity.panX * delta).add(forward.scale(velocity.panY * delta));
    camera.target.addInPlace(panDelta);

    const nextRadius = clamp(
      camera.radius + velocity.zoom * delta,
      camera.lowerRadiusLimit ?? 0.01,
      camera.upperRadiusLimit ?? Number.POSITIVE_INFINITY
    );
    camera.radius = nextRadius;
  });

  return { scene, camera, setControlState, resetControls };
};
