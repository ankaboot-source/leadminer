<template>
  <component
    :is="CreditsDialog"
    ref="CreditsDialogExportRef"
    engagement-type="contact"
    action-type="export"
    @secondary-action="
      exportTable(ExportTypes.GOOGLE_CONTACTS, true, updateEmptyFieldsOnly)
    "
  />
  <Dialog
    v-model:visible="dialogVisible"
    modal
    :state="{ maximized: true }"
    :header="t('confirm_google_export', contactsToTreat?.length ?? 0)"
    class="w-full sm:w-[35rem]"
  >
    <p>
      {{ t('google_export_confirmation') }}
    </p>

    <template #footer>
      <div class="flex flex-col sm:flex-row justify-between w-full gap-2">
        <Button
          :label="$t('common.cancel')"
          severity="secondary"
          class="w-full sm:w-auto order-3 sm:order-1"
          @click="closeGoogleExportConfirmationDialog"
        />
        <div
          class="flex flex-col gap-2 sm:flex-row w-full sm:w-auto order-1 sm:order-2"
        >
          <Button
            :label="t('update_empty_fields')"
            class="w-full sm:w-auto"
            @click="acceptAndCloseDialog(true)"
          />
          <Button
            :label="t('overwrite_all_fields')"
            class="w-full sm:w-auto"
            @click="acceptAndCloseDialog(false)"
          />
        </div>
      </div>
    </template>
  </Dialog>

  <div>
    <SplitButton
      id="export-dropdown"
      v-tooltip.top="
        disableExport &&
        t('select_at_least_one_contact', { action: t('export_csv') })
      "
      :label="$screenStore.size.md ? t('export_csv') : undefined"
      icon="pi pi-file"
      :model="exportItems"
      :disabled="disableExport"
      :spinner="true"
      :button-props="{
        id: 'export-csv',
        onClick: () => exportTable(ExportTypes.CSV),
      }"
    >
      <template #icon>
        <span class="p-button-icon p-button-icon-left">
          <i v-if="!activeExport" class="pi pi-file"></i>
          <i v-else class="pi pi-spin pi-spinner mr-1.5" />
        </span>
      </template>
    </SplitButton>
  </div>
  <MiningConsentSidebar
    v-model:show="$consentSidebar.status"
    v-model:provider="$consentSidebar.provider"
  />
</template>
<script setup lang="ts">
import {
  CreditsDialog,
  CreditsDialogExportRef,
  openCreditsDialog,
} from '@/utils/credits';

enum ExportTypes {
  CSV = 'csv',
  VCARD = 'vcard',
  GOOGLE_CONTACTS = 'google_contacts',
}

const contactsToTreat = defineModel<string[] | undefined>('contactsToTreat');
const disableExport = defineModel<boolean>('disableExport', {
  default: false,
});

const $toast = useToast();
const { $api } = useNuxtApp();
const $consentSidebar = useMiningConsentSidebar();
const $profile = useSupabaseUserProfile();
const $screenStore = useScreenStore();
const { t } = useI18n({ useScope: 'local' });

const selectedExportType = ref<ExportTypes>(ExportTypes.CSV);

const EXPORT_CONFIG: Record<
  ExportTypes,
  {
    endpoint: string;
    extension?: string;
    mimeType?: string;
    successSummaryKey: string;
  }
> = {
  [ExportTypes.CSV]: {
    endpoint: '/contacts/export/csv',
    extension: 'csv',
    mimeType: 'text/csv;charset=utf-8;',
    successSummaryKey: 'export_csv',
  },
  [ExportTypes.VCARD]: {
    endpoint: '/contacts/export/vcard',
    extension: 'vcf',
    mimeType: 'text/vcard;charset=utf-8;',
    successSummaryKey: 'export_vcard',
  },
  [ExportTypes.GOOGLE_CONTACTS]: {
    endpoint: '/contacts/export/google_contacts',
    successSummaryKey: 'export_google_contacts',
  },
};

const activeExport = ref(false);
const updateEmptyFieldsOnly = ref(false);
const dialogVisible = ref(false);

function openGoogleExportConfirmationDialog() {
  dialogVisible.value = true;
}

async function closeGoogleExportConfirmationDialog() {
  dialogVisible.value = false;
}

