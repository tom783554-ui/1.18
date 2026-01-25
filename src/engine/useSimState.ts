"use client";

import { useSyncExternalStore } from "react";
import { getSimSnapshot, subscribeSim } from "./simStore";

export const useSimState = () => useSyncExternalStore(subscribeSim, getSimSnapshot, getSimSnapshot);
