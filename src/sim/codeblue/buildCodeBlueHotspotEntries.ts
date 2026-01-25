import type { HotspotEntry } from "../../../app/viewer/interactions/hotspotSystem";
import { updateEngineState, getEngineState } from "../../engine/store";
import { toast } from "../../engine/toast";
import { expandCompactManifest } from "./expandCompactManifest";

export function buildCodeBlueHotspotEntries(): HotspotEntry[] {
  const { nodes } = expandCompactManifest();

  return nodes
    .filter((node) => node.kind === "HOTSPOT" || node.kind === "INTERACTABLE")
    .map((node) => {
      const name = node.name;
      const onClick = () => {
        let toastMessage = "";

        updateEngineState((engineState) => {
          if (name.startsWith("DX_")) {
            engineState.dx = name;
            toastMessage = `DX set: ${name}`;
            return;
          }
          if (name.startsWith("STEP_")) {
            const steps = engineState.steps ?? [];
            if (!steps.includes(name)) {
              steps.push(name);
            }
            engineState.steps = steps;
            toastMessage = `STEP: ${name}`;
            return;
          }
          if (name.startsWith("ROLE_")) {
            engineState.roleFocus = name;
            toastMessage = `ROLE: ${name}`;
            return;
          }
          toastMessage = `CLICK: ${name}`;
        });

        if (toastMessage) {
          toast(toastMessage);
        }

        const engineState = getEngineState();
        console.log({
          t: Date.now(),
          name,
          dx: engineState.dx,
          steps: engineState.steps?.length ?? 0
        });
      };

      return {
        meshName: name,
        label: name,
        category: node.category ?? "misc",
        onClick
      } as HotspotEntry;
    });
}
