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
              (email) =>
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
              (password) =>
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
            :rules="[(host) => host !== '' || 'Please insert your IMAP host']"
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
              (port) =>
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
import { api } from "src/boot/axios";
import { ref } from "vue";
import { isValidEmail } from "src/helpers/email";
import { mdiEmailLock } from "@quasar/extras/mdi-v6";
import { useLeadminerStore } from "src/stores/leadminer";
import { AxiosError } from "axios";
import { useQuasar } from "quasar";

const $quasar = useQuasar();
const leadminerStore = useLeadminerStore();

const imapHost = ref("");
const imapEmail = ref("");
const imapPort = ref(993);
const imapPassword = ref("");

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
    await api.post("/imap/mine/sources/imap", {
      email: imapEmail.value,
      host: imapHost.value,
      port: imapPort.value,
      password: imapPassword.value,
    });

    await leadminerStore.getMiningSources();
    closeImapCredentialsDialog();
  } catch (error) {
    if (error instanceof AxiosError) {
      let message =
        error.response?.data?.details?.message ??
        error.response?.data?.message ??
        error.message;

      if (error.message?.toLowerCase() === "network error") {
        message =
          "Unable to access server. Please retry again or contact your service provider.";
      }

      $quasar.notify({
        message,
        color: "negative",
        icon: "error",
      });
    }
  } finally {
    isLoadingImapCredentialsCheck.value = false;
  }
}
</script>
