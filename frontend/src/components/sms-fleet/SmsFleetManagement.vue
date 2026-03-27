<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold">{{ t('sms_fleet_management') }}</h3>
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
      <i class="pi pi-mobile text-4xl mb-2" />
      <p>{{ t('no_gateways_configured') }}</p>
      <p class="text-sm">{{ t('add_gateway_to_start') }}</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card
        v-for="gateway in $smsFleetStore.gateways"
        :key="gateway.id"
        :class="{ 'opacity-60': !gateway.is_active }"
      >
        <template #title>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i :class="getProviderIcon(gateway.provider)" />
              <span>{{ gateway.name }}</span>
            </div>
            <Tag
              :value="gateway.is_active ? t('active') : t('inactive')"
              :severity="gateway.is_active ? 'success' : 'secondary'"
            />
          </div>
        </template>

        <template #content>
          <div class="flex flex-col gap-2 text-sm">
            <div class="flex items-center gap-2 text-surface-600">
              <i class="pi pi-server text-xs" />
              <span class="capitalize">{{ formatProvider(gateway.provider) }}</span>
            </div>

            <div class="flex items-center gap-2">
              <i class="pi pi-send text-xs" />
              <span>{{ t('sent_today', { count: gateway.sent_today }) }}</span>
              <span v-if="gateway.daily_limit > 0" class="text-surface-500">
                / {{ gateway.daily_limit }}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <i class="pi pi-calendar text-xs" />
              <span>{{ t('sent_this_month', { count: gateway.sent_this_month }) }}</span>
              <span v-if="gateway.monthly_limit > 0" class="text-surface-500">
                / {{ gateway.monthly_limit }}
              </span>
            </div>
          </div>
        </template>

        <template #footer>
          <div class="flex gap-2">
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
        </template>
      </Card>
    </div>

    <!-- Add/Edit Gateway Dialog -->
    <Dialog
      v-model:visible="showDialog"
      modal
      :header="isEditing ? t('edit_gateway') : t('add_gateway')"
      :style="{ width: '32rem', maxWidth: '95vw' }"
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t('gateway_name') }} *</label>
          <InputText
            v-model="form.name"
            :placeholder="t('gateway_name_placeholder')"
            @blur="markTouched('name')"
          />
          <small v-if="showFieldError('name')" class="text-red-500">
            {{ validationErrors.name }}
          </small>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t('provider') }} *</label>
          <Select
            v-model="form.provider"
            :options="providerOptions"
            option-label="label"
            option-value="value"
            :disabled="isEditing"
            @change="onProviderChange"
          />
        </div>

        <!-- SMSGate Configuration -->
        <template v-if="form.provider === 'smsgate'">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t('smsgate_base_url') }}</label>
            <InputText
              v-model="form.config.baseUrl"
              placeholder="https://api.sms-gate.app/3rdparty/v1/messages"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t('smsgate_username') }} *</label>
            <InputText
              v-model="form.config.username"
              @blur="markTouched('smsgateUsername')"
            />
            <small v-if="showFieldError('smsgateUsername')" class="text-red-500">
              {{ validationErrors.smsgateUsername }}
            </small>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t('smsgate_password') }} *</label>
            <Password
              v-model="form.config.password"
              :feedback="false"
              toggle-mask
              input-class="w-full"
              @blur="markTouched('smsgatePassword')"
            />
            <small v-if="showFieldError('smsgatePassword')" class="text-red-500">
              {{ validationErrors.smsgatePassword }}
            </small>
          </div>
        </template>

        <!-- Simple SMS Gateway Configuration -->
        <template v-if="form.provider === 'simple-sms-gateway'">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t('simple_sms_gateway_base_url') }} *</label>
            <InputText
              v-model="form.config.simpleSmsGatewayBaseUrl"
              placeholder="http://192.168.1.100:8080/send-sms"
              @blur="markTouched('simpleSmsGatewayBaseUrl')"
            />
            <small v-if="showFieldError('simpleSmsGatewayBaseUrl')" class="text-red-500">
              {{ validationErrors.simpleSmsGatewayBaseUrl }}
            </small>
          </div>
        </template>

        <!-- Limits -->
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
              v-model="form.dailyLimit"
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
              v-model="form.monthlyLimit"
              :min="0"
              :placeholder="t('unlimited')"
            />
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Checkbox v-model="form.isActive" :binary="true" input-id="isActive" />
          <label for="isActive" class="text-sm cursor-pointer">
            {{ t('gateway_active') }}
          </label>
        </div>
      </div>

      <template #footer>
        <Button
          outlined
          :label="globalT('common.cancel')"
          @click="showDialog = false"
        />
        <Button
          :label="isEditing ? t('save_changes') : t('add_gateway')"
          :loading="$smsFleetStore.isLoading"
          :disabled="!isFormValid"
          @click="saveGateway"
        />
      </template>
    </Dialog>

    <!-- Delete Confirmation -->
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import InputNumber from 'primevue/inputnumber';
import type { SmsFleetGateway, SmsGatewayProvider } from '@/types/sms-fleet';

