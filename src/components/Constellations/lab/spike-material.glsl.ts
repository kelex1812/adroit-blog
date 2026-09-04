/**
 * spike-material.glsl.ts — the point-star shader for the Hubble Field lab
 * (ADR-310: stars are point shaders, never bokeh sprites).
 *
 * Every star in the field is one vertex in a `Points` buffer carrying its own
 * spectral temperature, apparent magnitude, twinkle phase/speed and spike
 * weight. The fragment shader draws a hot sub-pixel Gaussian core with a steep
 * falloff — the opposite of the soft radial sprite that bloom turns into
 * bokeh — and adds a fixed-orientation diffraction cross ONLY to the stars
 * whose spike weight clears `uSpikeThreshold`.
 *
 * Differences from the shipped `3d/star-material.glsl.ts`:
 *   - Brightness is real Pogson flux from apparent magnitude, so the authored
 *     magnitude distribution IS the luminosity function (steep, not flat).
 *   - Sub-pixel stars are inflated to a drawable size and dimmed to
 *     compensate, which is what keeps the faint end reading as faint rather
 *     than aliasing into a uniform speckle.
 *   - `uIllumination` raises a visibility floor, so rank illumination adds and
 *     removes stars from the sky instead of labelling a chip (ADR-312).
 *   - Spikes are gated by a uniform threshold, so "spikes are earned" is a
 *     reviewable slider rather than a hardcoded constant.
 *
 * `RawShaderMaterial` (GLSL1), so the standard matrices are declared here.
 */

/** Uniform names this material expects — kept in one place for the wrapper. */
export interface SpikeStarUniformValues {
  /** Shader clock (seconds). Frozen at 0 for reduced motion / static mode. */
  uTime: number;
  /** Device pixel ratio, clamped by the caller (cap 2). */
  uPixelRatio: number;
  /** Base point-size multiplier for the whole buffer. */
  uSize: number;
  /** Master alpha (0..1). */
  uOpacity: number;
  /** Exposure — scales luminance before the core/spike mix. */
  uExposure: number;
  /** Rank illumination (0..1) — lowers the visibility floor as it rises. */
  uIllumination: number;
  /** Spike weight a star must clear before it throws a diffraction cross. */
  uSpikeThreshold: number;
  /** Spike arm intensity. */
  uSpikeGain: number;
  /** Camera-distance fade window as (near, far). */
  uFade: [number, number];
}

export const SPIKE_STAR_VERTEX_GLSL = /* glsl */ `
precision highp float;

attribute vec3 position;
attribute vec3 aColorTemp;    // spectral color, linear RGB (OBAFGKM ramp)
attribute float aMagnitude;   // real apparent magnitude (lower = brighter)
attribute float aTwinklePhase;// unique phase offset (rad)
attribute float aTwinkleSpeed;// unique scintillation speed
attribute float aSpike;       // diffraction-cross weight (0..1)

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;
uniform float uExposure;
uniform float uIllumination;
uniform float uSpikeThreshold;
uniform vec2 uFade;

varying vec3 vColor;
varying float vLum;
varying float vSpike;
varying float vFade;
varying float vSubPixel;
varying float vTwinkle;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float dist = max(-mv.z, 0.05);

  // Pogson flux: one magnitude step is x2.512 in brightness. Feeding the
  // magnitude through this is what turns the authored distribution into a real
  // luminosity function instead of a size ramp.
  float flux = pow(10.0, -0.4 * (aMagnitude - 1.0));
  float b = pow(flux, 0.30);

  // Faint stars scintillate hardest; the brightest barely waver. Sum of sines
  // with a per-star phase and speed so the field never blinks in unison.
  float amp = mix(0.05, 0.32, clamp(aMagnitude / 7.5, 0.0, 1.0));
  float wobble = sin(uTime * aTwinkleSpeed + aTwinklePhase) * 0.5
               + sin(uTime * aTwinkleSpeed * 1.73 + aTwinklePhase * 2.3) * 0.3
               + sin(uTime * aTwinkleSpeed * 0.61 + aTwinklePhase * 0.7) * 0.2;
  float tw = 1.0 - amp + amp * wobble;

  vTwinkle = tw;
  vColor = aColorTemp;

  // Rank illumination as a visibility floor: at low rank only the brightest
  // stars clear it, so the sky fills in as the learner progresses. The floor
  // never reaches 1.0 — an unlit sky must still read as a sky.
  float visFloor = mix(0.40, 0.015, clamp(uIllumination, 0.0, 1.0));
  float vis = smoothstep(visFloor, visFloor + 0.22, b);

  vLum = pow(flux, 0.35) * uExposure * vis;
  vSpike = smoothstep(uSpikeThreshold, min(uSpikeThreshold + 0.14, 1.0), aSpike) * vis;

  // Depth fade with a floor, so distance dims the far shells without emptying
  // them (a deep field is layered, not truncated).
  vFade = clamp(1.0 - (dist - uFade.x) / max(uFade.y - uFade.x, 1.0), 0.22, 1.0);

  float px = uSize * (0.055 + 0.21 * b) * uPixelRatio * (300.0 / dist) * tw;
  float drawn = clamp(max(px, 1.25 * uPixelRatio), 1.0, 42.0);
  vSubPixel = clamp(px / drawn, 0.0, 1.0);

  gl_PointSize = drawn;
  gl_Position = projectionMatrix * mv;
}
`;

export const SPIKE_STAR_FRAGMENT_GLSL = /* glsl */ `
precision highp float;

varying vec3 vColor;
varying float vLum;
varying float vSpike;
varying float vFade;
varying float vSubPixel;
varying float vTwinkle;

uniform float uOpacity;
uniform float uSpikeGain;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d2 = dot(uv, uv);

  // Hot sub-pixel core: a steep Gaussian plus a much tighter second lobe.
  // Deliberately NOT exp(-d*d*16) — that width is what reads as bokeh.
  float core = exp(-d2 * 150.0) + 0.42 * exp(-d2 * 46.0);

  float alpha = core * vLum;

  if (vSpike > 0.0) {
    vec2 a = abs(uv);
    // Fixed-orientation diffraction cross. Real spikes come from the
    // telescope's spider vanes, so they share one orientation across the whole
    // frame and never rotate per star.
    float arms = exp(-a.y * 300.0) * exp(-a.x * 2.6)
               + exp(-a.x * 300.0) * exp(-a.y * 2.6);
    float halo = exp(-d2 * 11.0) * 0.13;
    alpha += (arms * 0.85 * uSpikeGain + halo) * vSpike * vLum;
  }

  // Sub-pixel compensation is applied super-linearly: an inflated 1px star has
  // to lose more than its area in brightness to still read as one dim pixel.
  alpha *= vTwinkle * vFade * uOpacity * pow(vSubPixel, 1.4);
  if (alpha < 0.0035) discard;

  // The hottest cores blow out toward white; the spectral tint survives in the
  // falloff and in the spike arms.
  vec3 c = mix(vColor, vec3(1.0), clamp(core * vLum * 0.55, 0.0, 0.85));
  gl_FragColor = vec4(c, clamp(alpha, 0.0, 1.0));
}
`;

/** Default uniform values — the lab's starting point for every Points buffer. */
export const SPIKE_STAR_DEFAULTS: SpikeStarUniformValues = {
  uTime: 0,
  uPixelRatio: 1,
  uSize: 1,
  uOpacity: 1,
  uExposure: 1,
  uIllumination: 1,
  uSpikeThreshold: 0.42,
  uSpikeGain: 1,
  uFade: [10, 150],
};
