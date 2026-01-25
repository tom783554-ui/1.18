"use client";

import { useSyncExternalStore } from "react";
import { getEngineState, subscribe } from "./store";

export const useEngineState = () => useSyncExternalStore(subscribe, getEngineState, getEngineState);
