"use client";

type LoadingOverlayProps = {
  status: string;
  progress: number;
  isReady: boolean;
  hasError: boolean;
};

export default function LoadingOverlay({
  status,
  progress,
  isReady,
  hasError
}: LoadingOverlayProps) {
  if (isReady && !hasError) {
    return null;
  }

  return (
    <div className="overlay">
      <div className="card">
        <div className="title">Loading scene</div>
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
