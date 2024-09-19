export const CREDITS_PER_CONTACT = 1;
export const CREDITS_MIN_THRESHOLD = 100;
const $profile = useSupabaseUserProfile();

export function refillCredits() {
  window.open(useRuntimeConfig().public.EXTERNAL_REFILL_CREDITS_LINK, '_blank');
}

const showCreditsBadge = useRuntimeConfig().public.ENABLE_CREDIT;

export const CreditsCounter = showCreditsBadge
  ? defineAsyncComponent(
      () => import('~/components/Credits/CreditsCounter.vue'),
    )
  : null;

export const CreditsDialog = showCreditsBadge
  ? defineAsyncComponent(() => import('~/components/Credits/CreditsDialog.vue'))
  : null;

export const CreditsDialogRef = ref<InstanceType<typeof CreditsDialog>>();
export const openCreditsDialog = (
  hasDeficientCredits: boolean,
  totalUnits: number,
  availableUnits: number,
  availableAlreadyUnits: number,
) => {
  CreditsDialogRef.value?.openModal(
    hasDeficientCredits,
    totalUnits,
    availableUnits,
    availableAlreadyUnits,
  );
};

export function useCreditsDialog(contactsToEnrich: string[] | undefined) {
  if (!showCreditsBadge) return false;

  const noCredits = $profile.value?.credits === 0;
  const moreContactsThanCredits =
    contactsToEnrich &&
    contactsToEnrich?.length > ($profile.value?.credits ?? 0);

  if (noCredits || moreContactsThanCredits) {
    openCreditsDialog(true, 0, contactsToEnrich?.length ?? 0, 0);
    return true;
  }
  return false;
}
