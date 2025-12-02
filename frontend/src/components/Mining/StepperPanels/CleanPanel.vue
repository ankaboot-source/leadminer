<template>
  <ProgressCard
    v-if="isPostCleaningPhase"
    :rate="AVERAGE_CLEANING_RATE"
    :status="$leadminerStore.activeTask"
    :progress-time="t('processing_signatures_time')"
    :progress-title="t('processing_signatures')"
    :mode="isPostCleaningPhase ? 'indeterminate' : 'determinate'"
  >
  </ProgressCard>

  <ProgressCard
    v-else
    :status="$leadminerStore.activeTask"
    :total="contactsToVerify"
    :current="verifiedContacts"
    :rate="AVERAGE_CLEANING_RATE"
    :started="taskStartedAt"
    :progress="verificationProgress"
    :progress-tooltip="progressTooltip"
  >
    <template #progress-title>
      {{ contactsToVerify.toLocaleString() }}
      {{
        verificationProgress < 1
          ? t('contacts_to_clean', contactsToVerify)
          : t('contacts_cleaned', contactsToVerify)
      }}
    </template>
  </ProgressCard>
  <div class="flex flex-col md:flex-row justify-center gap-2">
    <Button
      v-if="$leadminerStore.activeTask && !$leadminerStore.miningCompleted"
      class="w-full md:w-max"
      icon="pi pi-stop"
      icon-pos="right"
      severity="danger"
      outlined
      :loading="$leadminerStore.isLoadingStopMining"
      :label="t('halt_cleaning')"
      @click="haltCleaning"
    />
  </div>
  <component :is="AcceptNewsLetter" v-if="verificationFinished" type="dialog" />
</template>
<script setup lang="ts">
import ProgressCard from '@/components/ProgressCard.vue';
import { FetchError } from 'ofetch';
import { AcceptNewsLetter } from '~/utils/extras';

const { t } = useI18n({
  useScope: 'local',
});

const $toast = useToast();
const $leadminerStore = useLeadminerStore();
const taskStartedAt = computed(() => $leadminerStore.miningStartedAt);
const contactsToVerify = computed(() => $leadminerStore.createdContacts);
const verifiedContacts = computed(() => $leadminerStore.verifiedContacts);
const verificationFinished = computed(
  () => !$leadminerStore.miningInterrupted && $leadminerStore.miningCompleted,
);
const verificationProgress = computed(
  () => verifiedContacts.value / contactsToVerify.value || 0,
);

const progressTooltip = computed(() =>
  t('contacts_verified', {
    verifiedContacts: verifiedContacts.value.toLocaleString(),
    contactsToVerify: contactsToVerify.value.toLocaleString(),
  }),
);

const isPostCleaningPhase = computed(
  () => $leadminerStore.cleaningFinished && !$leadminerStore.miningCompleted,
);

function cleaningDoneNotification() {
  $toast.add({
    severity: 'success',
    summary: t('cleaning_done'),
    detail: t('contacts_verified', {
      verifiedContacts: verifiedContacts.value.toLocaleString(),
    }),
    group: 'achievement',
    life: 5000,
  });
}

function cleaningFinished() {
  cleaningDoneNotification();
  const timeoutId = setTimeout(() => navigateTo('/contacts'), 10000);

  onBeforeUnmount(() => {
    clearTimeout(timeoutId);
  });
}

onMounted(() => {
  if (verificationFinished.value) {
    cleaningFinished();
  } else {
    watch(verificationFinished, (finished) => {
      if (finished) {
        cleaningFinished();
      }
    });
  }
});

async function haltCleaning() {
  try {
    if (isPostCleaningPhase.value) {
      await $leadminerStore.stopMining(true, null);
    } else {
      const cleaning = [$leadminerStore.miningTask?.processes.clean].filter(
        Boolean,
      ) as string[];
      await $leadminerStore.stopMining(cleaning.length === 0, cleaning ?? null);
    }
    $toast.add({
      severity: 'info',
      summary: t('cleaning_stopped'),
      detail: t('cleaning_canceled'),
      life: 3000,
    });
  } catch (error) {
    if (error instanceof FetchError && error.response?.status === 404) {
      $toast.add({
        severity: 'warn',
        summary: t('cleaning_stopped'),
        detail: t('cleaning_already_canceled'),
        life: 5000,
      });
      $leadminerStore.miningTask = undefined;
      $leadminerStore.miningStartedAt = undefined;
    } else {
      throw error;
    }
  }
}
</script>

<i18n lang="json">
{
  "en": {
    "enrich_button_tooltip": "Extract public information on contacts I've already a relation with using third-party tools",
    "enrich_contacts": "Enrich {n} contacts",
    "contacts_to_clean": "estimated contact to clean. | estimated contacts to clean.",
    "contacts_cleaned": "contact cleaned. | contacts cleaned.",
    "halt_cleaning": "Halt cleaning",
    "start_new_mining": "Start a new mining",
    "verified_emails": "Verified emails: {verifiedContacts}/{contactsToVerify}",
    "cleaning_done": "Cleaning done",
    "contacts_verified": "{verifiedContacts} contacts are verified.",
    "cleaning_stopped": "Cleaning Stopped",
    "cleaning_canceled": "Your cleaning is successfully canceled.",
    "cleaning_already_canceled": "It seems you are trying to cancel a cleaning operation that is already canceled.",
    "processing_signatures": "Extracting signatures from your emails",
    "processing_signatures_time": "Signature processing may take around 10 minutes"
  },
  "fr": {
    "enrich_button_tooltip": "Extraire des informations publiques sur les contacts avec lesquels je suis en relation à l'aide d'outils tiers.",
    "enrich_contacts": "Enrichissez {n} contacts",
    "contacts_to_clean": "contact estimé à nettoyer | contacts estimés à nettoyer",
    "contacts_cleaned": "contact nettoyé. | contacts nettoyés.",
    "halt_cleaning": "Arrêter le nettoyage",
    "start_new_mining": "Commencer une nouvelle extraction",
    "verified_emails": "E-mails vérifiés : {verifiedContacts}/{contactsToVerify}",
    "cleaning_done": "Nettoyage terminé",
    "contacts_verified": "{verifiedContacts} contacts ont été vérifiés.",
    "cleaning_stopped": "Nettoyage arrêté",
    "cleaning_canceled": "Votre nettoyage a été annulé avec succès.",
    "cleaning_already_canceled": "Il semble que vous essayez d'annuler une opération de nettoyage qui est déjà annulée.",
    "processing_signatures": "Extraction des signatures provenant de vos e-mails",
    "processing_signatures_time": "Le traitement des signatures peut prendre environ 10 minutes"
  }
}
</i18n>
