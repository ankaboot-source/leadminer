export const CREDITS_PER_CONTACT = 1;
export const CREDITS_MIN_THRESHOLD = 100;

export function refillCreditsOrUpgrade() {
  window.open(useRuntimeConfig().public.EXTERNAL_REFILL_CREDITS_LINK, '_blank');
}
