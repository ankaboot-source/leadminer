<template>
  <ProgressCard
    :status="activeTask"
    :total="contactsToVerify"
    :rate="3"
    :started="taskStartedAt"
    :progress="verificationProgress"
    :progress-tooltip="progressTooltip"
  >
    <template #progress-title>
      <span class="pr-1">
        {{ contactsToVerify.toLocaleString() }}
      </span>
      {{ t('contacts_to_clean') }}
    </template>
  </ProgressCard>
  <div class="flex pt-6 justify-end">
    <Button
      v-if="activeTask"
      class="w-full md:w-max border-solid border-2 border-black"
      severity="contrast"
      icon="pi pi-stop"
      icon-pos="right"
      :label="t('halt_cleaning')"
      @click="haltCleaning"
    />
    <div v-else class="space-x-2">
      <Button
        class="w-full md:w-max"
        severity="secondary"
        :label="t('start_new_mining')"
        @click="startNewMining"
      />
      <Button
        class="w-full md:w-max border-solid border-2 border-black"
        severity="contrast"
        :label="t('enrich_contacts', $contactsStore.selectedLength)"
        :disabled="$contactsStore.selectedLength === 0"
        @click="$stepper.next()"
      >
        <template #icon
          ><span class="p-button-icon p-button-icon-right">💎</span>
        </template>
      </Button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { FetchError } from 'ofetch';

import ProgressCard from '@/components/ProgressCard.vue';

const { t } = useI18n({
  useScope: 'local',
});

const $toast = useToast();
const $stepper = useMiningStepper();
const $leadminerStore = useLeadminerStore();
const $contactsStore = useContactsStore();
const activeTask = computed(() => $leadminerStore.miningTask !== undefined);
const taskStartedAt = computed(() => $leadminerStore.miningStartedAt);
const contactsToVerify = computed(() => $leadminerStore.createdContacts);
const verifiedContacts = computed(() => $leadminerStore.verifiedContacts);
const verificationFinished = computed(
  () =>
    verifiedContacts.value > 0 &&
    verifiedContacts.value === contactsToVerify.value
);
const verificationProgress = computed(
  () => verifiedContacts.value / contactsToVerify.value || 0
);

const progressTooltip = computed(() =>
  t('contacts_verified', {
    verifiedContacts: verifiedContacts.value.toLocaleString(),
    contactsToVerify: contactsToVerify.value.toLocaleString(),
  })
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

watch(verificationFinished, (finished) => {
  if (finished) {
    cleaningDoneNotification();
  }
});

async function haltCleaning() {
  $leadminerStore.isLoadingStopMining = true;

  try {
    await $leadminerStore.stopMining();
    $toast.add({
      severity: 'success',
      summary: t('cleaning_stopped'),
      detail: t('cleaning_canceled'),
      life: 3000,
    });
    $leadminerStore.isLoadingStopMining = false;
  } catch (error) {
    $leadminerStore.isLoadingStopMining = false;
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

function startNewMining() {
  $leadminerStore.$resetMining();
  $stepper.go(1);
}
</script>

<i18n lang="json">
{
  "en": {
    "enrich_contacts": "Enrich {n} contacts",
    "contacts_to_clean": "estimated contacts to clean.",
    "halt_cleaning": "Halt cleaning",
    "start_new_mining": "Start a new mining",
    "verified_emails": "Verified emails: {verifiedContacts}/{contactsToVerify}",
    "cleaning_done": "Cleaning done",
    "contacts_verified": "{verifiedContacts} contacts are verified.",
    "cleaning_stopped": "Cleaning Stopped",
    "cleaning_canceled": "Your cleaning is successfully canceled.",
    "cleaning_already_canceled": "It seems you are trying to cancel a cleaning operation that is already canceled."
  },
  "fr": {
    "enrich_contacts": "Enrichissez {n} contacts",
    "contacts_to_clean": "contacts estimés à nettoyer",
    "halt_cleaning": "Arrêter le nettoyage",
    "start_new_mining": "Commencer une nouvelle extraction",
    "verified_emails": "E-mails vérifiés : {verifiedContacts}/{contactsToVerify}",
    "cleaning_done": "Nettoyage terminé",
    "contacts_verified": "{verifiedContacts} contacts ont été vérifiés.",
    "cleaning_stopped": "Nettoyage arrêté",
    "cleaning_canceled": "Votre nettoyage a été annulé avec succès.",
    "cleaning_already_canceled": "Il semble que vous essayez d'annuler une opération de nettoyage qui est déjà annulée."
  }
}
</i18n>
