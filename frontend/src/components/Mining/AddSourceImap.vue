<template>
  <Button
    outlined
    :label="t('other_email_provider')"
    icon="pi pi-inbox"
    @click="show = true"
  />
  <Dialog
    v-model:visible="show"
    modal
    :header="t('sign_in_with_imap')"
    class="md:w-[30rem]"
  >
    <div class="flex flex-col space-y-2">
      <div class="w-full flex flex-col gap-1">
        <label for="email">Email</label>
        <InputText
          v-model="imapEmail"
          :disabled="loadingSave"
          :invalid="invalidEmailInput(imapEmail)"
          class="w-full"
          @click="resetAdvancedSettings"
          @update:model-value="imapAdvancedSettings = false"
        />
      </div>
      <div class="w-full flex flex-col gap-1">
        <label for="password">{{ $t('auth.password') }}</label>
        <InputText
          v-model="imapPassword"
          class="w-full"
          type="password"
          :invalid="invalidImapPassword(imapPassword)"
        />
      </div>
      <template v-if="imapAdvancedSettings">
        <div class="w-full flex flex-col gap-1">
          <label for="host">{{ t('host') }}</label>
          <InputText
            v-model="imapHost"
            class="w-full"
            :invalid="invalidImapHost(imapHost)"
          />
        </div>
        <div class="w-full flex flex-col gap-1">
          <label for="port">{{ t('port') }}</label>
          <InputNumber
            v-model="imapPort"
            show-buttons
            class="w-full"
            :invalid="isInvalidImapPort(imapPort)"
          />
        </div>
        <div class="w-full flex flex-row items-center gap-1">
          <Checkbox v-model="imapSecureConnection" :binary="true" />
          <label for="port">TLS/SSL</label>
        </div>
      </template>

      <div
        class="flex flex-col sm:flex-row justify-between pt-4 sm:space-x-2 space-y-2 sm:space-y-0"
      >
        <div>
          <Button
            type="button"
            class="w-full sm:w-auto"
            :label="$t('common.cancel')"
            severity="secondary"
            @click="show = false"
          ></Button>
        </div>
        <div
          class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2"
        >
          <Button
            v-if="!imapAdvancedSettings"
            type="button"
            class="w-full sm:w-auto"
            :label="t('Button.advanced')"
            :loading="loadingSave"
            severity="secondary"
            @click="imapAdvancedSettings = true"
          />
          <Button
            type="button"
            class="w-full sm:w-auto"
            :label="t('Button.connect')"
            :loading="loadingSave"
            :disabled="isInvalidEmail(imapEmail) || imapPassword.length === 0"
            @click="onSubmitImapCredentials"
          />
        </div>
      </div>
    </div>
  </Dialog>
</template>
<script setup lang="ts">
import { FetchError } from 'ofetch';

import { isInvalidEmail } from '@/utils/email';
import type { MiningSource } from '~/types/mining';

const { t } = useI18n({
  useScope: 'local',
});

interface ImapConfigs {
  host: string;
  port: number;
  secure: boolean;
}

const show = defineModel<boolean>('show');

const $toast = useToast();
const { $api } = useNuxtApp();
const $user = useSupabaseUser();
const imapSource = defineModel<MiningSource>('source');

const imapAdvancedSettings = ref(false);

const imapEmail = ref<string>($user.value?.email ?? '');
const imapPassword = ref<string>('');
const imapHost = ref<string>('');
const imapPort = ref(993);
const imapSecureConnection = ref(true);

const formErrors: Record<string, Ref> = {
  email: ref(false),
  password: ref(false),
  host: ref(false),
  port: ref(false),
};

const loadingSave = ref(false);

const invalidEmailInput = (email: string | undefined) =>
  formErrors.email.value || !email?.length || isInvalidEmail(email);

const invalidImapPassword = (password: string | undefined) =>
  formErrors.password.value || !password?.length || password.length === 0;

const isInvalidImapPort = (port: number) =>
  formErrors.port.value || !(port > 0 && port <= 65536);

const invalidImapHost = (host: string | undefined) =>
  formErrors.host.value || !host?.length || host.length === 0;

const resetAdvancedSettings = (): void => {
  imapHost.value = '';
  imapPort.value = 993;
  imapSecureConnection.value = true;
};

function resetFormErrors() {
  Object.values(formErrors).forEach((error) => {
    error.value = false;
  });
}

watch(show, (value) => {
  if (!value) {
    resetFormErrors();
    imapAdvancedSettings.value = false;
    imapEmail.value = $user.value?.email as string;
  }
});

function handleImapConfigsNotDetected() {
  $toast.add({
    severity: 'warn',
    summary: t('sign_in_with_imap'),
    detail: t('unable_to_detect'),
    life: 5000,
  });
  imapAdvancedSettings.value = true;
}

function handleAuthenticationErrors(err: FetchError) {
  if (err.data?.fields) {
    err.data?.fields.forEach((field: string) => {
      if (['host', 'port'].includes(field)) {
        imapAdvancedSettings.value = true;
      }
      formErrors[field].value = true;
    });
  }

  $toast.add({
    severity: 'error',
    summary: t('sign_in_with_imap'),
    detail: err.data.message,
    life: 5000,
  });
}

async function getImapConfigsForEmail(
  email: string
): Promise<ImapConfigs | null> {
  try {
    const configs =
      imapHost.value && imapPort.value
        ? {
            host: imapHost.value,
            port: imapPort.value,
            secure: imapSecureConnection.value,
          }
        : await $api<ImapConfigs | null>(`/imap/config/${email}`, {
            method: 'GET',
          });
    return configs;
  } catch (err) {
    return null;
  }
}

async function onSubmitImapCredentials() {
  loadingSave.value = true;
  try {
    resetFormErrors();
    const configs = await getImapConfigsForEmail(imapEmail.value);

    if (!configs) {
      loadingSave.value = false;
      handleImapConfigsNotDetected();
      return;
    }

    imapHost.value = configs.host;
    imapPort.value = configs.port;
    imapSecureConnection.value = configs.secure;

    await $api('/imap/mine/sources/imap', {
      method: 'POST',
      body: {
        email: imapEmail.value,
        password: imapPassword.value,
        ...configs,
      },
    });

    imapSource.value = {
      type: 'imap',
      email: imapEmail.value,
      isValid: true,
    };
    show.value = false;
  } catch (err) {
    if (err instanceof FetchError) {
      handleAuthenticationErrors(err);
    } else {
      throw err;
    }
  } finally {
    loadingSave.value = false;
  }
}
</script>

<i18n lang="json">
{
  "en": {
    "other_email_provider": "Other email provider (IMAP)",
    "sign_in_with_imap": "Sign-in with IMAP",
    "host": "Host",
    "port": "Port",
    "unable_to_detect": "Unable to detect your IMAP configuration. Please add them manually.",
    "Button": {
      "connect": "Connect",
      "advanced": "Configure manually"
    }
  },
  "fr": {
    "other_email_provider": "Autre nouveau compte e-mail (IMAP)",
    "sign_in_with_imap": "Connexion avec IMAP",
    "host": "Hôte",
    "port": "Port",
    "unable_to_detect": "Impossible de détecter votre configuration IMAP. Veuillez les ajouter manuellement.",
    "Button": {
      "connect": "Se connecter",
      "advanced": "Configurer manuellement"
    }
  }
}
</i18n>
