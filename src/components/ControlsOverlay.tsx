"use client";

import { useEffect, useMemo, useState } from "react";
import type { PointerEvent } from "react";
import styles from "./ControlsOverlay.module.css";
import { useJoystick } from "../lib/useJoystick";

export type ControlState = {
  panVec: { x: number; y: number };
  rotVec: { x: number; y: number };
  zoomIn: boolean;
  zoomOut: boolean;
  speed: number;
};

type ControlsOverlayProps = {
  onControlChange: (state: ControlState) => void;
  onReset: () => void;
  onShare?: () => void;
  onInteraction?: () => void;
  resetSignal?: number;
  initialSpeed?: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const buildHoldHandlers = (
  setPressed: (value: boolean) => void,
  onInteraction?: () => void
) => ({
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPressed(true);
    onInteraction?.();
  },
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPressed(false);
  },
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setPressed(false);
  },
  onPointerLeave: (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setPressed(false);
  }
});

export default function ControlsOverlay({
  onControlChange,
  onReset,
  onShare,
  onInteraction,
  resetSignal,
  initialSpeed = 1
}: ControlsOverlayProps) {
  const panStick = useJoystick({ radius: 44, onStart: onInteraction, onEnd: onInteraction });
  const rotStick = useJoystick({ radius: 44, onStart: onInteraction, onEnd: onInteraction });
  const [zoomIn, setZoomIn] = useState(false);
  const [zoomOut, setZoomOut] = useState(false);
  const [speed, setSpeed] = useState(initialSpeed);

  useEffect(() => {
    onControlChange({
      panVec: panStick.vector,
      rotVec: rotStick.vector,
      zoomIn,
      zoomOut,
      speed: clamp(speed, 0.5, 2.5)
    });
  }, [onControlChange, panStick.vector, rotStick.vector, speed, zoomIn, zoomOut]);

  useEffect(() => {
    if (resetSignal === undefined) {
      return;
    }
    panStick.reset();
    rotStick.reset();
    setZoomIn(false);
    setZoomOut(false);
  }, [panStick, resetSignal, rotStick]);

  const zoomInHandlers = useMemo(() => buildHoldHandlers(setZoomIn, onInteraction), [onInteraction]);
  const zoomOutHandlers = useMemo(() => buildHoldHandlers(setZoomOut, onInteraction), [onInteraction]);

  return (
    <div className={styles.overlay}>
      <div className={`${styles.joystickZone} ${styles.leftZone}`}>
        <div
          className={`${styles.joystick} ${panStick.isActive ? styles.joystickActive : ""}`}
          {...panStick.bind}
          aria-label="Pan joystick"
        >
          <div
            className={styles.knob}
            style={{
              transform: `translate(calc(-50% + ${panStick.knobPosition.x}px), calc(-50% + ${panStick.knobPosition.y}px))`
            }}
          />
        </div>
      </div>
      <div className={`${styles.joystickZone} ${styles.rightZone}`}>
        <div
          className={`${styles.joystick} ${rotStick.isActive ? styles.joystickActive : ""}`}
          {...rotStick.bind}
          aria-label="Rotate joystick"
        >
          <div
            className={styles.knob}
            style={{
              transform: `translate(calc(-50% + ${rotStick.knobPosition.x}px), calc(-50% + ${rotStick.knobPosition.y}px))`
            }}
          />
        </div>
      </div>
      <div className={styles.zoomStack}>
        <button type="button" className={`${styles.btn} ${zoomIn ? styles.btnActive : ""}`} {...zoomInHandlers}>
          +
          <span className={styles.srOnly}>Zoom in</span>
        </button>
        <button type="button" className={`${styles.btn} ${zoomOut ? styles.btnActive : ""}`} {...zoomOutHandlers}>
          −
          <span className={styles.srOnly}>Zoom out</span>
        </button>
      </div>
      <div className={styles.actions}>
        <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={onReset}>
          Reset
        </button>
        {onShare ? (
          <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={onShare}>
            Share
          </button>
        ) : null}
        <label className={styles.slider}>
          Speed {speed.toFixed(1)}x
          <input
            type="range"
            min={0.5}
            max={2.5}
            step={0.1}
            value={speed}
            onChange={(event) => {
              setSpeed(Number(event.target.value));
              onInteraction?.();
            }}
          />
        </label>
      </div>
    </div>
  );
}
