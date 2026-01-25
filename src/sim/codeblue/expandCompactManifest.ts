import compact from "./codeblue.manifest.compact.json";

export type ExpandedNode = {
  name: string;
  kind: "HOTSPOT" | "INTERACTABLE" | "UI_ANCHOR" | "ENV";
  category?: string;
};

type CompactKind = ExpandedNode["kind"];

type CompactExplicitItem = string | { name: string; category?: string };

type CompactListPattern = {
  type: "list";
  kind: CompactKind;
  items?: CompactExplicitItem[];
  names?: CompactExplicitItem[];
  category?: string;
};

type CompactRangePattern = {
  type: "range";
  kind: CompactKind;
  prefix: string;
  from: number;
  to: number;
  pad: number;
  category?: string;
};

type CompactPattern = CompactListPattern | CompactRangePattern;

type CompactManifest = {
  version: string;
  explicit: Partial<Record<CompactKind, CompactExplicitItem[]>>;
  patterns: CompactPattern[];
};

const COMPACT_KIND_ORDER: CompactKind[] = ["HOTSPOT", "INTERACTABLE", "UI_ANCHOR", "ENV"];

const coerceNode = (
  item: CompactExplicitItem,
  kind: CompactKind,
  categoryOverride?: string
): ExpandedNode => {
  if (typeof item === "string") {
    return { name: item, kind, category: categoryOverride };
  }
  return {
    name: item.name,
    kind,
    category: item.category ?? categoryOverride
  };
};

export function expandCompactManifest(): { version: string; nodes: ExpandedNode[] } {
  const manifest = compact as CompactManifest;
  const nodes: ExpandedNode[] = [];

  COMPACT_KIND_ORDER.forEach((kind) => {
    const items = manifest.explicit?.[kind] ?? [];
    items.forEach((item) => nodes.push(coerceNode(item, kind)));
  });

  (manifest.patterns ?? []).forEach((pattern) => {
    if (pattern.type === "list") {
      const items = pattern.items ?? pattern.names ?? [];
      items.forEach((item) => nodes.push(coerceNode(item, pattern.kind, pattern.category)));
      return;
    }
    const start = Number(pattern.from);
    const end = Number(pattern.to);
    const pad = Number(pattern.pad);
    for (let index = start; index <= end; index += 1) {
      const suffix = index.toString().padStart(Math.max(0, pad), "0");
      nodes.push({
        name: `${pattern.prefix}${suffix}`,
        kind: pattern.kind,
        category: pattern.category
      });
    }
  });

  const seen = new Set<string>();
  const deduped: ExpandedNode[] = [];
  nodes.forEach((node) => {
    if (seen.has(node.name)) {
      return;
    }
    seen.add(node.name);
    deduped.push(node);
  });

  const kindPriority = new Map(COMPACT_KIND_ORDER.map((kind, index) => [kind, index] as const));
  const sorted = deduped
    .map((node, index) => ({ node, index }))
    .sort((a, b) => {
      const kindA = kindPriority.get(a.node.kind) ?? 99;
      const kindB = kindPriority.get(b.node.kind) ?? 99;
      if (kindA !== kindB) {
        return kindA - kindB;
      }
      const nameCompare = a.node.name.localeCompare(b.node.name);
      if (nameCompare !== 0) {
        return nameCompare;
      }
      return a.index - b.index;
    })
    .map(({ node }) => node);

  return {
    version: manifest.version ?? "unknown",
    nodes: sorted
  };
}
