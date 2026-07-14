import { App as CapacitorApp } from "@capacitor/app";
import { supabase } from "../supabase/client";
import { isNativeApp } from "../perf/liteMode";

/**
 * Registers a listener for the native app being opened via a deep link
 * (custom URL scheme: ecowasteuyo://...). Used specifically to catch the
 * Supabase email-confirmation redirect and finish signing the person in
 * automatically inside the app, instead of dropping them on the website.
 *
 * No-op outside the native app (isNativeApp() guards it) — safe to call
 * unconditionally from Root.tsx.
 *
 * Returns a cleanup function; call it on unmount.
 */
export function initAuthDeepLinkHandler(onSignedIn: () => void): () => void {
  if (!isNativeApp()) return () => {};

  let removed = false;
  const handlePromise = CapacitorApp.addListener("appUrlOpen", async ({ url }) => {
    try {
      if (!url.startsWith("ecowasteuyo://auth-callback")) return;

      const parsed = new URL(url);

      // PKCE flow: ecowasteuyo://auth-callback?code=...
      const code = parsed.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { console.error("[deep link] exchangeCodeForSession:", error); return; }
        onSignedIn();
        return;
      }

      // Implicit flow: ecowasteuyo://auth-callback#access_token=...&refresh_token=...
      const hash = url.split("#")[1];
      if (hash) {
        const hashParams = new URLSearchParams(hash);
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) { console.error("[deep link] setSession:", error); return; }
          onSignedIn();
        }
      }
    } catch (err) {
      console.error("[deep link] failed to handle appUrlOpen:", err);
    }
  });

  return () => {
    if (removed) return;
    removed = true;
    handlePromise.then(handle => handle.remove());
  };
}
