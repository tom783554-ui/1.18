"use client";

type LoadingOverlayProps = {
  status: string;
  progress: number;
  isReady: boolean;
  error: { message: string; stack?: string } | null;
};

export default function LoadingOverlay({
  status,
  progress,
  isReady,
  error
}: LoadingOverlayProps) {
  if (isReady && !error) {
    return null;
  }

  if (error) {
    return (
      <div className="overlay">
        <div className="card error">
          <div className="title">Error loading viewer</div>
          <div className="status">{error.message}</div>
          {error.stack ? <pre className="stack">{error.stack}</pre> : null}
        </div>
        <style jsx>{`
          .overlay {
            position: absolute;
            inset: 0;
            display: grid;
            place-items: center;
            background: rgba(12, 12, 12, 0.8);
            z-index: 6;
          }
          .card {
            background: rgba(25, 25, 25, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.15);
            padding: 20px;
            border-radius: 12px;
            min-width: 280px;
            max-width: min(720px, 90vw);
            text-align: left;
          }
          .error {
            box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.4);
          }
          .title {
            font-weight: 600;
            margin-bottom: 8px;
            color: #fecaca;
          }
          .status {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.85);
            word-break: break-word;
          }
          .stack {
            margin-top: 12px;
            font-size: 11px;
            line-height: 1.4;
            background: rgba(0, 0, 0, 0.3);
            padding: 10px;
            border-radius: 8px;
            white-space: pre-wrap;
            color: rgba(248, 250, 252, 0.8);
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="overlay">
      <div className="card">
        <div className="title">Loading...</div>
        <div className="status">{status}</div>
        <div className="progress">
          <div className="bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="pct">{progress}%</div>
      </div>
      <style jsx>{`
        .overlay {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          background: rgba(12, 12, 12, 0.7);
          z-index: 4;
        }
        .card {
          background: rgba(25, 25, 25, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 20px;
          border-radius: 12px;
          min-width: 240px;
          text-align: center;
        }
        .title {
          font-weight: 600;
          margin-bottom: 8px;
        }
        .status {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
        }
        .progress {
          margin-top: 12px;
          height: 8px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
          overflow: hidden;
        }
        .bar {
          height: 100%;
          background: linear-gradient(90deg, #7dd3fc, #818cf8);
          transition: width 0.2s ease;
        }
        .pct {
          margin-top: 8px;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
