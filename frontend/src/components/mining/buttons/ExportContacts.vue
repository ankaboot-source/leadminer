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
  <!-- Google Account Selection Dialog -->
  <Dialog
    v-model:visible="accountSelectionDialogVisible"
    modal
    :draggable="false"
    :header="t('select_google_account_title')"
    :style="{ width: '35rem' }"
    pt:content:class="p-6 pt-2"
    pt:footer:class="p-6 pt-0"
  >
    <div class="flex flex-col gap-4">
      <p class="text-surface-600">
        {{ t('select_google_account_description') }}
      </p>
      <Select
        v-model="selectedGoogleAccount"
        :options="googleMiningSources"
        option-label="email"
        option-value="email"
        :placeholder="t('select_google_account_placeholder')"
      />
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          :label="t('cancel')"
          severity="secondary"
          text
          @click="closeAccountSelectionDialog"
        />
        <Button
          :label="t('continue')"
          :disabled="!selectedGoogleAccount"
          @click="onAccountSelected"
        />
      </div>
    </template>
  </Dialog>

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
          :label="t('common.cancel')"
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
      icon="pi pi-file-export"
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
          <i v-if="!activeExport" class="pi pi-file-export"></i>
          <i v-else class="pi pi-spin pi-spinner mr-1.5" />
        </span>
      </template>
    </SplitButton>
  </div>
  <MiningConsentSidebar
    v-model:show="$consentSidebar.status"
    v-model:provider="$consentSidebar.provider"
    v-model:authorize-redirect="$consentSidebar.authorizedRedirect"
  />
</template>
<script setup lang="ts">
import {
  CreditsDialog,
  CreditsDialogExportRef,
  openCreditsDialog,
} from '@/utils/credits';
import type { FetchError } from 'ofetch';

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
const { t } = useI18n();

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
const accountSelectionDialogVisible = ref(false);
const selectedGoogleAccount = ref<string | null>(null);
const $leadminerStore = useLeadminerStore();

const googleMiningSources = computed(() =>
  $leadminerStore.miningSources.filter((source) => source.type === 'google'),
);

function openGoogleExportConfirmationDialog() {
  dialogVisible.value = true;
}

async function closeGoogleExportConfirmationDialog() {
  dialogVisible.value = false;
}

async function openAccountSelectionDialog() {
  // Preselect user's email if it exists in Google mining sources
  const userEmail = $profile.value?.email;
  if (
    userEmail &&
    googleMiningSources.value.some((s) => s.email === userEmail)
  ) {
    selectedGoogleAccount.value = userEmail;
  }

  accountSelectionDialogVisible.value = true;
}

function closeAccountSelectionDialog() {
  accountSelectionDialogVisible.value = false;
}

