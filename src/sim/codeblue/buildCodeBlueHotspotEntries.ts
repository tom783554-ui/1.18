import type { HotspotEntry } from "../../../app/viewer/interactions/hotspotSystem";
import {
  applyBvm,
  applyDefibShock,
  getEngineState,
  setDefibCharged,
  setFio2,
  setVentOn
} from "../../engine/store";
import { dispatchSimAction } from "../../engine/simStore";
import { hotspotCatalog } from "../../interactions/hotspotCatalog";

const formatFallbackName = (id: string, label: string) => `HP__${id}__${label}`;

export function buildCodeBlueHotspotEntries(): HotspotEntry[] {
  const entries: HotspotEntry[] = [];

  hotspotCatalog.forEach((item) => {
    const onClick = () => {
      const state = getEngineState();
      switch (item.onActivateActionKind) {
        case "VENT_TOGGLE": {
          setVentOn(!state.ventOn);
          dispatchSimAction({
            sourceHotspotId: item.id,
            kind: "VENT_TOGGLE",
            payload: { ventOn: !state.ventOn }
          });
          return;
        }
        case "VENT_FIO2_UP": {
          const next = Math.min(1, state.fio2 + 0.05);
          setFio2(next);
          dispatchSimAction({ sourceHotspotId: item.id, kind: "VENT_FIO2_UP", payload: { fio2: next } });
          return;
        }
        case "VENT_FIO2_DOWN": {
          const next = Math.max(0.21, state.fio2 - 0.05);
          setFio2(next);
          dispatchSimAction({ sourceHotspotId: item.id, kind: "VENT_FIO2_DOWN", payload: { fio2: next } });
          return;
        }
        case "AIRWAY_BAGVALVE": {
          applyBvm();
          dispatchSimAction({ sourceHotspotId: item.id, kind: "AIRWAY_BAGVALVE" });
          return;
        }
        case "DEFIB_CHARGE": {
          setDefibCharged(true);
          dispatchSimAction({ sourceHotspotId: item.id, kind: "DEFIB_CHARGE" });
          return;
        }
        case "DEFIB_SHOCK": {
          applyDefibShock();
          dispatchSimAction({ sourceHotspotId: item.id, kind: "DEFIB_SHOCK" });
          return;
        }
        default:
          dispatchSimAction({ sourceHotspotId: item.id, kind: item.onActivateActionKind });
      }
    };

    const meshNames = [...item.meshNameHints, formatFallbackName(item.id, item.label)];
    meshNames.forEach((meshName) => {
      entries.push({
        meshName,
        label: item.label,
        category: item.kind,
        onClick
      });
    });
  });

  return entries;
}
