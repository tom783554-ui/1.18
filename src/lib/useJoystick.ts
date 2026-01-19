import { useCallback, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";

type JoystickVector = { x: number; y: number };

type UseJoystickOptions = {
  radius?: number;
  onStart?: () => void;
  onEnd?: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const useJoystick = (options: UseJoystickOptions = {}) => {
  const { radius = 40, onStart, onEnd } = options;
  const [vector, setVector] = useState<JoystickVector>({ x: 0, y: 0 });
  const [knobPosition, setKnobPosition] = useState<JoystickVector>({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const pointerIdRef = useRef<number | null>(null);
  const originRef = useRef<JoystickVector | null>(null);

  const reset = useCallback(() => {
    setVector({ x: 0, y: 0 });
    setKnobPosition({ x: 0, y: 0 });
    setIsActive(false);
    pointerIdRef.current = null;
    originRef.current = null;
  }, []);

  const updateFromEvent = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== event.pointerId || !originRef.current) {
        return;
      }
      const dx = event.clientX - originRef.current.x;
      const dy = event.clientY - originRef.current.y;
      const distance = Math.hypot(dx, dy);
      const limited = Math.min(distance, radius);
      const angle = Math.atan2(dy, dx);
      const x = limited * Math.cos(angle);
      const y = limited * Math.sin(angle);
      const normalized: JoystickVector = {
        x: clamp(x / radius, -1, 1),
        y: clamp(y / radius, -1, 1)
      };
      setKnobPosition({ x, y });
      setVector(normalized);
    },
    [radius]
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      pointerIdRef.current = event.pointerId;
      originRef.current = { x: event.clientX, y: event.clientY };
      setIsActive(true);
      setKnobPosition({ x: 0, y: 0 });
      setVector({ x: 0, y: 0 });
      onStart?.();
    },
    [onStart]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      updateFromEvent(event);
    },
    [updateFromEvent]
  );

  const endPointer = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      reset();
      onEnd?.();
    },
    [onEnd, reset]
  );

  const bind = useMemo(
    () => ({
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: endPointer,
      onPointerCancel: endPointer,
      onPointerLeave: endPointer
    }),
    [endPointer, handlePointerDown, handlePointerMove]
  );

  return {
    vector,
    knobPosition,
    isActive,
    bind,
    reset
  };
};
