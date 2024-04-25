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
          :invalid="!!imapEmail && !isValidEmail(imapEmail)"
          class="w-full"
        />
      </div>
      <div class="w-full flex flex-col gap-1">
        <label for="password">Password</label>
        <InputText v-model="imapPassword" class="w-full" type="password" />
      </div>
      <div class="w-full flex flex-col gap-1">
        <label for="host">Host</label>
        <InputText v-model="imapHost" class="w-full" />
      </div>
      <div class="w-full flex flex-col gap-1">
        <label for="port">Port</label>
        <InputNumber
          v-model="imapPort"
          show-buttons
          class="w-full"
          :invalid="!(imapPort > 0 && imapPort <= 65536)"
        />
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
          label="Save"
          @click="onSubmitImapCredentials"
        ></Button>
      </div>
    </div>
  </Dialog>
</template>
<script setup lang="ts">
import { useLeadminerStore } from '@/stores/leadminer';
import { isValidEmail } from '@/utils/email';

const { $api } = useNuxtApp();
const leadminerStore = useLeadminerStore();

const imapHost = ref('');
const imapEmail = ref('');
const imapPort = ref(993);
const imapPassword = ref('');

const isLoadingImapCredentialsCheck = ref(false);
const showImapCredentialsDialog = ref(false);

function openImapCredentialsDialog() {
  showImapCredentialsDialog.value = true;
}

function closeImapCredentialsDialog() {
  showImapCredentialsDialog.value = false;
}

async function onSubmitImapCredentials() {
  isLoadingImapCredentialsCheck.value = true;

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

    await leadminerStore.fetchMiningSources();
    closeImapCredentialsDialog();
    isLoadingImapCredentialsCheck.value = false;
  } catch (err) {
    isLoadingImapCredentialsCheck.value = false;
    throw err;
  }
}
</script>
