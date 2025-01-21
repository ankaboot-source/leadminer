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
      {{ contactsToVerify.toLocaleString() }}
      {{
        verificationProgress < 1
          ? t('contacts_to_clean', contactsToVerify)
          : t('contacts_cleaned', contactsToVerify)
      }}
    </template>
  </ProgressCard>
  <div class="flex flex-col gap-2 pt-6 justify-end md:flex-row">
    <Button
      v-if="activeTask"
      class="w-full md:w-max border-solid border-2 border-black"
      severity="contrast"
      icon="pi pi-stop"
      icon-pos="right"
      :label="t('halt_cleaning')"
      @click="haltCleaning"
    />
    <div v-else class="flex flex-col gap-2 md:flex-row">
      <Button
        class="w-full md:w-max"
        severity="secondary"
        :label="t('start_new_mining')"
        @click="startNewMining"
      />
      <Button
        v-tooltip="t('enrich_button_tooltip')"
        class="w-full md:w-max border-solid border-2 border-black"
        severity="contrast"
        :label="t('enrich_contacts', $contactsStore.selectedContactsCount)"
        :disabled="
          $contactsStore.selectedContactsCount === 0 ||
          !$leadminerStore.cleaningFinished
        "
        @click="$stepper.next()"
      >
        <template #icon>
          <span class="p-button-icon p-button-icon-right">💎</span>
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
const verificationFinished = computed(() => $leadminerStore.cleaningFinished);
const verificationProgress = computed(
  () => verifiedContacts.value / contactsToVerify.value || 0,
);

const progressTooltip = computed(() =>
  t('contacts_verified', {
    verifiedContacts: verifiedContacts.value.toLocaleString(),
    contactsToVerify: contactsToVerify.value.toLocaleString(),
  }),
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

onMounted(() => {
  if (verificationFinished.value) {
    cleaningDoneNotification();
    console.info('Cleaning finished, showing notification.');
  } else {
    watch(verificationFinished, (finished) => {
      console.log(finished);
      if (finished) {
        cleaningDoneNotification();
        console.info('Cleaning finished, showing notification.');
      }
    });
  }
});

async function haltCleaning() {
  $leadminerStore.isLoadingStopMining = true;

  try {
    await $leadminerStore.stopMining(true, null);
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
    "cleaning_already_canceled": "It seems you are trying to cancel a cleaning operation that is already canceled."
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
    "cleaning_already_canceled": "Il semble que vous essayez d'annuler une opération de nettoyage qui est déjà annulée."
  }
}
</i18n>
