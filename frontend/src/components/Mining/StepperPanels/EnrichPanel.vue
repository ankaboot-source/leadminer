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
        value: $leadminerStore.activeEnrichment
          ? t('text.estimated_time')
          : undefined,
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
      :start-on-mounted="true"
      :enrichment-realtime-callback="enrichmentRealtimeCallback"
      :enrichment-request-response-callback="enrichRequestResponseCallback"
      :bordered="true"
      :skip-dialog="true"
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
const $contactsStore = useContactsStore();
const $leadminerStore = useLeadminerStore();

const contactsToEnrichLength = computed(() => $contactsStore.selectedLength);
const contactsToEnrichLengthPartial = ref<number>(0);

const enrichedContacts = ref(0);
const currentProgress = ref<number | undefined>();

const progressMode = computed(() =>
  $leadminerStore.activeEnrichment ? 'indeterminate' : 'determinate',
);
const progressColor = computed(() =>
  $leadminerStore.activeEnrichment ? 'bg-amber-400' : 'bg-green-600',
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
  payload: RealtimePostgresChangesPayload<EnrichmentTask>,
) => {
  const { status, details } = payload.new as EnrichmentTask;
  const { enriched } = details.result;

  switch (status) {
    case 'done':
      if (enriched) {
        enrichedContacts.value = enriched;
      }
      currentProgress.value = 100;
      $leadminerStore.activeEnrichment = false;
      break;
    default:
      break;
  }
};
</script>
<i18n lang="json">
{
  "en": {
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