const { t } = useI18n({ useScope: 'local' });
const { t: globalT } = useI18n({ useScope: 'global' });
const $confirm = useConfirm();
const $toast = useToast();
const $smsFleetStore = useSmsFleetStore();

const showDialog = ref(false);
const isEditing = ref(false);
const editingGatewayId = ref<string | null>(null);
const testingGatewayId = ref<string | null>(null);

const providerOptions = [
  { label: 'SMSGate', value: 'smsgate' as const },
  { label: 'Simple SMS Gateway', value: 'simple-sms-gateway' as const },
];

const form = reactive({
  name: '',
  provider: 'smsgate' as SmsGatewayProvider,
  config: {
    baseUrl: 'https://api.sms-gate.app/3rdparty/v1/messages',
    username: '',
    password: '',
    simpleSmsGatewayBaseUrl: 'http://192.168.1.100:8080/send-sms',
  },
  dailyLimit: 0,
  monthlyLimit: 0,
  isActive: true,
});

type FormField = 'name' | 'smsgateUsername' | 'smsgatePassword' | 'simpleSmsGatewayBaseUrl';

const touched = reactive<Record<FormField, boolean>>({
  name: false,
  smsgateUsername: false,
  smsgatePassword: false,
  simpleSmsGatewayBaseUrl: false,
});

const validationErrors = computed(() => {
  const errors: Record<FormField, string> = {
    name: form.name.trim().length === 0 ? t('name_required') : '',
    smsgateUsername:
      form.provider === 'smsgate' && !form.config.username?.trim()
        ? t('username_required')
        : '',
    smsgatePassword:
      form.provider === 'smsgate' && !form.config.password?.trim()
        ? t('password_required')
        : '',
    simpleSmsGatewayBaseUrl:
      form.provider === 'simple-sms-gateway' && !form.config.simpleSmsGatewayBaseUrl?.trim()
        ? t('base_url_required')
        : '',
  };
  return errors;
});

const isFormValid = computed(() =>
  Object.values(validationErrors.value).every((error) => !error),
);

const showFieldError = (field: FormField) => {
  return touched[field] && validationErrors.value[field];
};

