export interface MinimalProfile {
  full_name?: string | null;
  phone?: string | null;
  address?: string | null;
}

/**
 * A profile is "complete enough to pay" once it has a name, phone, and
 * address — Korapay needs a name, and the driver/agent needs a phone +
 * address to actually complete a pickup. Missing any of these used to
 * let the Korapay widget silently fail to open (it needs `customer.name`),
 * which looked like the pay button just "toggling" with nothing happening.
 */
export function isProfileComplete(profile: MinimalProfile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(profile.full_name?.trim() && profile.phone?.trim() && profile.address?.trim());
}

export const PROFILE_INCOMPLETE_MESSAGE =
  "Please complete your profile (name, phone & address) before making a payment.";
