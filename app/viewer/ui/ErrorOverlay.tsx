"use client";

type ErrorOverlayProps = {
  error: { message: string; stack?: string };
  onRetry: () => void;
};

export default function ErrorOverlay({ error, onRetry }: ErrorOverlayProps) {
  return (
    <div className="overlay">
      <div className="card">
        <div className="title">ERROR</div>
        <div className="message">{error.message}</div>
        {error.stack ? <pre className="stack">{error.stack}</pre> : null}
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
      <style jsx>{`
        .overlay {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          background: rgba(12, 12, 12, 0.7);
          z-index: 7;
        }
        .card {
          background: rgba(20, 20, 20, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          padding: 20px;
          max-width: min(720px, 90vw);
          box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.5);
          display: grid;
          gap: 10px;
        }
        .title {
          font-weight: 700;
          color: #fecaca;
          letter-spacing: 0.04em;
        }
        .message {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          word-break: break-word;
        }
        .stack {
          margin: 0;
          font-size: 11px;
          line-height: 1.4;
          background: rgba(0, 0, 0, 0.35);
          padding: 10px;
          border-radius: 8px;
          white-space: pre-wrap;
          color: rgba(248, 250, 252, 0.75);
        }
        button {
          justify-self: start;
          background: rgba(30, 30, 30, 0.9);
          color: #f8fafc;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 6px 12px;
          font-size: 12px;
          cursor: pointer;
        }
        button:hover {
          border-color: rgba(255, 255, 255, 0.4);
        }
      `}</style>
    </div>
  );
}
