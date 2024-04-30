<template>
  <Button
    outlined
    label="Other email provider (IMAP)"
    icon="pi pi-inbox"
    @click="openImapCredentialsDialog"
  />
  <Dialog
    v-model:visible="showImapCredentialsDialog"
    modal
    header="Sign-in with IMAP"
    class="md:w-[30rem]"
  >
    <div class="flex flex-col space-y-2">
      <div class="w-full flex flex-col gap-1">
        <label for="email">Email</label>
        <InputText
          v-model="imapEmail"
          :disabled="loadingSave"
          :invalid="isInvalidEmailInput(imapEmail)"
          class="w-full"
        />
      </div>
      <div class="w-full flex flex-col gap-1">
        <label for="password">Password</label>
        <InputText
          v-model="imapPassword"
          class="w-full"
          type="password"
          :invalid="invalidPassword"
        />
      </div>
      <div v-if="showAdvancedImapSettings" class="w-full flex flex-col gap-1">
        <label for="host">Host</label>
        <InputText v-model="imapHost" class="w-full" :invalid="invalidHost" />
      </div>
      <div v-if="showAdvancedImapSettings" class="w-full flex flex-col gap-1">
        <label for="port">Port</label>
        <InputNumber
          v-model="imapPort"
          show-buttons
          class="w-full"
          :invalid="isInvalidImapPort(imapPort)"
        />
      </div>
      <div
        v-if="showAdvancedImapSettings"
        class="w-full flex flex-row items-center gap-1"
      >
        <Checkbox v-model="imapSecureConnection" :binary="true" />
        <label for="port">TLS/SSL</label>
      </div>
      <div class="flex justify-end w-full gap-2 pt-4">
        <Button
          type="button"
          label="Cancel"
          severity="secondary"
          @click="closeImapCredentialsDialog"
        ></Button>
        <Button
          type="button"
          label="Connect"
          :loading="loadingSave"
          @click="onSubmitImapCredentials"
        ></Button>
      </div>
    </div>
  </Dialog>
</template>
<script setup lang="ts">
import { FetchError } from 'ofetch';
import { isInvalidEmailPattern } from '@/utils/email';
import type { MiningSource } from '~/types/mining';

const { $api } = useNuxtApp();
const $toast = useToast();
const $user = useSupabaseUser();

const imapSource = defineModel<MiningSource>('source');

const imapEmail = ref<string | undefined>($user.value?.email);
const imapPassword = ref<string | undefined>();
const imapHost = ref<string | undefined>();
const imapPort = ref(993);
const imapSecureConnection = ref(true);

const invalidEmail = ref(false);
const invalidPassword = ref(false);
const invalidHost = ref(false);
const invalidPort = ref(false);

const loadingSave = ref(false);

const showAdvancedImapSettings = ref(false);
const showImapCredentialsDialog = ref(false);

function isInvalidEmailInput(email: string | undefined) {
  return !email?.length || invalidEmail.value || isInvalidEmailPattern(email);
}

function isInvalidImapPort(port: number) {
  return invalidPort.value || !(port > 0 && port <= 65536);
}

function showAdvancedSettings() {
  imapHost.value = '';
  imapPort.value = 993;
  showAdvancedImapSettings.value = true;
}

function resetFormErrors() {
  invalidEmail.value = false;
  invalidPassword.value = false;
  invalidHost.value = false;
  invalidPort.value = false;
}

function closeImapCredentialsDialog() {
  resetFormErrors();
  showAdvancedImapSettings.value = false;
  showImapCredentialsDialog.value = false;
}

async function openImapCredentialsDialog() {
  showImapCredentialsDialog.value = true;
}

function showFormErrors(fields: string[]) {
  fields.forEach((field) => {
    if (field === 'email') {
      invalidEmail.value = true;
    }

    if (field === 'password') {
      invalidPassword.value = true;
    }

    if (field === 'host') {
      invalidHost.value = true;
    }

    if (field === 'port') {
      invalidPort.value = true;
    }
  });
}

async function getImapConfigsForEmail(email: string) {
  let configs =
    imapHost.value && imapPort.value
      ? {
          host: imapHost.value,
          port: imapPort.value,
          secure: imapSecureConnection.value,
        }
      : null;

  configs = configs ?? (await $api(`/imap/config/${email}`, { method: 'GET' }));
  return configs;
}

function handleImapAuthenticationErrors(err: FetchError): void {
  showFormErrors(err.data?.fields ?? []);
  $toast.add({
    severity: 'error',
    summary: 'Sign-in with IMAP',
    detail: err.data.message,
    life: 5000,
  });
}

async function onSubmitImapCredentials() {
  try {
    if (!imapEmail.value) {
      invalidEmail.value = true;
      return;
    }

    resetFormErrors();
    loadingSave.value = true;

    const configs = await getImapConfigsForEmail(imapEmail.value);

    if (!configs) {
      loadingSave.value = false;
      $toast.add({
        severity: 'warn',
        summary: 'Sign-in with IMAP',
        detail:
          'Unable to detect your IMAP configuration. Please add them manually.',
        life: 5000,
      });
      showAdvancedSettings();
      return;
    }

    await $api('/imap/mine/sources/imap', {
      method: 'POST',
      body: {
        email: imapEmail.value,
        password: imapPassword.value,
        ...configs,
      },
    });

    // Update UI on success
    loadingSave.value = false;
    closeImapCredentialsDialog();
    imapSource.value = {
      type: 'imap',
      email: imapEmail.value,
      isValid: true,
    };
  } catch (err) {
    loadingSave.value = false;
    if (err instanceof FetchError) {
      handleImapAuthenticationErrors(err);
    } else {
      throw err;
    }
  }
}
</script>
