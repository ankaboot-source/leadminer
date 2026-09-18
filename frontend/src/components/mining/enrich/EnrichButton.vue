<template>
  <component
    :is="CreditsDialog"
    ref="CreditsDialogEnrichRef"
    engagement-type="contact"
    action-type="enrich"
    @secondary-action="startEnrichment(true)"
  />
  <Dialog
    v-model:visible="dialogVisible"
    modal
    :state="{
      maximized: true,
    }"
    :header="t('confirm_enrichment', contactsToEnrich?.length ?? 0)"
    class="w-full sm:w-[35rem]"
  >
    <p>
      {{ t('update_confirmation') }}
    </p>
    <template #footer>
      <div class="flex flex-col sm:flex-row justify-between w-full gap-2">
        <Button
          :label="$t('common.cancel')"
          severity="secondary"
          class="w-full sm:w-auto order-3 sm:order-1"
          @click="closeEnrichmentConfirmationDialog"
        />
        <div
          class="flex flex-col gap-2 sm:flex-row w-full sm:w-auto order-1 sm:order-2"
        >
          <Button
            :label="t('update_empty')"
            class="w-full sm:w-auto"
            @click="
              () => {
                closeEnrichmentConfirmationDialog();
                startEnrichment(true);
              }
            "
          />
          <Button
            :label="t('update_all')"
            class="w-full sm:w-auto"
            @click="
              () => {
                closeEnrichmentConfirmationDialog();
                startEnrichment(false);
              }
            "
          />
        </div>
      </div>
    </template>
  </Dialog>
  <Button
    :id="`${source}-enrich-button`"
    v-tooltip="enrichTooltip"
    :class="{ 'border-solid border-2 border-black': bordered }"
    severity="contrast"
    :label="t('button.start_enrichment')"
    pt:label:class="hidden md:block"
    :disabled="isEnrichDisabled"
    @click="onClickEnrich"
  >
    <template #icon>
      <span class="p-button-icon p-button-icon-left">
        <span v-if="!$enrichmentStore.isActive">💎</span>
        <i v-else class="pi pi-spin pi-spinner mr-1.5" />
      </span>
    </template>
  </Button>
  <EnrichGdprSidebar
    ref="EnrichGdprSidebarRef"
    @has-given-consent="onAcceptEnrich"
  />
</template>
<script setup lang="ts">
import type { Contact } from '~/types/contact';
import {
  CreditsDialog,
  CreditsDialogEnrichRef,
  openCreditsDialog,
} from '@/utils/credits';
import EnrichGdprSidebar from './EnrichGdprSidebar.vue';
import { useEnrichmentStore } from '~/stores/enrichment';

const { t } = useI18n({
  useScope: 'local',
});

const props = defineProps<{
  startOnMounted?: boolean;
  enrichAllContacts: boolean;
  contactsToEnrich?: Partial<Contact>[];
  bordered?: boolean;
  skipDialog?: boolean;
  source?: 'stepper' | 'datatable' | 'contact';
}>();

const $toast = useToast();
const $enrichmentStore = useEnrichmentStore();
const $contactsStore = useContactsStore();
const dialogVisible = ref(false);

const { startOnMounted, bordered } = props;

const enrichAllContacts = toRef(() => props.enrichAllContacts);
const contactsToEnrich = toRef(() => props.contactsToEnrich);
const skipDialog = toRef(() => props.skipDialog);

function showNotification(
  severity: 'info' | 'warn' | 'error' | 'success' | 'secondary' | 'contrast',
  detail: string,
) {
  $toast.add({ severity, summary: '', detail, life: 5000 });
}

function showNotAvailableNotification() {
  showNotification('error', t('notification.enricher_configuration_required'));
}

function enrichmentNoCredits(total: number, available: number) {
  openCreditsDialog(CreditsDialogEnrichRef, true, total, available, 0);
}

