export function useMiningCompletionRedirect() {
  const $leadminerStore = useLeadminerStore();
  const { t } = useI18n({ useScope: 'local' });
  const $toast = useToast();
  let redirectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  function cancelRedirect() {
    if (redirectTimeoutId !== null) {
      clearTimeout(redirectTimeoutId);
      redirectTimeoutId = null;
    }
  }

  const stopWatch = watch(
    () => $leadminerStore.miningCompleted,
    (completed) => {
      cancelRedirect();
      if (completed) {
        $toast.add({
          severity: 'success',
          summary: t('mining_complete'),
          group: 'achievement',
          life: 8000,
        });
        redirectTimeoutId = setTimeout(() => {
          navigateTo('/contacts');
        }, 10000);
      }
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    cancelRedirect();
    stopWatch();
  });
}
