<template>
  <q-btn
    :icon="mdiEmailLock"
    label="Other email provider (IMAP)"
    unelevated
    outline
    no-caps
    @click="openImapCredentialsDialog"
  />
  <q-dialog v-model="showImapCredentialsDialog">
    <q-card class="column" style="width: 30vw; max-height: 80vh">
      <q-toolbar class="borders">
        <q-toolbar-title class="merriweather">
          Sign-in with IMAP
        </q-toolbar-title>
        <q-btn v-close-popup flat round dense icon="close" size="sm" />
      </q-toolbar>
      <q-form @submit="onSubmitImapCredentials">
        <q-card-section>
          <q-input
            v-model="imapEmail"
            dense
            outlined
            class="q-mb-sm"
            bg-color="white"
            label="Email"
            lazy-rules
            :rules="[
              (email: string) =>
                isValidEmail(email) || 'Please insert a valid email address',
            ]"
          />
          <q-input
            v-model="imapPassword"
            type="password"
            dense
            outlined
            class="q-mb-sm"
            bg-color="white"
            label="Password"
            lazy-rules
            :rules="[
              (password: string) =>
                password !== '' || 'Please insert your IMAP password',
            ]"
          />
          <q-input
            v-model="imapHost"
            dense
            outlined
            class="q-mb-sm"
            bg-color="white"
            label="Host"
            lazy-rules
            :rules="[(host: string) => host !== '' || 'Please insert your IMAP host']"
          />
          <q-input
            v-model="imapPort"
            dense
            outlined
            bg-color="white"
            type="number"
            label="Port"
            lazy-rules
            :rules="[
              (port: number) =>
                (port > 0 && port <= 65536) ||
                'Please insert a valid IMAP port number',
            ]"
          />
        </q-card-section>
        <q-card-actions class="borders">
          <q-btn
            v-close-popup
            no-caps
            outline
            color="secondary"
            label="Cancel"
          />
          <q-space />
          <q-btn
            :loading="isLoadingImapCredentialsCheck"
            unelevated
            no-caps
            label="Connect"
            type="Connect"
            color="primary"
          />
        </q-card-actions>
      </q-form>
    </q-card>
  </q-dialog>
</template>
<script setup lang="ts">
import { mdiEmailLock } from '@quasar/extras/mdi-v6';
import { isValidEmail } from '@/utils/email';
import { useLeadminerStore } from '@/stores/leadminer';

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

    await leadminerStore.getMiningSources();
    closeImapCredentialsDialog();
    isLoadingImapCredentialsCheck.value = false;
  } catch (err) {
    isLoadingImapCredentialsCheck.value = false;
    throw err;
  }
}
</script>
