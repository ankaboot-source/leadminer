<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import Dialog from 'primevue/dialog';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import ProgressSpinner from 'primevue/progressspinner';
import Stepper from 'primevue/stepper';
import StepList from 'primevue/steplist';
import StepPanels from 'primevue/steppanels';
import StepItem from 'primevue/stepitem';
import StepPanel from 'primevue/steppanel';

const { t } = useI18n({ useScope: 'local' });
const { t: globalT } = useI18n({ useScope: 'global' });
const _toast = useToast();
const { $saasEdgeFunctions } = useNuxtApp();

const visible = defineModel<boolean>('visible', { default: false });

const emit = defineEmits<{
  sessionCreated: [sessionId: string];
}>();

const currentStep = ref(1);
const sessionName = ref('');
const sessionId = ref('');
const qrCodeData = ref('');
const sessionStatus = ref('');
const isCreating = ref(false);
const isPolling = ref(false);
const error = ref('');

let pollInterval: ReturnType<typeof setInterval> | null = null;

const canCreate = computed(() => sessionName.value.trim().length > 0);
const _isConnected = computed(() => sessionStatus.value === 'CONNECTED');

watch(visible, (val) => {
  if (!val) {
    resetWizard();
  }
});

async function createSession() {
  if (!canCreate.value) return;
  isCreating.value = true;
  error.value = '';

  try {
    const response = (await $saasEdgeFunctions('sms-fleet/openwa/sessions', {
      method: 'POST',
      body: { name: sessionName.value.trim() },
    })) as { sessionId: string };

    sessionId.value = response.sessionId;
    currentStep.value = 2;
    await fetchQrCode();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : t('error_create_session');
  } finally {
    isCreating.value = false;
  }
}

async function fetchQrCode() {
  if (!sessionId.value) return;
  error.value = '';

  try {
    const response = (await $saasEdgeFunctions(
      `sms-fleet/openwa/sessions/${sessionId.value}/qr`,
      { method: 'GET' },
    )) as { qr: string };

    qrCodeData.value = response.qr;
    startPolling();
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('error_fetch_qr');
  }
}

