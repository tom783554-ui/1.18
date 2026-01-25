"use client";

import { useSyncExternalStore } from "react";
import { dispatchAction, getEngineSnapshot, setScenario, subscribe } from "./store";
import type { PatientAction } from "./actions";

export const usePatientEngine = () => {
  const snapshot = useSyncExternalStore(subscribe, getEngineSnapshot, getEngineSnapshot);
  return {
    state: snapshot.state,
    config: snapshot.config,
    dispatch: (action: PatientAction) => dispatchAction(action),
    setScenario
  };
};
