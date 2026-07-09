import { KORAPAY_PUBLIC_KEY } from "./info";

declare global {
  interface Window {
    Korapay?: {
      initialize: (config: Record<string, any>) => void;
    };
  }
}

function loadKorapayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Remove any existing Korapay script to force a fresh load
    const existing = document.querySelector('script[src*="korapay"]');
    if (existing) existing.remove();

    // Clear cached instance
    if (window.Korapay) {
      delete window.Korapay;
    }

    const script = document.createElement("script");
    // Add cache-busting timestamp to force fresh script load
    script.src = `https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js?v=${Date.now()}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Korapay checkout script."));
    document.body.appendChild(script);
  });
}

interface KorapayChargeOptions {
  amount: number;
  email: string;
  name?: string;
  reference: string;
  narration?: string;
  onSuccess: (data: any) => void;
  onClose?: () => void;
  onFailed?: (data: any) => void;
}

export async function payWithKorapay(opts: KorapayChargeOptions) {
  await loadKorapayScript();
  if (!window.Korapay) throw new Error("Korapay failed to load.");

  window.Korapay.initialize({
    key: KORAPAY_PUBLIC_KEY,
    reference: opts.reference,
    amount: opts.amount,
    currency: "NGN",
    customer: { email: opts.email, name: opts.name },
    narration: opts.narration ?? "EcoWaste Uyo payment",
    onSuccess: (data: any) => opts.onSuccess(data),
    onFailed: (data: any) => opts.onFailed?.(data),
    onClose: () => opts.onClose?.(),
  });
}

export function newPaymentReference(prefix = "ECW") {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}