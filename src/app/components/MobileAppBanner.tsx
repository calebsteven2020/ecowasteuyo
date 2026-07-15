import { useEffect, useState } from "react";
import { X, Smartphone } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { APK_DOWNLOAD_URL } from "../constants";

const DISMISSED_KEY = "ecowaste_apk_banner_dismissed_until";
const SNOOZE_DAYS = 14;

function wasRecentlyDismissed(): boolean {
  const raw = localStorage.getItem(DISMISSED_KEY);
  if (!raw) return false;
  const until = Number(raw);
  return Number.isFinite(until) && Date.now() < until;
}

/**
 * Sticky bottom banner nudging mobile Android web visitors toward the APK
 * download. Deliberately narrow in scope so it never nags the wrong person:
 *  - Never renders inside the native app itself (Capacitor.isNativePlatform())
 *    — someone already using the app doesn't need to be told to get it.
 *  - Only renders on Android — there's no real iOS build to send anyone to
 *    yet, so showing this to iPhone visitors would just be a dead end.
 *  - Only renders below the sm breakpoint (see className) — on desktop the
 *    "Get the app" section further down the homepage already covers this.
 *  - Dismissing it snoozes it for 14 days per browser (localStorage), not
 *    forever — people who close it by reflex still see it again later
 *    without it being permanently gone after one stray tap.
 */
export function MobileAppBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    if (!/Android/i.test(navigator.userAgent)) return;
    if (wasRecentlyDismissed()) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
    setVisible(false);
  };

  return (
    <div
      className="sm:hidden fixed bottom-0 inset-x-0 z-50 flex items-center gap-3 px-4 py-3"
      style={{
        background: "#1a2e1c",
        borderTop: "1px solid rgba(247,245,240,0.12)",
        paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
      }}
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(247,245,240,0.1)" }}>
        <Smartphone className="w-5 h-5" style={{ color: "#f7f5f0" }} />
      </div>

      <div className="flex-1 min-w-0">
        <p style={{ color: "#f7f5f0", fontWeight: 700, fontSize: "0.78rem", lineHeight: 1.2 }}>Get the EcoWaste Uyo app</p>
        <p style={{ color: "rgba(247,245,240,0.6)", fontSize: "0.68rem", lineHeight: 1.3, marginTop: "0.1rem" }}>Faster booking, right from your phone</p>
      </div>

      <a
        href={APK_DOWNLOAD_URL}
        download="ecowaste-uyo.apk"
        className="px-3.5 py-2 rounded-full flex-shrink-0"
        style={{ background: "#008751", color: "#fff", fontWeight: 600, fontSize: "0.72rem" }}
      >
        Download
      </a>

      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="p-1 flex-shrink-0"
        style={{ color: "rgba(247,245,240,0.5)" }}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
