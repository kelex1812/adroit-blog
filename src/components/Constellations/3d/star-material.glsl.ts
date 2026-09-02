/**
 * star-material.glsl.ts — custom star shader (vertex + fragment) as exported
 * GLSL strings (ADR-306: full-advantage Three.js, GPU-first).
 *
 * A single `Points` buffer draws thousands of stars with per-star shader
 * attributes — NONE identical (the anti-clip-art rule enforced at the GPU
 * level). Per-star variance (color temperature, size, staggered twinkle,
 * spectral diffraction spike) is computed in the shader, never per-star JS.
 *
 * RawShaderMaterial (no built-in uniforms), so the standard matrices are
 * declared explicitly. Twinkle is a shader time-uniform (uTime + per-star
 * phase/speed), never per-star setTimeout.
 */

export const STAR_VERTEX_GLSL = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute vec3 aColorTemp;   // spectral color (OBAFGKM ramp)
attribute float aMagnitude;   // apparent magnitude (lower = brighter/larger)
attribute float aTwinklePhase;// unique phase offset (rad)
attribute float aTwinkleSpeed;// unique twinkle speed
attribute float aSpike;       // spectral diffraction-cross intensity

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;

varying vec3 vColor;
varying float vTwinkle;
varying float vSpike;

void main() {
  // Staggered twinkle: unique phase + speed per star, so they never blink in
  // unison. Slight drift in the vertex stage keeps the field alive without a
  // hot JS loop.
  float tw = 0.72 + 0.28 * sin(uTime * aTwinkleSpeed + aTwinklePhase);
  vTwinkle = tw;
  vSpike = aSpike;
  vColor = aColorTemp;

  // Size from apparent magnitude (brighter/lower mag → larger) + twinkle.
  float size = uSize * (1.7 - aMagnitude * 0.13) * tw;

  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // Perspective point size: scale by distance so near stars read larger.
  gl_PointSize = size * uPixelRatio * (320.0 / max(-mv.z, 0.1));
  gl_Position = projectionMatrix * mv;
}
`;

export const STAR_FRAGMENT_GLSL = /* glsl */ `
precision highp float;

varying vec3 vColor;
varying float vTwinkle;
varying float vSpike;

uniform float uOpacity;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);

  // Soft radial falloff — a glowing round point of light, never a hard disc
  // (design lesson: stars are layered LIGHT, not drawn strokes).
  float glow = exp(-d * d * 16.0);

  // Thin spectral diffraction cross (per-star intensity) — the faintest trace
  // of a spike, so hot stars read as real point sources, not emoji.
  float crossMask = exp(-abs(uv.x) * 60.0) + exp(-abs(uv.y) * 60.0);
  float spike = vSpike * crossMask * 0.18;

  float alpha = (glow + spike) * vTwinkle * uOpacity;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(vColor, alpha);
}
`;
