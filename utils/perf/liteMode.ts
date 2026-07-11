// ── Lite-mode detection ──────────────────────────────────────────────
//
// Some Android phones ship with a Chrome + GPU driver combination that
// has a genuine rendering bug: GPU rasterization corrupts tiles during
// fast scroll (torn images, ghosted/duplicated content). It's a bug in
// the browser/driver, not something a page's CSS can fix directly — but
// a page CAN detect it and fall back to a cheaper rendering path so
// affected visitors get a stable (if slightly plainer) experience
// automatically, without ever touching chrome://flags.
//
// Two detection strategies, run client-side only:
//
// 1. GPU renderer string match — instant, catches known-bad chipsets.
// 2. Runtime jank watchdog — catches everything else, including devices
//    not yet in the blocklist. If scrolling is producing large frame
//    gaps, we assume the GPU can't keep up and flip on lite mode.
//
// The result is cached in localStorage so it's a one-time cost per
// device, not re-measured on every visit.

const STORAGE_KEY = "ew_lite_mode";

// Best-effort list of GPU families known to have tiling/rasterization
// bugs on some Chrome/Android builds. This is NOT exhaustive — it only
// catches devices we already know about. Extend it as you confirm more
// affected devices (see getGpuRendererString() below to identify one).
const KNOWN_BAD_GPU_PATTERNS = [
  "mali-4",     // Mali-400/450 (Utgard) — old, very common tiling bugs
  "mali-t6",    // Mali-T6xx (early Midgard)
  "mali-t7",    // Mali-T7xx
  "mali-t8",    // Mali-T8xx
  "powervr sgx", // Old Imagination PowerVR SGX
  "adreno (tm) 3", // Adreno 3xx
  "mali-g52",   // Confirmed: rounded-corner clip/stencil corruption during scroll
];

export function getGpuRendererString(): string | null {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return null;
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    return typeof renderer === "string" ? renderer : null;
  } catch {
    return null;
  }
}

function isKnownBadGpu(): boolean {
  const renderer = getGpuRendererString();
  if (!renderer) return false;
  const lower = renderer.toLowerCase();
  return KNOWN_BAD_GPU_PATTERNS.some((p) => lower.includes(p));
}

function readCachedDecision(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function cacheDecision(lite: boolean) {
  try {
    if (lite) localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // localStorage unavailable (private mode etc.) — fine, just skip caching
  }
}

// Capacitor exposes this on `window` inside the native app shell (Android/iOS),
// but not when the same bundle is loaded in a regular mobile browser tab.
declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

/**
 * True when running inside the compiled native app (Capacitor), false when
 * running in an ordinary mobile browser tab. The GPU tiling/rasterization
 * bug this module works around is specific to mobile Chrome's rendering
 * pipeline — the native app shell uses a different WebView configuration
 * and doesn't exhibit it, so lite mode should never engage there.
 */
export function isNativeApp(): boolean {
  try {
    return window.Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

/**
 * Starts a short-lived scroll-jank watchdog. If frame times balloon
 * during scroll (a strong signal the GPU is falling behind on
 * rasterization), calls onJanky() once and stops watching.
 * Returns a cleanup function.
 */
function watchForScrollJank(onJanky: () => void): () => void {
  let rafId = 0;
  let lastTime = 0;
  let sampleCount = 0;
  let jankyFrames = 0;
  let watching = false;
  const MAX_SAMPLES = 90; // roughly 1.5s of frames at 60fps
  const JANK_THRESHOLD_MS = 50; // a frame taking >50ms means multiple dropped frames
  const JANKY_FRAMES_TO_TRIGGER = 6;

  function tick(now: number) {
    if (!watching) return;
    const dt = now - lastTime;
    lastTime = now;
    sampleCount++;
    if (dt > JANK_THRESHOLD_MS) jankyFrames++;

    if (jankyFrames >= JANKY_FRAMES_TO_TRIGGER) {
      watching = false;
      onJanky();
      return;
    }
    if (sampleCount < MAX_SAMPLES) {
      rafId = requestAnimationFrame(tick);
    } else {
      watching = false;
    }
  }

  function onScroll() {
    watching = true;
    sampleCount = 0;
    jankyFrames = 0;
    lastTime = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    window.removeEventListener("scroll", onScroll);
    cancelAnimationFrame(rafId);
  };
}

/**
 * Runs the full lite-mode decision process.
 * `onChange` is called (possibly asynchronously, after some scrolling)
 * if lite mode should be turned on. Returns a cleanup function.
 */
export function initLiteModeDetection(onChange: (lite: boolean) => void): () => void {
  // Native app shell: never lite, regardless of a stale cached decision
  // from earlier testing in the mobile browser on the same device.
  if (isNativeApp()) {
    onChange(false);
    return () => {};
  }

  if (readCachedDecision()) {
    onChange(true);
    return () => {};
  }

  if (isKnownBadGpu()) {
    cacheDecision(true);
    onChange(true);
    return () => {};
  }

  return watchForScrollJank(() => {
    cacheDecision(true);
    onChange(true);
  });
}