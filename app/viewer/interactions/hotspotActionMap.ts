import type { M3DPickDetail } from "./m3dEvents";
import type { ScenarioAction, VentMode } from "../scenario/types";

export type PickBindings = {
  scenarioActions: ScenarioAction[];
  socketToggle?: { socketId: string; assetKey?: string };
};

const norm = (s: string) => (s || "").toLowerCase().trim();

const parseMode = (id: string): VentMode | null => {
  const m = norm(id);
  if (m.includes("mode_vc") || m === "vc") return "VC";
  if (m.includes("mode_pc") || m === "pc") return "PC";
  if (m.includes("mode_ps") || m === "ps") return "PS";
  if (m.includes("mode_simv") || m === "simv") return "SIMV";
  if (m.includes("mode_niv") || m === "niv") return "NIV";
  return null;
};

const parsePercent = (id: string) => {
  const m = norm(id);
  const match = m.match(/(fio2|o2|percent)[_ -]?(\d{2,3})/i);
  if (!match) return null;
  const pct = Number(match[2]);
  if (!Number.isFinite(pct)) return null;
  return Math.min(Math.max(pct, 21), 100) / 100;
};

const parsePeep = (id: string) => {
  const m = norm(id);
  const match = m.match(/peep[_ -]?(\d{1,2})/i);
  if (!match) return null;
  const v = Number(match[1]);
  if (!Number.isFinite(v)) return null;
  return Math.min(Math.max(Math.round(v), 0), 20);
};

export function getBindingsForPick(detail: M3DPickDetail): PickBindings {
  const id = norm(detail.id);
  const label = norm(detail.label ?? "");
  const hay = `${id} ${label}`;

  const scenarioActions: ScenarioAction[] = [];

  const maybeMode = parseMode(id) ?? parseMode(label);
  if (maybeMode) {
    scenarioActions.push({ type: "SET_MODE", mode: maybeMode });
  }

  const fio2 = parsePercent(id) ?? parsePercent(label);
  if (fio2 !== null) {
    scenarioActions.push({ type: "SET_FIO2", fio2 });
  }

  const peep = parsePeep(id) ?? parsePeep(label);
  if (peep !== null) {
    scenarioActions.push({ type: "SET_PEEP", peep });
  }

  if (hay.includes("vent") || hay.includes("ventilator")) {
    scenarioActions.push({ type: "NOTE", message: "Ventilator interaction" });
    scenarioActions.push({ type: "SET_FIO2", fio2: 0.4 });
    scenarioActions.push({ type: "SET_PEEP", peep: 8 });
  } else if (hay.includes("monitor")) {
    scenarioActions.push({ type: "NOTE", message: "Monitor opened" });
  } else if (hay.includes("bed")) {
    scenarioActions.push({ type: "NOTE", message: "Bed interaction" });
  } else if (hay.includes("pump") || hay.includes("iv")) {
    scenarioActions.push({ type: "NOTE", message: "IV pump interaction" });
  } else {
    scenarioActions.push({ type: "NOTE", message: `Hotspot: ${detail.id}` });
  }

  const socketToggle =
    hay.includes("vent") || hay.includes("monitor") || hay.includes("pump") || hay.includes("iv")
      ? { socketId: detail.id, assetKey: detail.id }
      : undefined;

  return { scenarioActions, socketToggle };
}
