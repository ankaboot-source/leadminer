export const CREDITS_PER_EMAIL = 1;
export const CREDITS_PER_CONTACT = 10;
export const CREDITS_MIN_THRESHOLD = 10000;

export function refillCreditsOrUpgrade() {
  window.open(useRuntimeConfig().public.EXTERNAL_REFILL_CREDITS_LINK, '_blank');
}
