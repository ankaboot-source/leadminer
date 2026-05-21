<template>
  <Dialog
    v-model:visible="showGoogleWorkspaceDialog"
    modal
    :draggable="false"
    :header="googleWorkspaceDialogTitle"
    :closable="true"
    @hide="onGoogleWorkspaceDialogDismiss"
  >
    <p>{{ googleWorkspaceDialogMessage }}</p>
    <div class="flex justify-end gap-2 pt-4">
      <Button
        :label="$t('common.close')"
        severity="secondary"
        @click="onGoogleWorkspaceDialogDismiss"
      />
      <Button
        label="Learn more"
        icon="pi pi-external-link"
        iconPos="right"
        @click="openGoogleWorkspaceDoc"
      />
    </div>
  </Dialog>
</template>

<script setup lang="ts">
import type { MiningSourceType } from '~/types/mining';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';

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

const GOOGLE_WORKSPACE_DOC_URL =
  'https://support.google.com/a/answer/10547014?hl=en';

const showGoogleWorkspaceDialog = ref(false);
const pendingNavigateTo = ref<string | null>(null);
const googleWorkspaceDialogTitle = ref('');
const googleWorkspaceDialogMessage = ref('');

function isGoogleWorkspaceError(params: {
  error: string | null;
  error_description: string | null;
  provider: string | null;
}): boolean {
  if (params.provider !== 'google') return false;
  if (params.error === 'admin_policy_enforced') return true;
  if (params.error_description) {
    const desc = params.error_description.toLowerCase();
    if (
      desc.includes('admin') ||
      desc.includes('policy') ||
      desc.includes('workspace')
    ) {
      return true;
    }
  }
  return false;
}

function showGoogleWorkspaceError(
  title: string,
  message: string,
  navigateTo: string | null,
) {
  googleWorkspaceDialogTitle.value = title;
  googleWorkspaceDialogMessage.value = message;
  pendingNavigateTo.value = navigateTo;
  showGoogleWorkspaceDialog.value = true;
}

function openGoogleWorkspaceDoc() {
  window.open(GOOGLE_WORKSPACE_DOC_URL, '_blank', 'noopener,noreferrer');
  showGoogleWorkspaceDialog.value = false;
  navigateTo(pendingNavigateTo.value ?? '/');
}

function onGoogleWorkspaceDialogDismiss() {
  showGoogleWorkspaceDialog.value = false;
  navigateTo(pendingNavigateTo.value ?? '/');
}

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
    useMiningConsentSidebar().show(
      provider as MiningSourceType,
      undefined,
      navigateToPage ?? undefined,
    );
  } else if (error && isGoogleWorkspaceError(authParams.value)) {
    const messageKey = `error.${error}`;
    const title = te(`${messageKey}.title`)
      ? t(`${messageKey}.title`)
      : t('error.google_workspace.title');
    const message = te(`${messageKey}.message`)
      ? t(`${messageKey}.message`)
      : t('error.google_workspace.message');

    showGoogleWorkspaceError(title, message, navigateToPage);
    return; // Don't navigate yet — dialog controls navigation via @hide
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
      "admin_policy_enforced": {
        "title": "Google Workspace",
        "message": "Your Google Workspace administrator has restricted access to this application. Please contact your admin or check the IMAP settings."
      },
      "google_workspace": {
        "title": "Google Workspace Setup",
        "message": "Connecting to Google Workspace requires specific IMAP or OAuth settings. Please refer to the official documentation for setup instructions."
      }
    }
  },
  "fr": {
    "error": {
      "access_denied": {
        "title": "Connexion OAuth",
        "message": "Accès refusé. Vous avez annulé le processus d'authentification."
      },
      "admin_policy_enforced": {
        "title": "Google Workspace",
        "message": "Votre administrateur Google Workspace a restreint l'accès à cette application. Veuillez contacter votre administrateur ou vérifier les paramètres IMAP."
      },
      "google_workspace": {
        "title": "Configuration Google Workspace",
        "message": "La connexion à Google Workspace nécessite des paramètres IMAP ou OAuth spécifiques. Veuillez consulter la documentation officielle pour les instructions de configuration."
      }
    }
  }
}
</i18n>
