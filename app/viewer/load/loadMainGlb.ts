import { SceneLoader, type Scene } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

export type LoadProgress = {
  pct?: number;
  loadedBytes?: number;
  totalBytes?: number;
  statusText?: string;
};

const LOAD_TIMEOUT_MS = 15000;

const splitUrl = (u: string): { rootUrl: string; file: string } => {
  const i = u.lastIndexOf("/");
  if (i === -1) {
    return { rootUrl: "", file: u };
  }
  return { rootUrl: u.slice(0, i + 1), file: u.slice(i + 1) };
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number, url: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timed out loading GLB: ${url}`)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const loadMainGlb = async (
  scene: Scene,
  url: string,
  onProgress?: (update: LoadProgress) => void
) => {
  try {
    const { rootUrl, file } = splitUrl(url);
    await withTimeout(
      (async () => {
        await SceneLoader.AppendAsync(
          rootUrl,
          file,
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
        await scene.whenReadyAsync();
        console.log("[GLB] loaded", { meshes: scene.meshes.length, url });
      })(),
      LOAD_TIMEOUT_MS,
      url
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const wrapped = new Error(`Failed to load GLB from ${url}: ${message}`);
    (wrapped as Error & { cause?: unknown }).cause = error;
    throw wrapped;
  }
};