function onAccountSelected() {
  closeAccountSelectionDialog();
  openGoogleExportConfirmationDialog();
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

async function exportToGoogle(type: ExportTypes) {
  selectedExportType.value = type;

  // Fetch mining sources if not already loaded
  if (!$leadminerStore.miningSources.length) {
    await $leadminerStore.fetchMiningSources();
  }

  if (
    googleMiningSources.value.length === 1 &&
    googleMiningSources?.value[0]?.email
  ) {
    selectedGoogleAccount.value = googleMiningSources.value[0].email;
    openGoogleExportConfirmationDialog();
  } else {
    await openAccountSelectionDialog();
  }
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
        targetEmail:
          type === ExportTypes.GOOGLE_CONTACTS
            ? selectedGoogleAccount.value
            : undefined,
      },
      onResponse({ response }) {
        activeExport.value = false;

        if (response.status === 402 || response.status === 266) {
          openCreditModel(response.status === 402, response._data);
          return;
        }

        if (response.status === 200 || response.status === 206) {
          if (config.extension && config.mimeType) {
            const filename = `${getFileName()}.${config.extension}`;
            saveFile(response._data, filename, config.mimeType);
          }

          let message;
          if (contactsToTreat.value === undefined) {
            message = t('contacts_exported_successfully.all');
          } else if (contactsToTreat.value.length === 0) {
            message = t('contacts_exported_successfully.none');
          } else if (contactsToTreat.value.length === 1) {
            message = t('contacts_exported_successfully.one');
          } else
            message = t('contacts_exported_successfully.other', {
              count: contactsToTreat.value.length,
            });

          if (type === ExportTypes.GOOGLE_CONTACTS) {
            const labelId = response._data?.labelId ?? null;
            const googleContactsUrl = labelId
              ? `https://contacts.google.com/label/${labelId}`
              : 'https://contacts.google.com';

            $toast.add({
              severity: 'success',
              summary: t(config.successSummaryKey),
              detail: {
                message,
                button: {
                  text: t('view_in_google_contacts'),
                  action: () => {
                    window.open(
                      googleContactsUrl,
                      '_blank',
                      'noopener noreferrer',
                    );
                  },
                },
              },
              group: 'has-links',
              life: 8000,
            });
          } else {
            $toast.add({
              severity: 'success',
              summary: t(config.successSummaryKey),
              detail: message,
              life: 8000,
            });
          }
        }
      },
    });
  } catch (err) {
    activeExport.value = false;

    if ((err as FetchError).response?.status === 401) {
      $consentSidebar.show(
        'google',
        selectedGoogleAccount.value || $profile.value?.email,
        '/contacts',
      );
      return;
    }

    throw err;
  } finally {
    // Reset selected account after export attempt
    selectedGoogleAccount.value = null;
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

const $user = useSupabaseUser();
const isGoogleUser = computed(() => $user.value?.email.includes('@gmail.com'));

const exportItems = computed(() => [
  {
    label: t('export_vcard'),
    icon: 'pi pi-id-card', // You might choose a different icon
    command: () => exportTable(ExportTypes.VCARD),
  },
  {
    label: t('export_google_contacts'),
    icon: 'pi pi-google', // PrimeIcons for Google/similar
    command: async () => await exportToGoogle(ExportTypes.GOOGLE_CONTACTS),
    disabled: !isGoogleUser.value,
  },
]);
</script>

<i18n lang="json">
{
  "en": {
    "export_csv": "Export as CSV",
    "export_vcard": "Export as vCards",
    "export_google_contacts": "Synchronize to Google Contacts",
    "confirm_google_export": "Synchronize to Google Contacts",
    "google_export_confirmation": "Choose how your contacts should be synced with google contacts.",
    "update_empty_fields": "Update empty fields only",
    "overwrite_all_fields": "Overwrite all fields",
    "contacts_exported_successfully": {
      "all": "All contacts have been exported successfully",
      "none": "No contacts exported",
      "one": "contact exported successfully",
      "other": "{count} contacts exported successfully"
    },
    "select_google_account_title": "Select Google Account",
    "select_google_account_description": "Choose which Google account to export contacts to:",
    "select_google_account_placeholder": "Select a Google account",
    "continue": "Continue",
    "cancel": "Cancel",
    "view_in_google_contacts": "View in Google Contacts"
  },
  "fr": {
    "export_csv": "Exporter en CSV",
    "export_vcard": "Exporter en vCards",
    "export_google_contacts": "Synchroniser vers Google Contacts",
    "confirm_google_export": "Synchroniser vers Google Contacts",
    "google_export_confirmation": "Choisissez comment vos contacts doivent être synchronisés avec Google Contacts.",
    "update_empty_fields": "Uniquement les champs vides",
    "overwrite_all_fields": "Tous les champs",
    "contacts_exported_successfully": {
      "all": "Tous les contacts ont été exportés avec succès",
      "none": "Aucun contact exporté",
      "one": "contact exporté avec succès",
      "other": "{count} contacts exportés avec succès"
    },
    "select_google_account_title": "Sélectionner un compte Google",
    "select_google_account_description": "Choisissez vers quel compte Google exporter les contacts :",
    "select_google_account_placeholder": "Sélectionnez un compte Google",
    "continue": "Continuer",
    "cancel": "Annuler",
    "view_in_google_contacts": "Voir dans Google Contacts"
  }
}
</i18n>
