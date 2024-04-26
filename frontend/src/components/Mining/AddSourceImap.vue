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
          :invalid="!!imapEmail && !isValidEmail(imapEmail)"
          class="w-full"
          @focusout="getImapConfigs(imapEmail)"
        />
      </div>
      <div class="w-full flex flex-col gap-1">
        <label for="password">Password</label>
        <InputText v-model="imapPassword" class="w-full" type="password" />
      </div>
      <div v-if="showAdvancedImapSettings" class="w-full flex flex-col gap-1">
        <label for="host">Host</label>
        <InputText v-model="imapHost" class="w-full" />
      </div>
      <div v-if="showAdvancedImapSettings" class="w-full flex flex-col gap-1">
        <label for="port">Port</label>
        <InputNumber
          v-model="imapPort"
          show-buttons
          class="w-full"
          :invalid="!(imapPort > 0 && imapPort <= 65536)"
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
          @click="showImapCredentialsDialog = false"
        ></Button>
        <Button
          type="button"
          label="Connect"
          :loading="loadingSave"
          :disabled="disableSave"
          @click="onSubmitImapCredentials"
        ></Button>
      </div>
    </div>
  </Dialog>
</template>
<script setup lang="ts">
import { FetchError } from 'ofetch';
import { useLeadminerStore } from '@/stores/leadminer';
import { isValidEmail } from '@/utils/email';

const { $api } = useNuxtApp();
const $toast = useToast();
const $user = useSupabaseUser();
const $leadminerStore = useLeadminerStore();

const imapEmail = ref('');
const imapPassword = ref('');
const imapHost = ref('');
const imapPort = ref(993);
const imapSecureConnection = ref(true);

const loadingSave = ref(false);
const showAdvancedImapSettings = ref(false);

const showImapCredentialsDialog = ref(false);

const disableSave = computed(() =>
  Boolean(
    !imapEmail.value.length ||
      !imapHost.value.length ||
      !imapPassword.value.length
  )
);

function showAdvancedSettings() {
  showAdvancedImapSettings.value = true;
  imapHost.value = '';
}

function closeImapCredentialsDialog() {
  showImapCredentialsDialog.value = false;
}

async function openImapCredentialsDialog() {
  showImapCredentialsDialog.value = true;
  if (!imapEmail.value.length && $user.value) {
    imapEmail.value = $user.value.email as string;
    await getImapConfigs(imapEmail.value);
  }
}

async function getImapConfigs(email: string) {
  if (!isValidEmail(email)) {
    return;
  }
  loadingSave.value = true;
  try {
    const {
      host,
      port,
      secure,
    }: {
      host: string;
      port: number;
      secure: boolean;
    } = await $api(`/imap/config/${email}`, {
      method: 'GET',
    });

    if (host && port && secure) {
      imapHost.value = host;
      imapPort.value = Number(port);
      imapSecureConnection.value = secure;
      showAdvancedImapSettings.value = false;
    } else {
      showAdvancedSettings();
    }

    loadingSave.value = false;
  } catch (e) {
    loadingSave.value = false;
    showAdvancedSettings();
    throw e;
  }
}

async function onSubmitImapCredentials() {
  loadingSave.value = true;

  try {
    await $api('/imap/mine/sources/imap', {
      method: 'POST',
      body: {
        email: imapEmail.value,
        host: imapHost.value,
        port: imapPort.value,
        password: imapPassword.value,
      },
    });

    await $leadminerStore.fetchMiningSources();
    closeImapCredentialsDialog();
    loadingSave.value = false;
  } catch (err) {
    loadingSave.value = false;

    if (err instanceof FetchError) {
      $toast.add({
        severity: 'error',
        summary: 'Sign-in with IMAP',
        detail: err.data.details.message,
      });
    } else {
      throw err;
    }
  }
}
</script>
