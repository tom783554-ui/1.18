"use client";

import { DEFAULT_GLB_PATH, type LoadProgress } from "../load/loadMainGlb";

type LoadingOverlayProps = {
  isLoading: boolean;
  progress: LoadProgress | null;
  isReady: boolean;
  missingMain: boolean;
  missingMainDetails: string | null;
  error: { title: string; details?: string } | null;
  onFilePick: (file: File) => void;
};

const formatBytes = (value: number) => {
  if (value < 1024) {
    return `${value} B`;
  }
  const kb = value / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
};

export default function LoadingOverlay({
  isLoading,
  progress,
  isReady,
  missingMain,
  missingMainDetails,
  error,
  onFilePick
}: LoadingOverlayProps) {
  if (!isLoading && !missingMain && !error && !isReady) {
    return null;
  }

  return (
    <div className="overlay">
      <div className="card">
        {missingMain ? (
          <>
            <div className="title">missing main.glb</div>
            <div className="message">{missingMainDetails ?? `main.glb missing at ${DEFAULT_GLB_PATH}`}</div>
            <label className="picker">
              <input
                type="file"
                accept=".glb"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    onFilePick(file);
                  }
                }}
              />
              Choose .glb
            </label>
          </>
        ) : error ? (
          <>
            <div className="title">{error.title}</div>
            {error.details ? <div className="message">{error.details}</div> : null}
          </>
        ) : isReady ? (
          <div className="ready">Scene ready</div>
        ) : (
          <>
            <div className="spinner" />
            <div className="message">Loading scene…</div>
            {progress?.pct !== undefined ? (
              <div className="progress">{progress.pct}%</div>
            ) : null}
            {progress?.loadedBytes !== undefined ? (
              <div className="subtle">
                {formatBytes(progress.loadedBytes)}
                {progress.totalBytes ? ` / ${formatBytes(progress.totalBytes)}` : ""}
              </div>
            ) : progress?.statusText ? (
              <div className="subtle">{progress.statusText}</div>
            ) : null}
          </>
        )}
      </div>
      <style jsx>{`
        .overlay {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          background: rgba(10, 10, 10, 0.55);
          z-index: 6;
          padding: 16px;
        }
        .card {
          width: min(320px, 90vw);
          background: rgba(20, 20, 20, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          padding: 16px;
          display: grid;
          gap: 8px;
          text-align: center;
          color: #f8fafc;
        }
        .title {
          font-weight: 700;
          text-transform: lowercase;
        }
        .message {
          font-size: 13px;
          color: rgba(248, 250, 252, 0.8);
        }
        .progress {
          font-size: 14px;
          font-weight: 600;
        }
        .subtle {
          font-size: 12px;
          color: rgba(226, 232, 240, 0.7);
        }
        .ready {
          font-weight: 600;
          color: #bbf7d0;
        }
        .spinner {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-top-color: #fff;
          animation: spin 1s linear infinite;
          justify-self: center;
        }
        .picker {
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 8px 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          font-size: 13px;
          background: rgba(30, 30, 30, 0.8);
        }
        .picker input {
          display: none;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
