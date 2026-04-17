<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useSmsFleetStore } from '~/stores/sms-fleet';
import ProviderForm from './ProviderForm.vue';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Checkbox from 'primevue/checkbox';
import ConfirmDialog from 'primevue/confirmdialog';
import ProgressSpinner from 'primevue/progressspinner';
import type { SmsGatewayProvider, SmsFleetGateway } from '@/types/sms-fleet';

type SupportedProvider = 'smsgate' | 'simple-sms-gateway';

const props = defineProps<{
  autoAdd?: boolean;
}>();

const emit = defineEmits<{
  gatewayCreated: [gateway: SmsFleetGateway];
}>();

watch(
  () => props.autoAdd,
  (shouldAutoAdd) => {
    if (shouldAutoAdd) {
      openAddDialog();
    }
  },
  { immediate: true },
);

const { t } = useI18n({ useScope: 'local' });
const { t: globalT } = useI18n({ useScope: 'global' });
const $confirm = useConfirm();
const $toast = useToast();
const $smsFleetStore = useSmsFleetStore();

const selectedProvider = ref<SupportedProvider | null>('simple-sms-gateway');
const isFormValid = ref(false);
const showDialog = ref(false);
const isEditing = ref(false);
const editingGatewayId = ref<string | null>(null);
const testingGatewayId = ref<string | null>(null);
const providerFormRef = ref<InstanceType<typeof ProviderForm> | null>(null);

const gatewayName = ref('');
const dailyLimit = ref(0);
const monthlyLimit = ref(0);
const isActive = ref(true);

const providerOptions = computed(() => [
  { label: 'SMSGate', value: 'smsgate' as const },
  { label: 'Simple SMS Gateway', value: 'simple-sms-gateway' as const },
]);

function handleFormValid(valid: boolean) {
  isFormValid.value = valid;
}

function submitGatewayForm() {
  if (!selectedProvider.value || !providerFormRef.value) return;
  providerFormRef.value.handleSubmit();
}

async function handleGatewaySubmit(config: {
  provider: string;
  config: Record<string, unknown>;
}) {
  const gatewayData = {
    name:
      gatewayName.value || getDefaultName(config.provider as SupportedProvider),
    provider: config.provider as SmsGatewayProvider,
    config: config.config,
    daily_limit: dailyLimit.value,
    monthly_limit: monthlyLimit.value,
    is_active: isActive.value,
  };

  let success = false;

  if (isEditing.value && editingGatewayId.value) {
    success = await $smsFleetStore.updateGateway(editingGatewayId.value, {
      ...gatewayData,
      is_active: isActive.value,
    });
    if (success) {
      $toast.add({
        severity: 'success',
        summary: t('gateway_updated'),
        life: 3000,
      });
    }
  } else {
    const result = await $smsFleetStore.createGateway(gatewayData);
    success = !!result;
    if (success && result) {
      $toast.add({
        severity: 'success',
        summary: t('gateway_created'),
        life: 3000,
      });
      emit('gatewayCreated', result);
    }
  }

  if (success) {
    closeDialog();
  } else {
    $toast.add({
      severity: 'error',
      summary: t('save_failed'),
      detail: $smsFleetStore.error || '',
      life: 5000,
    });
  }
}

function getDefaultName(provider: SupportedProvider): string {
  const names: Record<SupportedProvider, string> = {
    smsgate: 'SMSGate Gateway',
    'simple-sms-gateway': 'SMS Gateway',
  };
  return names[provider];
}

function openAddDialog() {
  isEditing.value = false;
  editingGatewayId.value = null;
  gatewayName.value = '';
  dailyLimit.value = 200;
  monthlyLimit.value = 200;
  isActive.value = true;
  showDialog.value = true;
}

function openEditDialog(gateway: SmsFleetGateway) {
  isEditing.value = true;
  editingGatewayId.value = gateway.id;
  selectedProvider.value = gateway.provider as SupportedProvider;
  gatewayName.value = gateway.name;
  dailyLimit.value = gateway.daily_limit;
  monthlyLimit.value = gateway.monthly_limit;
  isActive.value = gateway.is_active;
  showDialog.value = true;
}

function closeDialog() {
  showDialog.value = false;
  selectedProvider.value = null;
  providerFormRef.value?.resetForm();
}

