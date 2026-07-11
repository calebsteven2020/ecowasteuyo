import { useEffect, useState } from "react";
import { initLiteModeDetection } from "../../../utils/perf/liteMode";

/**
 * Returns true once this device has been flagged as needing the
 * lightweight rendering path (see utils/perf/liteMode.ts for why).
 *
 * Starts as `false` and may flip to `true` after some scrolling if a
 * GPU rasterization problem is detected — components using this hook
 * should be fine either rendering their normal look-and-feel or their
 * lite look-and-feel at any point.
 */
export function useLiteMode(): boolean {
  const [lite, setLite] = useState(false);

  useEffect(() => {
    const cleanup = initLiteModeDetection((value) => setLite(value));
    return cleanup;
  }, []);

  return lite;
}
