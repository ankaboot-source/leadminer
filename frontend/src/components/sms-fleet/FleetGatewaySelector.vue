<template>
  <div class="flex flex-col gap-3">
    <Dialog
      v-model:visible="showAddDialog"
      modal
      :header="t('add_gateway')"
      :style="{ width: '38rem', maxWidth: '95vw' }"
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t('gateway_name') }}</label>
          <InputText
            v-model="gatewayName"
            :placeholder="t('gateway_name_placeholder')"
            class="w-full"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t('provider') }}</label>
          <div class="flex items-center gap-2">
            <Dropdown
              v-model="selectedProvider"
              :options="providerOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('select_provider')"
              class="flex-1"
            />
            <Button
              v-if="selectedProvider"
              text
              size="small"
              icon="pi pi-question-circle"
              :label="t('how_to_install_phone')"
              class="underline"
              @click="openSetupDialog"
            />
          </div>
        </div>

        <ProviderForm
          v-if="selectedProvider"
          ref="providerFormRef"
          :provider="selectedProvider"
          @submit="handleFormSubmit"
        />

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t('daily_limit') }}</label>
            <InputNumber v-model="dailyLimit" :min="0" class="w-full" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t('monthly_limit') }}</label>
            <InputNumber v-model="monthlyLimit" :min="0" class="w-full" />
          </div>
        </div>

        <Button
          :label="t('save_gateway')"
          icon="pi pi-check"
          :loading="isSubmitting"
          :disabled="!gatewayName || !selectedProvider || !formConfig"
          @click="saveGateway"
        />
      </div>
    </Dialog>

    <Dialog
      v-model:visible="showSetupDialog"
      modal
      :header="t('sms_provider_setup')"
      :style="{ width: '38rem', maxWidth: '95vw' }"
    >
      <div class="flex flex-col gap-3 text-sm">
        <div v-if="!setupSelectedProvider" class="flex flex-col gap-2">
          <p class="m-0">{{ t('select_provider_to_see_instructions') }}</p>
          <div class="flex gap-2">
            <Button
              :label="t('smsgate')"
              outlined
              @click="setupSelectedProvider = 'smsgate'"
            />
            <Button
              :label="t('simple_sms_gateway')"
              outlined
              @click="setupSelectedProvider = 'simple-sms-gateway'"
            />
          </div>
        </div>
        <div v-else class="flex flex-col gap-2">
          <Button
            text
            size="small"
            icon="pi pi-arrow-left"
            :label="t('back')"
            class="self-start mb-2"
            @click="setupSelectedProvider = null"
          />
          <template v-if="setupSelectedProvider === 'smsgate'">
            <p class="m-0">{{ t('smsgate_setup_intro') }}</p>
            <div
              class="rounded-xl border border-surface-200 bg-gradient-to-b from-surface-50 to-white p-3"
            >
              <div class="font-semibold">{{ t('scan_to_install') }}</div>
              <div
                class="mt-2 rounded-lg border border-surface-200 bg-white p-2"
              >
                <img
                  src="/images/qr-smsgate-apk.png"
                  :alt="t('scan_to_install')"
                  class="mx-auto w-full max-w-[180px]"
                />
              </div>
            </div>
            <ol class="pl-4 m-0 list-decimal">
              <li class="mb-2">{{ t('smsgate_setup_step_1') }}</li>
              <li class="mb-2">{{ t('smsgate_setup_step_2') }}</li>
              <li>{{ t('smsgate_setup_step_3') }}</li>
            </ol>
            <a
              :href="smsgateDownloadUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="underline"
            >
              {{ t('download_smsgate_apk') }}
            </a>
          </template>
          <template v-else-if="setupSelectedProvider === 'simple-sms-gateway'">
            <p class="m-0">{{ t('simple_sms_gateway_setup_intro') }}</p>
            <div
              class="rounded-xl border border-surface-200 bg-gradient-to-b from-surface-50 to-white p-3"
            >
              <div class="font-semibold">{{ t('scan_to_install') }}</div>
              <div
                class="mt-2 rounded-lg border border-surface-200 bg-white p-2"
              >
                <img
                  src="/images/qr-playstore.png"
                  :alt="t('scan_to_install')"
                  class="mx-auto w-full max-w-[180px]"
                />
              </div>
            </div>
            <ol class="pl-4 m-0 list-decimal">
              <li class="mb-2">{{ t('simple_sms_gateway_setup_step_1') }}</li>
              <li class="mb-2">{{ t('simple_sms_gateway_setup_step_2') }}</li>
              <li>{{ t('simple_sms_gateway_setup_step_3') }}</li>
            </ol>
            <a
              :href="simpleSmsGatewayDownloadUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="underline"
            >
              {{ t('open_playstore') }}
            </a>
          </template>
        </div>
      </div>
    </Dialog>

    <div v-if="$smsFleetStore.isLoading" class="flex justify-center py-4">
      <ProgressSpinner style="width: 2rem; height: 2rem" />
    </div>

    <div
      v-else-if="availableGateways.length === 0"
      class="text-center py-4 border border-dashed border-surface-300 rounded-md"
    >
      <i class="pi pi-mobile text-2xl text-surface-400 mb-2" />
      <p class="text-sm text-surface-500">{{ t('no_gateways') }}</p>
      <div class="flex justify-center gap-2 mt-2">
        <Button
          text
          size="small"
          icon="pi pi-plus"
          :label="t('add_gateway')"
          @click="showAddDialog = true"
        />
        <Button
          text
          size="small"
          icon="pi pi-question-circle"
          :label="t('how_to_install')"
          @click="showSetupDialog = true"
        />
      </div>
    </div>

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="gateway in availableGateways"
        :key="gateway.id"
        class="flex items-center gap-3 p-3 border rounded-md hover:bg-surface-50 transition-colors"
        :class="{
          'border-primary-500 bg-primary-50': isSelected(gateway.id),
          'border-surface-200': !isSelected(gateway.id),
          'opacity-50': !gateway.is_active,
        }"
        @click="toggleGateway(gateway.id)"
      >
        <Checkbox
          :model-value="isSelected(gateway.id)"
          :binary="true"
          @click.stop
          @update:model-value="toggleGateway(gateway.id)"
        />

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <i
              :class="getProviderIcon(gateway.provider)"
              class="text-surface-500"
            />
            <span class="font-medium truncate">{{ gateway.name }}</span>
          </div>
          <div class="text-xs text-surface-500 mt-1">
            <span class="capitalize">{{
              formatProvider(gateway.provider)
            }}</span>
            <span v-if="gateway.daily_limit > 0" class="ml-2">
              • {{ gateway.sent_today }}/{{ gateway.daily_limit }}
              {{ t('today') }}
            </span>
            <span v-else class="ml-2">
              • {{ gateway.sent_today }} {{ t('sent_today') }}
            </span>
          </div>
        </div>

        <Tag
          v-if="!gateway.is_active"
          :value="t('inactive')"
          severity="secondary"
          class="text-xs"
        />

        <Badge
          v-else-if="
            gateway.daily_limit > 0 && gateway.sent_today >= gateway.daily_limit
          "
          :value="t('limit_reached')"
          severity="danger"
          class="text-xs"
        />
      </div>

      <Button
        text
        size="small"
        icon="pi pi-plus"
        :label="t('add_gateway')"
        class="self-start"
        @click="showAddDialog = true"
      />
    </div>

    <small
      v-if="selectedGatewayIds.length === 0 && showValidation"
      class="text-red-500"
    >
      {{ t('select_at_least_one_gateway') }}
    </small>

    <div v-if="selectedGatewayIds.length > 0" class="text-xs text-surface-500">
      {{ t('selected_count', { count: selectedGatewayIds.length }) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import { useSmsFleetStore } from '~/stores/sms-fleet';
import ProviderForm from './ProviderForm.vue';
import type { SmsGatewayProvider } from '@/types/sms-fleet';

const { t } = useI18n({ useScope: 'local' });
const $smsFleetStore = useSmsFleetStore();

const showAddDialog = ref(false);
const showSetupDialog = ref(false);
const setupSelectedProvider = ref<'smsgate' | 'simple-sms-gateway' | null>(
  null,
);
const isSubmitting = ref(false);

const gatewayName = ref('');
const selectedProvider = ref<'smsgate' | 'simple-sms-gateway' | null>(
  'simple-sms-gateway',
);
const dailyLimit = ref(200);
const monthlyLimit = ref(200);
const providerFormRef = ref<InstanceType<typeof ProviderForm> | null>(null);
const formConfig = ref<{
  provider: string;
  config: Record<string, unknown>;
} | null>(null);

interface Props {
  modelValue: string[];
  showValidation?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showValidation: false,
});

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
  'add-gateway': [];
}>();

