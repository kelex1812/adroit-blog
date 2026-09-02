/**
 * LoadingSky — shimmer fallback shown while the lazy 3D chunk loads, and as
 * the base state before WebGL is confirmed. A quiet "sky materializing" state.
 */
export function LoadingSky({ label = "Charting your sky" }: { label?: string }) {
  return (
    <div className="cx3d-loading" data-testid="cx3d-loading" role="status" aria-live="polite">
      <div className="cx3d-loading-stars" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <span className="cx3d-loading-label">{label}</span>
    </div>
  );
}
