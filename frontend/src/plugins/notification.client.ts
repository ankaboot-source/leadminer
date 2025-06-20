export default defineNuxtPlugin({
  name: 'user-listeners',
  setup() {
    const $toast = useToast();
    const $supabaseClient = useSupabaseClient();
    const notificationCenter = useNotificationsStore();

    const authenticated = ref(false);

    if (import.meta.client) {
      watch(authenticated, async (auth) => {
        if (!auth && notificationCenter.subscription) {
          notificationCenter.reset();
          return;
        }
        notificationCenter.subscribe((newNotification) => {
          const { signatures } = newNotification.details || {};

          if (signatures && newNotification.type === 'signature') {
            $toast.add({
              severity: 'success',
              summary: 'Extracted signatures',
              detail: `${signatures} signatures have been extracted`,
              life: 3000,
            });
          }
        });
      });
    }

    $supabaseClient.auth.onAuthStateChange((_, session) => {
      authenticated.value = session !== null;
    });
  },
});