const markTouched = (field: FormField) => {
  touched[field] = true;
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

const resetForm = () => {
  form.name = '';
  form.provider = 'smsgate';
  form.config = {
    baseUrl: 'https://api.sms-gate.app/3rdparty/v1/messages',
    username: '',
    password: '',
    simpleSmsGatewayBaseUrl: 'http://192.168.1.100:8080/send-sms',
  };
  form.dailyLimit = 0;
  form.monthlyLimit = 0;
  form.isActive = true;
  
  Object.keys(touched).forEach((key) => {
    touched[key as FormField] = false;
  });
};

const openAddDialog = () => {
  isEditing.value = false;
  editingGatewayId.value = null;
  resetForm();
  showDialog.value = true;
};

const openEditDialog = (gateway: SmsFleetGateway) => {
  isEditing.value = true;
  editingGatewayId.value = gateway.id;
  
  form.name = gateway.name;
  form.provider = gateway.provider;
  form.config = { ...gateway.config };
  form.dailyLimit = gateway.daily_limit;
  form.monthlyLimit = gateway.monthly_limit;
  form.isActive = gateway.is_active;
  
  showDialog.value = true;
};

const onProviderChange = () => {
  // Reset config when provider changes
  if (form.provider === 'smsgate') {
    form.config = {
      baseUrl: 'https://api.sms-gate.app/3rdparty/v1/messages',
      username: '',
      password: '',
    };
  } else if (form.provider === 'simple-sms-gateway') {
    form.config = {
      simpleSmsGatewayBaseUrl: 'http://192.168.1.100:8080/send-sms',
    };
  }
};

const saveGateway = async () => {
  if (!isFormValid.value) return;

  const payload = {
    name: form.name.trim(),
    provider: form.provider,
    config: form.config,
    daily_limit: form.dailyLimit,
    monthly_limit: form.monthlyLimit,
  };

  let success = false;

  if (isEditing.value && editingGatewayId.value) {
    success = await $smsFleetStore.updateGateway(editingGatewayId.value, {
      ...payload,
      is_active: form.isActive,
    });
    if (success) {
      $toast.add({
        severity: 'success',
        summary: t('gateway_updated'),
        life: 3000,
      });
    }
  } else {
    const gateway = await $smsFleetStore.createGateway(payload);
    success = !!gateway;
    if (success) {
      $toast.add({
        severity: 'success',
        summary: t('gateway_created'),
        life: 3000,
      });
    }
  }

  if (success) {
    showDialog.value = false;
    resetForm();
  } else {
    $toast.add({
      severity: 'error',
      summary: t('save_failed'),
      detail: $smsFleetStore.error || '',
      life: 5000,
    });
  }
};

const testGateway = async (gatewayId: string) => {
  testingGatewayId.value = gatewayId;
  
  const result = await $smsFleetStore.testGateway(gatewayId);
  
  $toast.add({
    severity: result.success ? 'success' : 'error',
    summary: result.success ? t('test_successful') : t('test_failed'),
    detail: result.message,
    life: 5000,
  });
  
  testingGatewayId.value = null;
};

const confirmDelete = (gateway: SmsFleetGateway) => {
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
};

// Load gateways on mount
onMounted(() => {
  $smsFleetStore.fetchGateways();
});
</script>

<i18n lang="json">
{
  "en": {
    "sms_fleet_management": "SMS Fleet Management",
    "add_gateway": "Add SMS Gateway",
    "no_gateways_configured": "No SMS gateways configured",
    "add_gateway_to_start": "Add an SMS gateway to start sending campaigns",
    "active": "Active",
    "inactive": "Inactive",
    "edit": "Edit",
    "test": "Test",
    "delete": "Delete",
    "sent_today": "{count} sent today",
    "sent_this_month": "{count} sent this month",
    "edit_gateway": "Edit SMS Gateway",
    "gateway_name": "Gateway Name",
    "gateway_name_placeholder": "e.g., Office Phone",
    "provider": "Provider",
    "smsgate_base_url": "API Base URL",
    "smsgate_username": "Username",
    "smsgate_password": "Password",
    "simple_sms_gateway_base_url": "Gateway URL",
    "daily_limit": "Daily Limit",
    "monthly_limit": "Monthly Limit",
    "limit_help": "0 = unlimited",
    "unlimited": "Unlimited",
    "gateway_active": "Gateway is active",
    "name_required": "Gateway name is required",
    "username_required": "Username is required",
    "password_required": "Password is required",
    "base_url_required": "Gateway URL is required",
    "save_changes": "Save Changes",
    "gateway_updated": "Gateway updated successfully",
    "gateway_created": "Gateway created successfully",
    "save_failed": "Failed to save gateway",
    "test_successful": "Connection test successful",
    "test_failed": "Connection test failed",
    "delete_confirm_message": "Are you sure you want to delete the gateway \"{name}\"?",
    "delete_confirm_header": "Confirm Deletion",
    "gateway_deleted": "Gateway deleted",
    "delete_failed": "Failed to delete gateway"
  },
  "fr": {
    "sms_fleet_management": "Gestion de la flotte SMS",
    "add_gateway": "Ajouter une passerelle SMS",
    "no_gateways_configured": "Aucune passerelle SMS configurée",
    "add_gateway_to_start": "Ajoutez une passerelle SMS pour commencer à envoyer des campagnes",
    "active": "Actif",
    "inactive": "Inactif",
    "edit": "Modifier",
    "test": "Tester",
    "delete": "Supprimer",
    "sent_today": "{count} envoyés aujourd'hui",
    "sent_this_month": "{count} envoyés ce mois",
    "edit_gateway": "Modifier la passerelle SMS",
    "gateway_name": "Nom de la passerelle",
    "gateway_name_placeholder": "ex: Téléphone bureau",
    "provider": "Fournisseur",
    "smsgate_base_url": "URL de base API",
    "smsgate_username": "Nom d'utilisateur",
    "smsgate_password": "Mot de passe",
    "simple_sms_gateway_base_url": "URL de la passerelle",
    "daily_limit": "Limite quotidienne",
    "monthly_limit": "Limite mensuelle",
    "limit_help": "0 = illimité",
    "unlimited": "Illimité",
    "gateway_active": "La passerelle est active",
    "name_required": "Le nom de la passerelle est requis",
    "username_required": "Le nom d'utilisateur est requis",
    "password_required": "Le mot de passe est requis",
    "base_url_required": "L'URL de la passerelle est requise",
    "save_changes": "Enregistrer les modifications",
    "gateway_updated": "Passerelle mise à jour avec succès",
    "gateway_created": "Passerelle créée avec succès",
    "save_failed": "Échec de l'enregistrement de la passerelle",
    "test_successful": "Test de connexion réussi",
    "test_failed": "Échec du test de connexion",
    "delete_confirm_message": "Êtes-vous sûr de vouloir supprimer la passerelle \"{name}\" ?",
    "delete_confirm_header": "Confirmer la suppression",
    "gateway_deleted": "Passerelle supprimée",
    "delete_failed": "Échec de la suppression de la passerelle"
  }
}
</i18n>