function saveFile(
  data: string | ArrayBuffer,
  filename: string,
  mimeType: string,
) {
  const blob = new Blob([data], { type: mimeType });

  const url = URL.createObjectURL(blob);

  const vcf = document.createElement('a');
  vcf.href = url;
  vcf.download = filename;
  vcf.click();

  URL.revokeObjectURL(url);
}

const openCreditModel = (
  hasDeficientCredits: boolean,
  {
    total,
    available,
    availableAlready,
  }: {
    total: number;
    available: number;
    availableAlready: number;
  },
) => {
  if (total === undefined || available === undefined) {
    return $toast.add({
      severity: 'error',
      summary: t('error_verifying_export_csv'),
      life: 3000,
    });
  }
  return openCreditsDialog(
    CreditsDialogExportRef,
    hasDeficientCredits,
    total,
    available,
    availableAlready ?? 0,
  );
};

function getFileName() {
  const email = $profile.value?.email as string;
  const currentDatetime = new Date().toISOString().slice(0, 10);
  const fileName = `leadminer-${email}-${currentDatetime}`;
  return fileName;
}

function exportToGoogle(type: ExportTypes) {
  selectedExportType.value = type;
  openGoogleExportConfirmationDialog();
}

async function exportTable(
  type: ExportTypes,
  partialExport = false,
  emptyFieldsOnly = false,
) {
  activeExport.value = true;
  selectedExportType.value = type;
  const config = EXPORT_CONFIG[type];

  try {
    await $api(config.endpoint, {
      method: 'POST',
      body: {
        exportType: type,
        partialExport,
        emails: contactsToTreat.value,
        exportAllContacts: contactsToTreat.value === undefined,
        updateEmptyFieldsOnly: emptyFieldsOnly,
      },
      onResponse({ response }) {
        activeExport.value = false;

        if (response.status === 401) {
          $consentSidebar.show('google', $profile.value?.email);
        }
        if (response.status === 402 || response.status === 266) {
          openCreditModel(response.status === 402, response._data);
          return;
        }

        if (response.status === 200 || response.status === 206) {
          if (config.extension && config.mimeType) {
            const filename = `${getFileName()}.${config.extension}`;
            saveFile(response._data, filename, config.mimeType);
          }

          $toast.add({
            severity: 'success',
            summary: t(config.successSummaryKey),
            detail: t('contacts_exported_successfully'),
            life: 8000,
          });
        }
      },
    });
  } catch (err) {
    activeExport.value = false;
    throw err;
  }
}

async function acceptAndCloseDialog(accepted: boolean) {
  dialogVisible.value = false;
  updateEmptyFieldsOnly.value = accepted;
  await exportTable(
    ExportTypes.GOOGLE_CONTACTS,
    false,
    updateEmptyFieldsOnly.value,
  );
}

const exportItems = computed(() => [
  {
    label: t('export_vcard'),
    icon: 'pi pi-id-card', // You might choose a different icon
    command: () => exportTable(ExportTypes.VCARD),
  },
  {
    label: t('export_google_contacts'),
    icon: 'pi pi-google', // PrimeIcons for Google/similar
    command: () => exportToGoogle(ExportTypes.GOOGLE_CONTACTS),
  },
]);
</script>

<i18n lang="json">
{
  "en": {
    "export_csv": "Export as CSV",
    "export_vcard": "Export as vcard",
    "export_google_contacts": "Export to google contacts",
    "confirm_google_export": "Confirm export to google contacts",
    "google_export_confirmation": "Choose how your contacts should be synced with google contacts.",
    "update_empty_fields": "Update empty fields only",
    "overwrite_all_fields": "Overwrite all fields",
    "contacts_exported_successfully": "Contacts exported successfully"
  },
  "fr": {
    "export_csv": "Exporter en CSV",
    "export_vcard": "Exporter en vcard",
    "export_google_contacts": "Vers google contacts",
    "confirm_google_export": "Confirmer l’export vers Google Contacts",
    "google_export_confirmation": "Choisissez comment vos contacts doivent être synchronisés avec Google Contacts.",
    "update_empty_fields": "Uniquement les champs vides",
    "overwrite_all_fields": "Tous les champs",
    "contacts_exported_successfully": "Contacts exportés avec succès"
  }
}
</i18n>