const selectedGatewayIds = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const availableGateways = computed(() => $smsFleetStore.gateways);

const isSelected = (gatewayId: string) => {
  return selectedGatewayIds.value.includes(gatewayId);
};

const toggleGateway = (gatewayId: string) => {
  const current = selectedGatewayIds.value;
  if (current.includes(gatewayId)) {
    selectedGatewayIds.value = current.filter((id) => id !== gatewayId);
  } else {
    selectedGatewayIds.value = [...current, gatewayId];
  }
};

const providerOptions = [
  { label: 'SMSGate', value: 'smsgate' },
  { label: 'Simple SMS Gateway', value: 'simple-sms-gateway' },
];

function handleFormSubmit(config: {
  provider: string;
  config: Record<string, unknown>;
}) {
  formConfig.value = config;
}

async function saveGateway() {
  if (!gatewayName.value || !selectedProvider.value || !formConfig.value) {
    return;
  }

  isSubmitting.value = true;

  const result = await $smsFleetStore.createGateway({
    name: gatewayName.value,
    provider: selectedProvider.value as SmsGatewayProvider,
    config: formConfig.value.config,
    daily_limit: dailyLimit.value,
    monthly_limit: monthlyLimit.value,
  });

  isSubmitting.value = false;

  if (result) {
    showAddDialog.value = false;
    selectedGatewayIds.value = [...selectedGatewayIds.value, result.id];
    resetForm();
  }
}

