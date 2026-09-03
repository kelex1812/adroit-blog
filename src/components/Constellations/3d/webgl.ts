/**
 * webgl.ts — WebGL support detection (SSR-safe).
 *
 * The 3D canvas needs WebGL; when unavailable (very old device, headless
 * render, iframe policies), we fall back to the 2D constellation. Detection is
 * pure-ish (injectable `ctxGetter` for tests) and guarded for SSR (no window).
 */
export interface WebGLDetectOptions {
  /** Test-only: provide a fake `getContext` result. */
  ctxGetter?: () => unknown;
  /** Test-only: force a canvas stub. */
  documentStub?: { createElement: (tag: string) => { getContext: () => unknown } };
  /** Test-only: inject global window. */
  windowStub?: unknown;
}

/** True when the current environment can render WebGL. SSR → false. */
export function supportsWebGL(opts: WebGLDetectOptions = {}): boolean {
  if (opts.windowStub === undefined && typeof window === "undefined") {
    return false;
  }
  const win = (opts.windowStub ?? window) as Window & {
    WebGLRenderingContext?: unknown;
    WebGL2RenderingContext?: unknown;
  };
  // No WebGL API at all → no support.
  if (!win.WebGLRenderingContext && !win.WebGL2RenderingContext) return false;

  const doc = opts.documentStub ?? document;
  try {
    const canvas = doc.createElement("canvas") as HTMLCanvasElement & {
      getContext: (id: string, attrs?: object) => unknown;
    };
    const ctx = opts.ctxGetter
      ? opts.ctxGetter()
      : canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ??
        canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });
    return Boolean(ctx);
  } catch {
    return false;
  }
}
