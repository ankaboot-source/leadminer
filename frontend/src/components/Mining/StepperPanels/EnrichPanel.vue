<template>
  <div class="flex justify-between items-center">
    <div id="progress-title">
      <span class="pr-1">
        {{
          currentProgress === 100
            ? enrichedContacts.toLocaleString()
            : (
                contactsToEnrichLengthPartial || contactsToEnrichLength
              ).toLocaleString()
        }}
      </span>
      {{
        currentProgress === 100
          ? t('text.contacts_enriched')
          : t('text.contacts_to_enrich')
      }}
    </div>
    <div id="progress-time" class="hidden md:block"></div>
  </div>

  <Divider
    :pt="{
      root: {
        style: {
          marginTop: '0.6rem',
          marginBottom: '0.6rem',
        },
      },
    }"
  />
  <div class="flex flex-col justify-center">
    <ProgressBar
      v-tooltip.bottom="{
        value: activeTask ? t('text.estimated_time') : undefined,
        escape: false,
      }"
      :mode="progressMode"
      :value="currentProgress"
      :pt="{
        value: {
          class: [progressColor],
        },
      }"
    />
  </div>
  <div class="flex pt-6 justify-end">
    <Button
      class="w-full md:w-max"
      severity="secondary"
      :label="t('button.start_new_mining')"
      @click="startNewMining"
    />
    <EnrichButton
      :contacts-to-enrich="contactsToEnrich"
      :v-model:enrichment-status="activeTask"
      :start-on-mounted="true"
      :enrichment-realtime-callback="enrichmentRealtimeCallback"
      :enrichment-request-response-callback="enrichRequestResponseCallback"
      :bordered="true"
    />
  </div>
</template>
<script setup lang="ts">
import { type RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import EnrichButton from '@/components/Mining/Buttons/EnrichButton.vue';
import { type EnrichmentTask } from '@/types/enrichment';

const { t } = useI18n({
  useScope: 'local',
});

const $stepper = useMiningStepper();
const $contactStore = useContactsStore();
const $leadminerStore = useLeadminerStore();

const activeTask = ref(true);
const contactsToEnrich = computed(() =>
  $contactStore.filtered.map((contact) => contact.email)
);
const contactsToEnrichLength = computed(() => contactsToEnrich.value.length);
const contactsToEnrichLengthPartial = ref<number>(0);

const enrichedContacts = ref(0);
const currentProgress = ref<number | undefined>();

const progressMode = computed(() =>
  activeTask.value ? 'indeterminate' : 'determinate'
);
const progressColor = computed(() =>
  activeTask.value ? 'bg-amber-400' : 'bg-green-600'
);

watch(contactsToEnrichLength, () => {
  contactsToEnrichLengthPartial.value = 0;
});
function startNewMining() {
  $leadminerStore.$resetMining();
  $stepper.go(1);
}

const enrichRequestResponseCallback = ({ response }: any) => {
  const { available } = response._data;
  if (response.status === 402) {
    contactsToEnrichLengthPartial.value = available;
  }
};
const enrichmentRealtimeCallback = (
  payload: RealtimePostgresChangesPayload<EnrichmentTask>
) => {
  const { status, details } = payload.new as EnrichmentTask;
  const { enriched } = details.result;

  switch (status) {
    case 'done':
      if (enriched) {
        enrichedContacts.value = enriched;
      }
      currentProgress.value = 100;
      break;
    default:
      break;
  }
};

onUnmounted(() => {
  activeTask.value = false;
});
</script>
<i18n lang="json">
{
  "en": {
    "notification": {
      "summary": "Enrich Contact",
      "enrichment_started": "Enrichment is running for {total} contacts.",
      "enrichment_completed": "{enriched}/{total} of your contacts has been successfully enriched.",
      "enrichment_canceled": "Your contact enrichment has been canceled.",
      "already_enriched": "Contacts you selected are already enriched.",
      "no_additional_info": "Enrichment completed, but no additional information was found for the selected contacts."
    },
    "text": {
      "estimated_time": "Enriching your contacts, hang tight!",
      "contacts_to_enrich": "contacts to enrich",
      "contacts_enriched": "contacts enriched"
    },
    "button": {
      "halt_enrichment": "Cancel enrichment",
      "start_new_mining": "Start a new mining"
    }
  },
  "fr": {
    "notification": {
      "summary": "Enrichir le Contact",
      "enrichment_started": "L'enrichissement est en cours pour ${total} contacts.",
      "enrichment_completed": "${total}/${enriched} de vos contacts ont été enrichis avec succès.",
      "enrichment_canceled": "L'enrichissement de votre contact a été annulé.",
      "already_enriched": "Ce contact est déjà enrichi.",
      "no_additional_info": "L'enrichissement est terminé, mais aucune information supplémentaire n'a été trouvée pour les contacts sélectionnés."
    },
    "text": {
      "estimated_time": "En train d'enrichir vos contacts, accrochez-vous !",
      "contacts_to_enrich": "contacts à enrichir",
      "contacts_enriched": "contacts enrichis"
    },
    "button": {
      "halt_enrichment": "Annuler l'enrichissement",
      "start_new_mining": "Commencer une nouvelle extraction"
    }
  }
}
</i18n>
