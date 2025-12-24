<script setup lang="ts">
import type { MiningSourceType } from '~/types/mining';

const { t, te } = useI18n({
  useScope: 'local',
});
const $toast = useToast();
const $user = useSupabaseUser();
const $route = useRoute();

function parseHashQuery(hash: string) {
  const hashQuery = hash.substring(1); // Remove the leading "#"
  const queryParams = new URLSearchParams(hashQuery);
  return {
    provider: queryParams.get('provider'),
    error: queryParams.get('error'),
    error_description: queryParams.get('error_description'),
    navigate_to: queryParams.get('navigate_to'),
  };
}

const authParams = computed(() => ({
  ...parseHashQuery($route.hash),
  ...$route.query,
}));

const showOAuthErrorNotification = () => {
  const { error, error_description: errorDescription } = authParams.value;
  if (!error) return;

  const messageKey = `error.${error}`;

  const errorTitle = te(`${messageKey}.title`)
    ? t(`${messageKey}.title`)
    : $t('error.default.title');

  const errorMessage = te(`${messageKey}.message`)
    ? t(`${messageKey}.message`)
    : $t('error.default.message');

  $toast.add({
    severity: 'error',
    summary: errorTitle,
    detail: errorDescription || errorMessage,
    life: 5000,
  });
};

onMounted(async () => {
  const { error, provider, navigate_to: navigateToPage } = authParams.value;

  if (
    $user.value &&
    ['oauth-permissions', 'access_denied'].includes(error ?? '') &&
    provider
  ) {
    useMiningConsentSidebar().show(provider as MiningSourceType, undefined, navigateToPage ?? undefined);
  } else {
    showOAuthErrorNotification();
  }

  await nextTick();
  navigateTo(navigateToPage ?? '/');
});
</script>
<i18n lang="json">
{
  "en": {
    "error": {
      "access_denied": {
        "title": "OAuth sign-in",
        "message": "Access denied. You canceled the authentication process."
      }
    }
  },
  "fr": {
    "error": {
      "access_denied": {
        "title": "Connexion OAuth",
        "message": "Accès refusé. Vous avez annulé le processus d'authentification."
      }
    }
  }
}
</i18n>
