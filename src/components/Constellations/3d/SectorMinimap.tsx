/**
 * SectorMinimap — 2D DOM minimap overlay for the profile galaxy (design token
 * `.cx3d-minimap`). Each course = a sector dot; clicking a dot flies the camera
 * to that sector. Pure DOM — positions come from the pure galaxy model.
 */
import type { GalaxySector } from "./galaxy-model";

export interface SectorMinimapProps {
  sectors: GalaxySector[];
  activeSlug: string | null;
  onSelect: (seriesSlug: string) => void;
}

/** CSS class for a sector dot by its visual state. */
export function sectorDotClass(state: GalaxySector["state"]): string {
  switch (state) {
    case "certified":
    case "completed":
      return "is-lit";
    case "in-progress":
      return "is-current";
    default:
      return "is-unlit";
  }
}

export function SectorMinimap({ sectors, activeSlug, onSelect }: SectorMinimapProps) {
  return (
    <div className="cx3d-minimap" data-testid="cx3d-minimap">
      <div className="cx3d-minimap-title">Sector map</div>
      {sectors.map((s) => (
        <button
          key={s.seriesSlug}
          type="button"
          aria-label={`Fly to ${s.name}`}
          data-testid={`cx3d-minimap-dot-${s.seriesSlug}`}
          className={`cx3d-minimap-dot ${sectorDotClass(s.state)} ${
            activeSlug === s.seriesSlug ? "is-active" : ""
          }`}
          style={{ left: `${s.minimap.x * 100}%`, top: `${s.minimap.y * 100}%` }}
          onClick={() => onSelect(s.seriesSlug)}
        />
      ))}
    </div>
  );
}
