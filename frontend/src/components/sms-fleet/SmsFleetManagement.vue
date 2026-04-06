<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import ProviderForm from './ProviderForm.vue';
import Dropdown from 'primevue/dropdown';
import Chip from 'primevue/chip';
import type { SmsGatewayProvider } from '@/types/sms-fleet';

type SupportedProvider = 'smsgate' | 'simple-sms-gateway';

const { t } = useI18n({ useScope: 'local' });
const $toast = useToast();
const $smsFleetStore = useSmsFleetStore();

const selectedProvider = ref<SupportedProvider | null>(null);
const isFormValid = ref(false);

const providerOptions = computed(() => [
  { label: t('smsgate'), value: 'smsgate' as const },
  { label: t('simple_sms_gateway'), value: 'simple-sms-gateway' as const },
]);

function handleFormValid(valid: boolean) {
  isFormValid.value = valid;
}

async function handleGatewaySubmit(gateway: {
  provider: string;
  baseUrl: string;
  apiKey: string;
}) {
  const gatewayData = {
    name: gateway.provider === 'smsgate' ? 'SMSGate Gateway' : 'SMS Gateway',
    provider: gateway.provider as SmsGatewayProvider,
    config:
      gateway.provider === 'smsgate'
        ? { baseUrl: gateway.baseUrl, username: '', password: '' }
        : { simpleSmsGatewayBaseUrl: gateway.baseUrl },
    daily_limit: 0,
    monthly_limit: 0,
  };

  const result = await $smsFleetStore.createGateway(gatewayData);

  if (result) {
    $toast.add({
      severity: 'success',
      summary: t('gateway_created'),
      life: 3000,
    });
    selectedProvider.value = null;
  } else {
    $toast.add({
      severity: 'error',
      summary: t('gateway_creation_failed'),
      detail: $smsFleetStore.error || '',
      life: 5000,
    });
  }
}

function handleRemoveGateway(gatewayId: string) {
  $smsFleetStore.deleteGateway(gatewayId);
  $toast.add({
    severity: 'success',
    summary: t('gateway_removed'),
    life: 3000,
  });
}

function getProviderLabel(provider: SmsGatewayProvider): string {
  const labels: Record<SmsGatewayProvider, string> = {
    smsgate: 'SMSGate',
    'simple-sms-gateway': 'Simple SMS Gateway',
    twilio: 'Twilio',
  };
  return labels[provider] || provider;
}

onMounted(() => {
  $smsFleetStore.fetchGateways();
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <h3 class="text-lg font-semibold">{{ t('sms_fleet_management') }}</h3>

    <div v-if="$smsFleetStore.isLoading" class="flex justify-center py-8">
      <ProgressSpinner />
    </div>

    <div
      v-else-if="$smsFleetStore.gateways.length === 0"
      class="text-center py-8 text-surface-500"
    >
      <p>{{ t('no_gateways_configured') }}</p>
    </div>

    <div v-else class="flex flex-wrap gap-2">
      <Chip
        v-for="gateway in $smsFleetStore.gateways"
        :key="gateway.id"
        :label="`${getProviderLabel(gateway.provider)}: ${gateway.name}`"
        removable
        class="gateway-chip"
        @remove="handleRemoveGateway(gateway.id)"
      />
    </div>

    <Dropdown
      v-model="selectedProvider"
      :options="providerOptions"
      option-label="label"
      option-value="value"
      :placeholder="t('select_provider')"
      class="w-full"
    />

    <ProviderForm
      v-if="selectedProvider"
      :provider="selectedProvider"
      @valid="handleFormValid"
      @submit="handleGatewaySubmit"
    />
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "sms_fleet_management": "SMS Fleet Management",
    "no_gateways_configured": "No SMS gateways configured",
    "select_provider": "Select Provider",
    "smsgate": "SMSGate",
    "simple_sms_gateway": "Simple SMS Gateway",
    "gateway_created": "Gateway created successfully",
    "gateway_creation_failed": "Failed to create gateway",
    "gateway_removed": "Gateway removed"
  },
  "fr": {
    "sms_fleet_management": "Gestion de la flotte SMS",
    "no_gateways_configured": "Aucune passerelle SMS configurée",
    "select_provider": "Sélectionner un fournisseur",
    "smsgate": "SMSGate",
    "simple_sms_gateway": "Simple SMS Gateway",
    "gateway_created": "Passerelle créée avec succès",
    "gateway_creation_failed": "Échec de la création de la passerelle",
    "gateway_removed": "Passerelle supprimée"
  }
}
</i18n>
