"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AlertSeverity } from "../../../src/engine/alerts";

const WARNING_BEEP_MS = 2000;
const CRITICAL_BEEP_MS = 1000;

const getHighestSeverity = (severities: AlertSeverity[]): AlertSeverity | null => {
  if (severities.includes("CRITICAL")) {
    return "CRITICAL";
  }
  if (severities.includes("WARNING")) {
    return "WARNING";
  }
  return null;
};

const createBeep = (ctx: AudioContext, durationMs: number) => {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.value = 0.12;
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + durationMs / 1000);
};

export const useAlarmAudio = (
  severities: AlertSeverity[],
  silenceUntilSec: number,
  simTimeSec: number
) => {
  const audioRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const silenceRef = useRef(silenceUntilSec);
  const timeRef = useRef(simTimeSec);
  const [enabled, setEnabled] = useState(false);

  const enableAudio = useCallback(async () => {
    if (audioRef.current) {
      if (audioRef.current.state === "suspended") {
        await audioRef.current.resume();
      }
      setEnabled(true);
      return;
    }
    const AudioContextImpl = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextImpl) {
      return;
    }
    audioRef.current = new AudioContextImpl();
    setEnabled(true);
  }, []);

  useEffect(() => {
    const handleFirstGesture = () => {
      void enableAudio();
    };
    window.addEventListener("pointerdown", handleFirstGesture, { once: true });
    return () => window.removeEventListener("pointerdown", handleFirstGesture);
  }, [enableAudio]);

  const highestSeverity = useMemo(() => getHighestSeverity(severities), [severities]);

  useEffect(() => {
    silenceRef.current = silenceUntilSec;
    timeRef.current = simTimeSec;
  }, [silenceUntilSec, simTimeSec]);

  useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!enabled || !highestSeverity) {
      return;
    }
    if (timeRef.current < silenceRef.current) {
      return;
    }
    const intervalMs = highestSeverity === "CRITICAL" ? CRITICAL_BEEP_MS : WARNING_BEEP_MS;
    intervalRef.current = window.setInterval(() => {
      if (!audioRef.current) {
        return;
      }
      if (timeRef.current < silenceRef.current) {
        return;
      }
      createBeep(audioRef.current, highestSeverity === "CRITICAL" ? 160 : 120);
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, highestSeverity]);

  return { enabled, enableAudio };
};
