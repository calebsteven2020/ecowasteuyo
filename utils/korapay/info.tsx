// Korapay public key — now comes from .env (VITE_KORAPAY_PUBLIC_KEY) instead
// of being hardcoded. This is safe to expose client-side either way (it's
// the *public* key, used only to open the checkout widget) — moving it to
// .env is about keeping it out of git history and easy to swap between
// test/live keys per environment, not about hiding it.
export const KORAPAY_PUBLIC_KEY = import.meta.env.VITE_KORAPAY_PUBLIC_KEY;

if (!KORAPAY_PUBLIC_KEY) {
  throw new Error(
    "Missing VITE_KORAPAY_PUBLIC_KEY. Copy .env.example to .env and fill in your Korapay public key (Korapay dashboard → Settings → API Keys)."
  );
}

// Bank account details shown to customers who choose manual bank transfer.
// Update these to your agency's real dedicated/settlement account.
export const BANK_TRANSFER_DETAILS = {
  bankName: "Zenith Bank",
  accountName: "Caleb Francis",
  accountNumber: "2361105176",
};