function resetForm() {
  gatewayName.value = '';
  selectedProvider.value = null;
  dailyLimit.value = 200;
  monthlyLimit.value = 200;
  formConfig.value = null;
  providerFormRef.value?.resetForm();
}

function openSetupDialog() {
  if (selectedProvider.value) {
    setupSelectedProvider.value = selectedProvider.value;
    showSetupDialog.value = true;
  }
}

const smsgateDownloadUrl = 'https://sms-gate.app/';
const simpleSmsGatewayDownloadUrl =
  'https://play.google.com/store/apps/details?id=com.pabrikaplikasi.simplesmsgateway';

const getProviderIcon = (provider: SmsGatewayProvider) => {
  const icons: Record<SmsGatewayProvider, string> = {
    smsgate: 'pi pi-android',
    'simple-sms-gateway': 'pi pi-mobile',
    twilio: 'pi pi-phone',
  };
  return icons[provider] || 'pi pi-mobile';
};

const formatProvider = (provider: SmsGatewayProvider) => {
  const names: Record<SmsGatewayProvider, string> = {
    smsgate: 'SMSGate',
    'simple-sms-gateway': 'Simple SMS Gateway',
    twilio: 'Twilio',
  };
  return names[provider] || provider;
};
</script>

<i18n lang="json">
{
  "en": {
    "sms_gateways": "SMS Gateways",
    "add_gateway": "Add a gateway",
    "no_gateways": "No SMS gateways configured",
    "today": "today",
    "sent_today": "sent today",
    "inactive": "Inactive",
    "limit_reached": "Limit reached",
    "select_at_least_one_gateway": "Please select at least one gateway",
    "selected_count": "{count} gateway(s) selected",
    "gateway_name": "Gateway Name",
    "gateway_name_placeholder": "Enter gateway name",
    "select_provider": "Select a provider",
    "provider": "Provider",
    "daily_limit": "Daily Limit",
    "monthly_limit": "Monthly Limit",
    "save_gateway": "Save Gateway",
    "setup_help": "How to install",
    "sms_provider_setup": "SMS Provider Setup",
    "smsgate_setup_intro": "To use SMSGate as your SMS gateway, you need to install the Android app on a phone and configure it with your credentials.",
    "scan_to_install": "Scan to install the app",
    "smsgate_setup_step_1": "Install SMS Gate on your Android device",
    "smsgate_setup_step_2": "Copy your API URL, username and password from the app",
    "smsgate_setup_step_3": "Paste the credentials in the form above",
    "download_smsgate_apk": "Download SMS Gate APK",
    "simple_sms_gateway_setup_intro": "To use Simple SMS Gateway as your SMS gateway, you need to install the Android app on a phone and configure it with your server URL.",
    "simple_sms_gateway_setup_step_1": "Install Simple SMS Gateway on your Android device",
    "simple_sms_gateway_setup_step_2": "Configure the server URL in the app settings",
    "simple_sms_gateway_setup_step_3": "Enter the server URL in the form above",
    "open_playstore": "Open in Play Store",
    "how_to_install": "How to install",
    "select_provider_to_see_instructions": "Select a provider to see installation instructions",
    "smsgate": "SMSGate",
    "simple_sms_gateway": "Simple SMS Gateway",
    "back": "Back",
    "how_to_install_phone": "How to install on the phone?"
  },
  "fr": {
    "sms_gateways": "Passerelles SMS",
    "add_gateway": "Ajouter une passerelle",
    "no_gateways": "Aucune passerelle SMS configurée",
    "today": "aujourd'hui",
    "sent_today": "envoyés aujourd'hui",
    "inactive": "Inactif",
    "limit_reached": "Limite atteinte",
    "select_at_least_one_gateway": "Veuillez sélectionner au moins une passerelle",
    "selected_count": "{count} passerelle(s) sélectionnée(s)",
    "gateway_name": "Nom de la passerelle",
    "gateway_name_placeholder": "Entrez le nom de la passerelle",
    "select_provider": "Sélectionnez un fournisseur",
    "provider": "Fournisseur",
    "daily_limit": "Limite quotidienne",
    "monthly_limit": "Limite mensuelle",
    "save_gateway": "Enregistrer la passerelle",
    "setup_help": "Comment installer",
    "sms_provider_setup": "Configuration du fournisseur SMS",
    "smsgate_setup_intro": "Pour utiliser SMSGate comme passerelle SMS, vous devez installer l'application Android sur un téléphone et la configurer avec vos identifiants.",
    "scan_to_install": "Scannez pour installer l'application",
    "smsgate_setup_step_1": "Installez SMS Gate sur votre appareil Android",
    "smsgate_setup_step_2": "Copiez votre URL API, nom d'utilisateur et mot de passe depuis l'application",
    "smsgate_setup_step_3": "Collez les identifiants dans le formulaire ci-dessus",
    "download_smsgate_apk": "Télécharger l'APK SMS Gate",
    "simple_sms_gateway_setup_intro": "Pour utiliser Simple SMS Gateway comme passerelle SMS, vous devez installer l'application Android sur un téléphone et la configurer avec l'URL de votre serveur.",
    "simple_sms_gateway_setup_step_1": "Installez Simple SMS Gateway sur votre appareil Android",
    "simple_sms_gateway_setup_step_2": "Configurez l'URL du serveur dans les paramètres de l'application",
    "simple_sms_gateway_setup_step_3": "Entrez l'URL du serveur dans le formulaire ci-dessus",
    "open_playstore": "Ouvrir sur Play Store",
    "how_to_install": "Comment installer",
    "select_provider_to_see_instructions": "Sélectionnez un fournisseur pour voir les instructions d'installation",
    "smsgate": "SMSGate",
    "simple_sms_gateway": "Simple SMS Gateway",
    "back": "Retour",
    "how_to_install_phone": "Comment installer sur le téléphone ?"
  }
}
</i18n>