async function testGateway(gatewayId: string) {
  testingGatewayId.value = gatewayId;

  const result = await $smsFleetStore.testGateway(gatewayId);

  $toast.add({
    severity: result.success ? 'success' : 'error',
    summary: result.success ? t('test_successful') : t('test_failed'),
    detail: result.message,
    life: 5000,
  });

  testingGatewayId.value = null;
}

function confirmDelete(gateway: SmsFleetGateway) {
  $confirm.require({
    message: t('delete_confirm_message', { name: gateway.name }),
    header: t('delete_confirm_header'),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('delete'),
    rejectLabel: globalT('common.cancel'),
    acceptClass: 'p-button-danger',
    accept: async () => {
      const success = await $smsFleetStore.deleteGateway(gateway.id);
      if (success) {
        $toast.add({
          severity: 'success',
          summary: t('gateway_deleted'),
          life: 3000,
        });
      } else {
        $toast.add({
          severity: 'error',
          summary: t('delete_failed'),
          detail: $smsFleetStore.error || '',
          life: 5000,
        });
      }
    },
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
    <div class="flex items-center justify-end">
      <Button
        :label="t('add_gateway')"
        icon="pi pi-plus"
        @click="openAddDialog"
      />
    </div>

    <div v-if="$smsFleetStore.isLoading" class="flex justify-center py-8">
      <ProgressSpinner />
    </div>

    <div
      v-else-if="$smsFleetStore.gateways.length === 0"
      class="text-center py-8 text-surface-500"
    >
      <p>{{ t('no_gateways_configured') }}</p>
    </div>

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="gateway in $smsFleetStore.gateways"
        :key="gateway.id"
        class="flex items-center justify-between p-3 border rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800"
      >
        <div class="flex items-center gap-3">
          <div class="flex flex-col">
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ gateway.name }}</span>
              <Tag
                :value="gateway.is_active ? t('active') : t('inactive')"
                :severity="gateway.is_active ? 'success' : 'secondary'"
                size="small"
              />
            </div>
            <span class="text-sm text-surface-500">
              {{ getProviderLabel(gateway.provider) }}
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Button
            text
            size="small"
            icon="pi pi-pencil"
            :label="t('edit')"
            @click="openEditDialog(gateway)"
          />
          <Button
            text
            size="small"
            icon="pi pi-check-circle"
            :label="t('test')"
            :loading="testingGatewayId === gateway.id"
            @click="testGateway(gateway.id)"
          />
          <Button
            text
            size="small"
            severity="danger"
            icon="pi pi-trash"
            :label="t('delete')"
            @click="confirmDelete(gateway)"
          />
        </div>
      </div>
    </div>

    <!-- Add/Edit Gateway Dialog -->
    <Dialog
      v-model:visible="showDialog"
      modal
      :header="isEditing ? t('edit_gateway') : t('add_gateway')"
      :style="{ width: '32rem', maxWidth: '95vw' }"
      @hide="closeDialog"
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t('gateway_name') }}</label>
          <InputText
            v-model="gatewayName"
            :placeholder="t('gateway_name_placeholder')"
          />
        </div>

        <Dropdown
          v-model="selectedProvider"
          :options="providerOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('select_provider')"
          :disabled="isEditing"
          class="w-full"
        />

        <ProviderForm
          v-if="selectedProvider && !isEditing"
          ref="providerFormRef"
          :provider="selectedProvider"
          @valid="handleFormValid"
          @submit="handleGatewaySubmit"
        />

        <template v-if="isEditing && selectedProvider">
          <ProviderForm
            ref="providerFormRef"
            :provider="selectedProvider"
            :initial-data="{
              baseUrl:
                $smsFleetStore.gateways.find((g) => g.id === editingGatewayId)
                  ?.config?.baseUrl ||
                $smsFleetStore.gateways.find((g) => g.id === editingGatewayId)
                  ?.config?.simpleSmsGatewayBaseUrl ||
                '',
              username:
                $smsFleetStore.gateways.find((g) => g.id === editingGatewayId)
                  ?.config?.username || '',
              password: '',
            }"
            @valid="handleFormValid"
            @submit="handleGatewaySubmit"
          />
        </template>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium flex items-center gap-1">
              {{ t('daily_limit') }}
              <i
                v-tooltip.top="t('limit_help')"
                class="pi pi-info-circle text-xs text-surface-500"
              />
            </label>
            <InputNumber
              v-model="dailyLimit"
              :min="0"
              :placeholder="t('unlimited')"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium flex items-center gap-1">
              {{ t('monthly_limit') }}
              <i
                v-tooltip.top="t('limit_help')"
                class="pi pi-info-circle text-xs text-surface-500"
              />
            </label>
            <InputNumber
              v-model="monthlyLimit"
              :min="0"
              :placeholder="t('unlimited')"
            />
          </div>
        </div>

        <div v-if="isEditing" class="flex items-center gap-2">
          <Checkbox v-model="isActive" :binary="true" input-id="isActive" />
          <label for="isActive" class="text-sm cursor-pointer">
            {{ t('gateway_active') }}
          </label>
        </div>
      </div>

      <template #footer>
        <Button
          outlined
          :label="globalT('common.cancel')"
          @click="closeDialog"
        />
        <Button
          v-if="selectedProvider"
          :label="isEditing ? t('save_changes') : t('add_gateway')"
          :loading="$smsFleetStore.isLoading"
          :disabled="!isFormValid || !selectedProvider"
          @click="submitGatewayForm"
        />
      </template>
    </Dialog>

    <ConfirmDialog />
  </div>
