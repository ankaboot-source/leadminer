<script setup lang="ts">
const $toast = useToast();
const user = useSupabaseUser();
const route = useRoute();
const $contactsStore = useContactsStore();

function parseHashQuery(hash: string) {
  const hashQuery = hash.substring(1); // Remove the leading "#"
  const queryParams = new URLSearchParams(hashQuery);
  const error = queryParams.get('error');
  const error_description = queryParams.get('error_description');
  const navigate_to = queryParams.get('navigate_to');
  return { error, error_description, navigate_to };
}

const { error_description: errorDescription, navigate_to: navigateToPage } = {
  ...parseHashQuery(route.hash),
  ...route.query,
};

onMounted(() => {
  if (errorDescription?.length) {
    $toast.add({
      severity: 'error',
      detail: decodeURIComponent(errorDescription as string),
      life: 5000,
    });
  }

  if (!user.value) {
    navigateTo('/auth/login');
    return;
  }

  watch(
    user,
    async () => {
      if (user.value) {
        await nextTick();
        if (navigateToPage) {
          navigateTo(navigateToPage);
        } else if ($contactsStore.contactCount) {
          navigateTo('/contacts');
        } else {
          navigateTo('/mine');
        }
      }
    },
    { immediate: true },
  );
});
</script>
