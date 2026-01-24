import { SceneLoader, type Scene } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

export type LoadProgress = {
  pct?: number;
  loadedBytes?: number;
  totalBytes?: number;
  statusText?: string;
};

export const DEFAULT_GLB_PATH = "/assets/main/main.glb";

const LOAD_TIMEOUT_MS = 15000;
const GLB_HEADER_BYTES = 20;
const GLB_MAGIC = "glTF";
const MIN_GLB_LENGTH = GLB_HEADER_BYTES;

const isHttpLikeUrl = (value: string) => value.startsWith("/") || value.startsWith("http://") || value.startsWith("https://");

const parseGlbHeader = (bytes: Uint8Array) => {
  if (bytes.byteLength < GLB_HEADER_BYTES) {
    throw new Error(`GLB is too small (${bytes.byteLength} bytes).`);
  }

  const magic = new TextDecoder().decode(bytes.slice(0, 4));
  if (magic !== GLB_MAGIC) {
    throw new Error(`GLB header magic mismatch: expected "${GLB_MAGIC}" but received "${magic || "<empty>"}".`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(4, true);
  const length = view.getUint32(8, true);

  if (version !== 2) {
    throw new Error(`Unsupported GLB version: ${version}.`);
  }
  if (length < MIN_GLB_LENGTH) {
    throw new Error(`GLB declared length ${length} bytes is invalid.`);
  }
};

const readHeaderBytes = async (url: string) => {
  const response = await fetch(url, {
    headers: { Range: `bytes=0-${GLB_HEADER_BYTES - 1}` }
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(`Preflight request failed with status ${response.status}.`);
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
};

const validateGlbUrl = async (url: string) => {
  if (!isHttpLikeUrl(url) || url.startsWith("blob:") || url.startsWith("data:")) {
    return;
  }

  try {
    const bytes = await readHeaderBytes(url);
    parseGlbHeader(bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`GLB validation failed for ${url}: ${message}`);
  }
};

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
    await validateGlbUrl(url);
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