</template>

<i18n lang="json">
{
  "en": {
    "sms_fleet_management": "SMS Fleet Management",
    "add_gateway": "Add SMS Gateway",
    "no_gateways_configured": "No SMS gateways configured",
    "select_provider": "Select Provider",
    "active": "Active",
    "inactive": "Inactive",
    "edit": "Edit",
    "test": "Test",
    "delete": "Delete",
    "edit_gateway": "Edit SMS Gateway",
    "gateway_name": "Gateway Name",
    "gateway_name_placeholder": "e.g., Office Phone",
    "daily_limit": "Daily Limit (SMS/day)",
    "monthly_limit": "Monthly Limit (recipients/month)",
    "limit_help": "0 = unlimited",
    "unlimited": "Unlimited",
    "gateway_active": "Gateway is active",
    "gateway_created": "Gateway created successfully",
    "gateway_updated": "Gateway updated successfully",
    "gateway_deleted": "Gateway deleted",
    "save_failed": "Failed to save gateway",
    "delete_failed": "Failed to delete gateway",
    "test_successful": "Connection test successful",
    "test_failed": "Connection test failed",
    "delete_confirm_message": "Are you sure you want to delete the gateway \"{name}\"?",
    "delete_confirm_header": "Confirm Deletion",
    "save_changes": "Save Changes"
  },
  "fr": {
    "sms_fleet_management": "Gestion de la flotte SMS",
    "add_gateway": "Ajouter une passerelle SMS",
    "no_gateways_configured": "Aucune passerelle SMS configurée",
    "select_provider": "Sélectionner un fournisseur",
    "active": "Actif",
    "inactive": "Inactif",
    "edit": "Modifier",
    "test": "Tester",
    "delete": "Supprimer",
    "edit_gateway": "Modifier la passerelle SMS",
    "gateway_name": "Nom de la passerelle",
    "gateway_name_placeholder": "ex: Téléphone bureau",
    "daily_limit": "Limite quotidienne (SMS/jour)",
    "monthly_limit": "Limite mensuelle (destinataires/mois)",
    "limit_help": "0 = illimité",
    "unlimited": "Illimité",
    "gateway_active": "La passerelle est active",
    "gateway_created": "Passerelle créée avec succès",
    "gateway_updated": "Passerelle mise à jour avec succès",
    "gateway_deleted": "Passerelle supprimée",
    "save_failed": "Échec de l'enregistrement de la passerelle",
    "delete_failed": "Échec de la suppression de la passerelle",
    "test_successful": "Test de connexion réussi",
    "test_failed": "Échec du test de connexion",
    "delete_confirm_message": "Êtes-vous sûr de vouloir supprimer la passerelle \"{name}\" ?",
    "delete_confirm_header": "Confirmer la suppression",
    "save_changes": "Enregistrer les modifications"
  }
}
</i18n>