function startPolling() {
  stopPolling();
  isPolling.value = true;
  pollInterval = setInterval(async () => {
    try {
      const response = (await $saasEdgeFunctions(
        `sms-fleet/openwa/sessions/${sessionId.value}/status`,
        { method: 'GET' },
      )) as { status: string };

      sessionStatus.value = response.status;

      if (response.status === 'CONNECTED') {
        stopPolling();
        isPolling.value = false;
        currentStep.value = 3;
        emit('sessionCreated', sessionId.value);
      } else if (
        response.status === 'FAILED' ||
        response.status === 'DISCONNECTED'
      ) {
        stopPolling();
        isPolling.value = false;
        error.value = t('error_session_failed');
      }
    } catch {
      // Silently retry on network errors
    }
  }, 3000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function resetWizard() {
  stopPolling();
  currentStep.value = 1;
  sessionName.value = '';
  sessionId.value = '';
  qrCodeData.value = '';
  sessionStatus.value = '';
  isCreating.value = false;
  isPolling.value = false;
  error.value = '';
}

function retryQr() {
  error.value = '';
  fetchQrCode();
}

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('whatsapp_session_setup')"
    :style="{ width: '36rem', maxWidth: '95vw' }"
    :closable="true"
    @hide="resetWizard"
  >
    <Stepper :value="currentStep" class="w-full">
      <StepList>
        <StepItem :value="1">{{ t('step_name') }}</StepItem>
        <StepItem :value="2">{{ t('step_scan_qr') }}</StepItem>
        <StepItem :value="3">{{ t('step_connected') }}</StepItem>
      </StepList>

      <StepPanels>
        <StepPanel :value="1">
          <div class="flex flex-col gap-4 py-4">
            <p class="text-surface-600">{{ t('step_name_description') }}</p>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">{{ t('session_name') }}</label>
              <InputText
                v-model="sessionName"
                :placeholder="t('session_name_placeholder')"
                @keyup.enter="createSession"
              />
            </div>
            <div v-if="error" class="text-red-500 text-sm">{{ error }}</div>
            <div class="flex justify-end gap-2 pt-2">
              <Button
                outlined
                :label="globalT('common.cancel')"
                @click="visible = false"
              />
              <Button
                :label="t('create_session')"
                :loading="isCreating"
                :disabled="!canCreate"
                @click="createSession"
              />
            </div>
          </div>
        </StepPanel>

        <StepPanel :value="2">
          <div class="flex flex-col items-center gap-4 py-4">
            <p class="text-surface-600 text-center">
              {{ t('step_scan_qr_description') }}
            </p>

            <div
              v-if="qrCodeData"
              class="flex justify-center items-center p-4 bg-white rounded-lg border border-surface-200"
            >
              <img
                :src="qrCodeData"
                :alt="t('qr_code_alt')"
                class="w-64 h-64"
              />
            </div>

            <div
              v-if="isPolling"
              class="flex items-center gap-2 text-surface-500"
            >
              <ProgressSpinner style="width: 20px; height: 20px" />
              <span class="text-sm">{{ t('waiting_for_scan') }}</span>
            </div>

            <div v-if="error" class="text-red-500 text-sm text-center">
              {{ error }}
            </div>

            <div class="flex justify-end gap-2 pt-2 w-full">
              <Button
                outlined
                :label="globalT('common.cancel')"
                @click="visible = false"
              />
              <Button
                v-if="error"
                :label="t('retry')"
                icon="pi pi-refresh"
                @click="retryQr"
              />
            </div>
          </div>
        </StepPanel>

        <StepPanel :value="3">
          <div class="flex flex-col items-center gap-4 py-4">
            <i class="pi pi-check-circle text-6xl text-green-500" />
            <h3 class="text-lg font-semibold">{{ t('connected_title') }}</h3>
            <p class="text-surface-600 text-center">
              {{ t('connected_description') }}
            </p>
            <div class="flex justify-end gap-2 pt-2 w-full">
              <Button
                :label="t('done')"
                icon="pi pi-check"
                @click="visible = false"
              />
            </div>
          </div>
        </StepPanel>
      </StepPanels>
    </Stepper>
  </Dialog>
</template>

<i18n lang="json">
{
  "en": {
    "whatsapp_session_setup": "WhatsApp Session Setup",
    "step_name": "Name",
    "step_scan_qr": "Scan QR",
    "step_connected": "Connected",
    "step_name_description": "Give your WhatsApp session a name to identify it later. This will be linked to your WhatsApp Business account.",
    "session_name": "Session Name",
    "session_name_placeholder": "e.g., Marketing Phone",
    "create_session": "Create Session",
    "step_scan_qr_description": "Open WhatsApp on your phone, go to Linked Devices, and scan this QR code.",
    "qr_code_alt": "WhatsApp QR Code",
    "waiting_for_scan": "Waiting for QR scan...",
    "retry": "Retry",
    "connected_title": "WhatsApp Connected!",
    "connected_description": "Your WhatsApp session is now active. You can use this session to send WhatsApp campaigns.",
    "done": "Done",
    "error_create_session": "Failed to create WhatsApp session. Please try again.",
    "error_fetch_qr": "Failed to load QR code. Please try again.",
    "error_session_failed": "Session connection failed. Please try again."
  },
  "fr": {
    "whatsapp_session_setup": "Configuration de session WhatsApp",
    "step_name": "Nom",
    "step_scan_qr": "Scanner QR",
    "step_connected": "Connecté",
    "step_name_description": "Donnez un nom à votre session WhatsApp pour l'identifier plus tard. Elle sera liée à votre compte WhatsApp Business.",
    "session_name": "Nom de la session",
    "session_name_placeholder": "ex: Téléphone marketing",
    "create_session": "Créer la session",
    "step_scan_qr_description": "Ouvrez WhatsApp sur votre téléphone, allez dans Appareils connectés, et scannez ce code QR.",
    "qr_code_alt": "Code QR WhatsApp",
    "waiting_for_scan": "En attente du scan QR...",
    "retry": "Réessayer",
    "connected_title": "WhatsApp connecté !",
    "connected_description": "Votre session WhatsApp est maintenant active. Vous pouvez utiliser cette session pour envoyer des campagnes WhatsApp.",
    "done": "Terminé",
    "error_create_session": "Échec de la création de la session WhatsApp. Veuillez réessayer.",
    "error_fetch_qr": "Échec du chargement du code QR. Veuillez réessayer.",
    "error_session_failed": "La connexion de la session a échoué. Veuillez réessayer."
  }
}
</i18n>
