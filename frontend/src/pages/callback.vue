<script setup lang="ts">
import type { MiningSourceType } from '~/types/mining';

const { t } = useI18n({
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
  const errorTitle = t(`${messageKey}.title`) || t('auth.error.default.title');
  const errorMessage =
    t(`${messageKey}.message`) || t('auth.error.default.message');

  $toast.add({
    severity: 'error',
    summary: errorTitle,
    detail: errorDescription || errorMessage,
    life: 5000,
  });
};

onMounted(async () => {
  const { error, provider, navigate_to: navigateToPage } = authParams.value;

  if ($user.value && error === 'oauth-permissions' && provider) {
    useMiningConsentSidebar().show(provider as MiningSourceType);
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
      },
      "default": {
        "title": "Unexpected error",
        "message": "An unexpected error occurred. Please try again."
      }
    }
  },
  "fr": {
    "error": {
      "access_denied": {
        "title": "Connexion OAuth",
        "message": "Accès refusé. Vous avez annulé le processus d'authentification."
      },
      "default": {
        "title": "Erreur inattendue",
        "message": "Une erreur inattendue s'est produite. Veuillez réessayer."
      }
    }
  }
}
</i18n>
