"use client";

type PanelState = { title: string; id: string } | null;

type PanelsProps = {
  panel: PanelState;
  onClose: () => void;
};

export default function Panels({ panel, onClose }: PanelsProps) {
  if (!panel) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-start justify-center p-4">
      <div className="pointer-events-auto mt-16 w-full max-w-sm rounded-lg border border-white/15 bg-black/80 p-4 text-white shadow-xl backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{panel.title}</h2>
            <p className="mt-1 text-xs text-white/70">{panel.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/15 px-2 py-1 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
