import { SceneLoader, type Scene } from "@babylonjs/core";
import "@babylonjs/loaders";

export type LoadProgress = {
  pct?: number;
  loadedBytes?: number;
  totalBytes?: number;
  statusText?: string;
};

export const loadMainGlb = async (
  scene: Scene,
  url: string,
  onProgress?: (update: LoadProgress) => void
) => {
  try {
    await SceneLoader.AppendAsync(
      "",
      url,
      scene,
      (event) => {
        if (!onProgress) {
          return;
        }
        if (event.lengthComputable) {
          const pct = Math.min(100, Math.round((event.loaded / event.total) * 100));
          onProgress({
            pct,
            loadedBytes: event.loaded,
            totalBytes: event.total,
            statusText: "Downloading"
          });
        } else {
          onProgress({
            loadedBytes: event.loaded,
            statusText: "Loading"
          });
        }
      },
      ".glb"
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const wrapped = new Error(`Failed to load GLB from ${url}: ${message}`);
    (wrapped as Error & { cause?: unknown }).cause = error;
    throw wrapped;
  }
};
