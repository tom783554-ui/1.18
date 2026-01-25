import { getCodeBlueEngineState, type CodeBlueEngineState } from "./codeblueState";
import manifest from "./codeblue.hotspots.v3.json";

export type Manifest = {
  version: string;
  node_count: number;
  nodes: Array<{
    name: string;
    kind: "HOTSPOT" | "INTERACTABLE" | "UI_ANCHOR" | "ENV";
    category?: string;
    pos?: [number, number, number];
    size?: [number, number, number];
  }>;
};

export type HotspotActionContext = {
  engineState: CodeBlueEngineState;
  uiToast: (message: string) => void;
};

export type HotspotEntry = {
  id: string;
  meshName: string;
  label: string;
  category: string;
  type: "hotspot" | "interactable";
  onClick: (ctx: HotspotActionContext) => void;
};

export const codeBlueManifest = manifest as Manifest;

const ensureEngineState = () => getCodeBlueEngineState();

export function buildHotspotEntries(): HotspotEntry[] {
  const nodes = codeBlueManifest.nodes.filter(
    (node) => node.kind === "HOTSPOT" || node.kind === "INTERACTABLE"
  );

  return nodes.map((node) => {
    const name = node.name;
    const type = node.kind === "INTERACTABLE" ? "interactable" : "hotspot";
    return {
      id: name,
      meshName: name,
      label: name,
      category: node.category ?? "misc",
      type,
      onClick: (ctx) => {
        const engineState = ctx.engineState ?? ensureEngineState();
        if (name.startsWith("DX_")) {
          engineState.dx = name;
          ctx.uiToast(`DX set: ${name}`);
        } else if (name.startsWith("STEP_")) {
          engineState.steps.push(name);
          ctx.uiToast(`STEP: ${name}`);
        } else if (name.startsWith("INT_") || name.startsWith("HS_")) {
          ctx.uiToast(`CLICK: ${name}`);
        }
        console.log({
          t: Date.now(),
          name,
          dx: engineState.dx,
          stepsLen: engineState.steps.length
        });
      }
    };
  });
}
