<template>
  <CreditsDialog
    ref="CreditsDialogRef"
    engagement-type="contacts"
    action-type="enrich"
    @secondary-action="startEnrichment(true)"
  />
  <div class="flex justify-between items-center">
    <div id="progress-title">
      <span class="pr-1">
        {{
          activeTask
            ? contactsToEnrichLength.toLocaleString()
            : enrichedContacts.toLocaleString()
        }}
      </span>
      {{
        activeTask ? t('text.contacts_to_enrich') : t('text.contacts_enriched')
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
      v-if="activeTask"
      class="w-full md:w-max border-solid border-2 border-black"
      severity="contrast"
      icon="pi pi-stop"
      icon-pos="right"
      :label="t('button.halt_enrichment')"
      @click="stopEnrichment"
    />
    <div v-else>
      <Button
        class="w-full md:w-max"
        severity="secondary"
        :label="t('button.start_new_mining')"
        @click="startNewMining"
      />
      <Button
        class="w-full md:w-max border-solid border-2 border-black"
        severity="contrast"
        icon-pos="right"
        :label="t('button.start_enrichment')"
        @click="startEnrichment(false)"
      >
        <template #icon>
          <span class="p-button-icon p-button-icon-right">💎</span>
        </template>
      </Button>
    </div>
  </div>
</template>
<script setup lang="ts">
import {
  RealtimeChannel,
  type RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import CreditsDialog from '@/components/Credits/InsufficientCreditsDialog.vue';
import {
  type EnrichmentTask,
  type EnrichContactResponse,
} from '@/types/enrichment';

const { t } = useI18n({
  useScope: 'local',
});

const { $api } = useNuxtApp();

const $toast = useToast();
const $stepper = useMiningStepper();
const $contactStore = useContactsStore();
const $leadminerStore = useLeadminerStore();

const activeTask = ref(true);
const contactsToEnrich = ref<string[]>(
  $contactStore.filtered.map((contact) => contact.email)
);
const contactsToEnrichLength = ref<number>(contactsToEnrich.value.length);
const enrichedContacts = ref(0);
const currentProgress = ref<number | undefined>();
const CreditsDialogRef = ref<InstanceType<typeof CreditsDialog>>();

const progressMode = computed(() =>
  activeTask.value ? 'indeterminate' : 'determinate'
);
const progressColor = computed(() =>
  activeTask.value ? 'bg-amber-400' : 'bg-green-600'
);

function startNewMining() {
  $leadminerStore.$resetMining();
  $stepper.go(0);
}

function showNotification(
  severity: 'info' | 'warn' | 'error' | 'success' | 'secondary' | 'contrast',
  summary: string,
  detail: string
) {
  $toast.add({
    severity,
    summary,
    detail,
    life: 5000,
  });
}

let subscription: RealtimeChannel;

function stopEnrichment() {
  if (subscription) {
    subscription.unsubscribe();
  }
  activeTask.value = false;
  $leadminerStore.activeEnrichment = false;
}

function setupEnrichmentRealtime() {
  subscription = useSupabaseClient()
    .channel('enrichement-tracker')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'tasks',
        filter: `category=eq.${'enriching'}`,
      },
      (payload: RealtimePostgresChangesPayload<EnrichmentTask>) => {
        const { status, details } = payload.new as EnrichmentTask;
        const { total, enriched } = details.result;

        switch (status) {
          case 'running':
            showNotification(
              'success',
              t('notification.summary'),
              t('notification.enrichment_started', {
                total: total.toLocaleString(),
              })
            );
            break;

          case 'done':
            if (enriched) {
              showNotification(
                'success',
                t('notification.summary'),
                t('notification.enrichment_completed', {
                  total: total.toLocaleString(),
                  enriched: enriched.toLocaleString(),
                })
              );
              enrichedContacts.value = enriched;
            } else {
              showNotification(
                'info',
                t('notification.summary'),
                t('notification.no_additional_info')
              );
            }
            currentProgress.value = 100;
            stopEnrichment();
            break;

          case 'canceled':
            showNotification(
              'error',
              t('notification.summary'),
              t('notification.enrichment_canceled')
            );
            stopEnrichment();
            break;

          default:
            break;
        }
      }
    );
  subscription.subscribe();
}

async function startEnrichment(partial: boolean) {
  try {
    activeTask.value = true;
    $leadminerStore.activeEnrichment = true;
    setupEnrichmentRealtime();
    await $api<EnrichContactResponse>('/enrichement/enrichAsync', {
      method: 'POST',
      body: {
        partial,
        emails: contactsToEnrich.value,
      },
      onResponse({ response }) {
        const { total, available, alreadyEnriched } = response._data;

        if (alreadyEnriched && response.status === 200) {
          stopEnrichment();
          showNotification(
            'info',
            t('notification.summary'),
            t('notification.already_enriched')
          );
        }

        if (response.status === 402) {
          stopEnrichment();
          contactsToEnrichLength.value = available;
          CreditsDialogRef.value?.openModal(
            available === 0,
            total,
            available,
            0
          );
        }
      },
    });
  } catch (err) {
    stopEnrichment();
    throw err;
  }
}

onMounted(async () => {
  await startEnrichment(false);
});

onUnmounted(() => {
  stopEnrichment();
});
</script>
<i18n lang="json">
{
  "en": {
    "notification": {
      "summary": "Enrich Contact",
      "enrichment_started": "Enrichment is running for {total} contacts.",
      "enrichment_completed": "{total}/{enriched} of your contacts has been successfully enriched.",
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
      "start_enrichment": "Enrich your contacts",
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
      "start_enrichment": "Enrichissez vos contacts",
      "halt_enrichment": "Annuler l'enrichissement",
      "start_new_mining": "Commencer une nouvelle extraction"
    }
  }
}
</i18n>
