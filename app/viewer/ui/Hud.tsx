"use client";

import { useSyncExternalStore } from "react";
import Hud from "../../../src/ui/Hud";
import { getSimSnapshot, subscribeSim } from "../../../src/engine/simStore";

export default function ViewerHud({ onNewRun }: { onNewRun: () => void }) {
  const snapshot = useSyncExternalStore(subscribeSim, getSimSnapshot, getSimSnapshot);

  if (!snapshot) {
    return null;
  }

  return <Hud snapshot={snapshot} onNewRun={onNewRun} />;
}
