<template>
  <div class="flex flex-col gap-3">
    <div v-if="$smsFleetStore.isLoading" class="flex justify-center py-4">
      <ProgressSpinner style="width: 2rem; height: 2rem" />
    </div>

    <div
      v-else-if="availableGateways.length === 0"
      class="text-center py-4 border border-dashed border-surface-300 rounded-md"
    >
      <i class="pi pi-mobile text-2xl text-surface-400 mb-2" />
      <p class="text-sm text-surface-500">{{ t('no_gateways') }}</p>
      <Button
        text
        size="small"
        icon="pi pi-plus"
        :label="t('add_gateway')"
        @click="$emit('add-gateway')"
      />
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
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SmsGatewayProvider } from '@/types/sms-fleet';

const { t } = useI18n({ useScope: 'local' });
const $smsFleetStore = useSmsFleetStore();

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
    "selected_count": "{count} gateway(s) selected"
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
    "selected_count": "{count} passerelle(s) sélectionnée(s)"
  }
}
</i18n>
