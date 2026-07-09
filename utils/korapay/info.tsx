// Korapay public key — get yours from the Korapay dashboard (Settings → API Keys).
// This is safe to expose client-side (it's the *public* key, used only to open
// the checkout widget). Replace the placeholder below before going live.
export const KORAPAY_PUBLIC_KEY = "pk_live_EkaXCXDEchCvNxgXz1sqqoQ4ri4L73ccz4HZ69oS";

// Bank account details shown to customers who choose manual bank transfer.
// Update these to your agency's real dedicated/settlement account.
export const BANK_TRANSFER_DETAILS = {
  bankName: "Providus Bank",
  accountName: "EcoWaste Uyo Ltd",
  accountNumber: "0000000000",
};
