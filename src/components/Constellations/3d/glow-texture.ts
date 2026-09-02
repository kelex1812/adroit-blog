/**
 * glow-texture.ts — procedural radial-gradient sprite texture (no asset).
 *
 * Produces the soft round "point of light" falloff that additive star sprites
 * sample. A lit star reads as a glowing dot, never a drawn cross (design
 * lesson: stars are layered LIGHT, not strokes). Called only in the browser.
 */
import * as THREE from "three";

/** Shared cache so we don't rebuild the texture per star. */
let cached: THREE.Texture | null = null;

/** Build (once) a 128px radial glow sprite texture. */
export function glowTexture(): THREE.Texture {
  if (cached) return cached;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const r = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.25, "rgba(255,255,255,0.95)");
    r.addColorStop(0.55, "rgba(255,255,255,0.5)");
    r.addColorStop(0.8, "rgba(255,255,255,0.18)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  cached = tex;
  return tex;
}
