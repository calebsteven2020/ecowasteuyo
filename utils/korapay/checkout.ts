import { KORAPAY_PUBLIC_KEY } from "./info";

declare global {
  interface Window {
    Korapay?: {
      initialize: (config: Record<string, any>) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadKorapayScript(): Promise<void> {
  if (window.Korapay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Korapay checkout script."));
    document.body.appendChild(script);
  });

  return scriptPromise;
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
    narration: opts.narration ?? "EcoWaste payment",
    onSuccess: (data: any) => opts.onSuccess(data),
    onFailed: (data: any) => opts.onFailed?.(data),
    onClose: () => opts.onClose?.(),
  });
}

export function newPaymentReference(prefix = "ECW") {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}