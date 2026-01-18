import { SceneLoader, type Scene } from "@babylonjs/core";
import "@babylonjs/loaders";

export type LoadResult = {
  status: string;
  progress: number;
};

export const loadMainGlb = async (
  scene: Scene,
  url: string,
  onProgress?: (update: LoadResult) => void
) => {
  const updateProgress = (status: string, progress: number) => {
    if (onProgress) {
      onProgress({ status, progress });
    }
  };

  updateProgress("Starting download", 0);

  await SceneLoader.AppendAsync(
    "",
    url,
    scene,
    (event) => {
      if (event.lengthComputable) {
        const pct = Math.min(100, Math.round((event.loaded / event.total) * 100));
        updateProgress("Downloading", pct);
      } else {
        updateProgress("Downloading", 0);
      }
    }
  );

  updateProgress("Scene ready", 100);
};