async function startEnrichment(updateEmptyFieldsOnly: boolean) {
  const contacts = contactsToEnrich.value;
  const outcome =
    contacts?.length === 1
      ? await $enrichmentStore.startSingle(
          updateEmptyFieldsOnly,
          // skipcq: JS-0339
          contacts[0]!,
        )
      : await $enrichmentStore.startBulk(
          updateEmptyFieldsOnly,
          enrichAllContacts.value,
          contacts,
        );

  if (outcome.status === 'no-credits') {
    enrichmentNoCredits(outcome.total, outcome.available);
  } else if (outcome.status === 'unavailable') {
    showNotAvailableNotification();
  }
}

const ENRICH_PARAM = 'enrich';

const EnrichGdprSidebarRef = ref();
const $profile = useSupabaseUserProfile();
const hasAcceptedEnriching = computed(
  () => $profile.value?.gdpr_details.hasAcceptedEnriching,
);

/**
 * Verifies if user has accepted enriching conditions (using `hasAcceptedEnriching` of `$profile`), then proceeds to the enrichment confirmation dialog
 * @param justAcceptedEnrich : is a workaround as `hasAcceptedEnriching` of `$profile` can still be not updated from the realtime
 */
function openEnrichmentConfirmationDialog(justAcceptedEnrich?: boolean) {
  if (!justAcceptedEnrich && !hasAcceptedEnriching.value) {
    EnrichGdprSidebarRef.value.openModal();
    return;
  }

  const creditsDialogOpened = useCreditsDialog(
    CreditsDialogEnrichRef,
    contactsToEnrich.value
      ?.map(({ email }) => email)
      .filter((email): email is string => Boolean(email)),
  );
  if (creditsDialogOpened) return;

  if (skipDialog.value) {
    startEnrichment(false);
  } else dialogVisible.value = true;
}

onMounted(async () => {
  // Hydrate an in-flight task so a reload/navigation back to the page keeps
  // showing the loader instead of silently losing the running enrichment.
  await $enrichmentStore.init();

  if (startOnMounted) {
    await startEnrichment(true);
  }
  if (getParam(ENRICH_PARAM)) {
    openEnrichmentConfirmationDialog();
    removeQueryParam(ENRICH_PARAM);
  }
});

function onAcceptEnrich() {
  const justAcceptedEnrich = true;
  openEnrichmentConfirmationDialog(justAcceptedEnrich);
}

function onClickEnrich() {
  openEnrichmentConfirmationDialog();
}

const closeEnrichmentConfirmationDialog = () => {
  dialogVisible.value = false;
};

const enrichTooltip = computed(() => {
  const { done, total } = $enrichmentStore.progress;
  return $enrichmentStore.isRunning && total
    ? t('button.progress', { done, total })
    : t('button.tooltip');
});

const isEnrichDisabled = computed(
  () =>
    $enrichmentStore.isActive ||
    (!enrichAllContacts.value && !contactsToEnrich.value?.length) ||
    (enrichAllContacts.value && !$contactsStore.selectedContactsCount),
);
</script>
<i18n lang="json">
{
  "en": {
    "update_all": "Fill all",
    "update_empty": "Fill empty fields",
    "update_confirmation": "Updating the contact's information may overwrite the existing details. How would you like to proceed?",
    "confirm_enrichment": "Confirm contact enrichment | Confirm {n} contacts enrichment",
    "notification": {
      "enricher_configuration_required": "Enricher configuration is required."
    },
    "button": {
      "tooltip": "Extract public information on contacts I've already a relation with using third-party tools",
      "start_enrichment": "Enrich",
      "halt_enrichment": "Cancel enrichment",
      "progress": "Enriching… {done}/{total}"
    }
  },
  "fr": {
    "update_all": "Tout remplir",
    "update_empty": "Remplir les champs vides",
    "update_confirmation": "La mise à jour des informations du contact peut écraser les détails existants. Comment aimeriez-vous procéder ?",
    "confirm_enrichment": "Confirmer l'enrichissement du contact | Confirmer l'enrichissement des {n} contacts",
    "notification": {
      "enricher_configuration_required": "Configuration de l'enrichisseur est requise."
    },
    "button": {
      "tooltip": "Extraire des informations publiques sur les contacts avec lesquels je suis en relation à l'aide d'outils tiers.",
      "start_enrichment": "Enrichir",
      "halt_enrichment": "Annuler l'enrichissement",
      "progress": "Enrichissement… {done}/{total}"
    }
  }
}
</i18n>
