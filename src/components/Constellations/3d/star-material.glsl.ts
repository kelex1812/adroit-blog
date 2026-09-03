/**
 * star-material.glsl.ts — custom star shader (vertex + fragment) as exported
 * GLSL strings (ADR-306: full-advantage Three.js, GPU-first).
 *
 * A `Points` buffer draws thousands of stars with per-star shader
 * attributes — NONE identical (the anti-clip-art rule enforced at the GPU
 * level). Per-star variance (color temperature, size, staggered organic
 * twinkle, spectral diffraction spike) is computed in the shader, never
 * per-star JS.
 *
 * REV 3 (deep-sky v1.2.0): matches the approved v2 demo — sharp-point stars
 * (not bokeh), diffraction spikes on bright stars, a faint spike halo, and
 * depth fog (fade alpha by camera distance) so the field reads as layered.
 * Chromatic aberration is removed scene-wide (it lives here no more); the
 * fringing is replaced by real spectral diffraction crosses on bright stars.
 *
 * RawShaderMaterial (no built-in uniforms), so the standard matrices are
 * declared explicitly. Twinkle is an ORGANIC sum-of-sines (v2 demo) driven by
 * a shader time-uniform (uTime + per-star phase/speed), never a per-star
 * setTimeout.
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
varying float vDepth;

void main() {
  // Organic twinkle (v2): a weighted sum of sines with unique phase + speed,
  // so the field shimmers naturally and never blinks in unison.
  float tw = 0.72 + 0.28 * ( sin(uTime * aTwinkleSpeed + aTwinklePhase) * 0.5
                           + sin(uTime * aTwinkleSpeed * 1.7 + aTwinklePhase * 2.3) * 0.3
                           + sin(uTime * aTwinkleSpeed * 0.6 + aTwinklePhase * 0.7) * 0.2 );
  vTwinkle = tw;
  vSpike = aSpike;
  vColor = aColorTemp;

  // Size from apparent magnitude (brighter/lower mag → larger) + twinkle.
  float size = uSize * (1.7 - aMagnitude * 0.13);

  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // Depth fog: fade with distance from camera so the field is layered. The
  // demo fade window starts ~6 units out and fully fades by ~46.
  vDepth = clamp(1.0 - (-mv.z - 6.0) / 40.0, 0.0, 1.0);
  // Perspective point size: scale by distance so near stars read larger.
  gl_PointSize = size * uPixelRatio * (320.0 / max(-mv.z, 0.1)) * tw;
  gl_Position = projectionMatrix * mv;
}
`;

export const STAR_FRAGMENT_GLSL = /* glsl */ `
precision highp float;

varying vec3 vColor;
varying float vTwinkle;
varying float vSpike;
varying float vDepth;

uniform float uOpacity;
uniform float uSpikeOn;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);

  // Sharp point core (v2): tight falloff so stars read as pinpoints of light,
  // NOT the soft bokeh of the old exp(-d*d*16) disc.
  float core = exp(-d * d * 90.0);

  // Thin spectral diffraction cross on bright stars (per-star intensity).
  float crossMask = exp(-abs(uv.x) * 22.0) + exp(-abs(uv.y) * 22.0);
  float spike = vSpike * crossMask * 0.6 * uSpikeOn;

  // Faint halo bloom only on bright (spiked) stars.
  float halo = exp(-d * d * 8.0) * 0.22 * vSpike;

  float alpha = (core + spike + halo) * vTwinkle * uOpacity * vDepth;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(vColor, alpha);
}
`;
