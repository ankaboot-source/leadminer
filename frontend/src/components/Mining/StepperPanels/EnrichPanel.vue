<template>
  <div class="flex justify-between items-center">
    <div id="progress-title">
      <span class="pr-1"> {{ $contactStore.filtered.length }} </span>
      {{ t('text.contacts_to_enrich') }}
    </div>
    <div id="progress-time">
      <span v-if="activeTask" class="pr-1">
        {{ t('text.estimated_time') }}
      </span>
    </div>
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
      @click="activeTask = !activeTask"
    />
    <Button
      v-else
      class="w-full md:w-max"
      severity="secondary"
      :label="t('button.start_new_mining')"
      @click="startNewMining"
    />
  </div>
</template>
<script setup lang="ts">
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

type EnrichContactResponse = {
  taskId: string;
  userId?: string;
  webhookSecretToken?: string;
  total?: string;
  alreadyEnriched?: boolean;
};

interface EnrichmentTask {
  id: string;
  status: 'running' | 'done' | 'canceled';
  details: {
    userId: string;
    webhookSecretToken: string;
    result: {
      total: number;
      enriched: number;
    };
  };
}

const { t } = useI18n({
  useScope: 'local',
});

const { $api } = useNuxtApp();

const $toast = useToast();
const $stepper = useMiningStepper();
const $contactStore = useContactsStore();
const $leadminerStore = useLeadminerStore();

const activeTask = ref(true);
const currentProgress = ref<number | undefined>();
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

function startEnrichmentRealtimeListener() {
  return useSupabaseClient()
    .channel('enrichement-tracker-bulk')
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
              t('notification.enrichment_started', { total })
            );
            break;

          case 'done':
            if (enriched) {
              showNotification(
                'success',
                t('notification.summary'),
                t('notification.enrichment_completed', { total, enriched })
              );
            } else {
              showNotification(
                'info',
                t('notification.summary'),
                t('notification.no_additional_info')
              );
            }
            activeTask.value = false;
            currentProgress.value = 100;
            break;

          case 'canceled':
            showNotification(
              'error',
              t('notification.summary'),
              t('notification.enrichment_canceled')
            );
            activeTask.value = false;
            break;

          default:
            break;
        }
      }
    );
}

async function startEnrichment() {
  const { alreadyEnriched } = await $api<EnrichContactResponse>(
    '/enrichement/enrichAsync',
    {
      method: 'POST',
      body: {
        emails: $contactStore.filtered.map((contact) => contact.email),
      },
    }
  );

  if (alreadyEnriched) {
    activeTask.value = false;
    showNotification(
      'info',
      t('notification.summary'),
      t('notification.already_enriched')
    );
  }
}

onMounted(async () => {
  subscription = startEnrichmentRealtimeListener();
  subscription.subscribe();
  await startEnrichment();
});

onUnmounted(() => {
  if (subscription) {
    subscription.unsubscribe();
  }
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
      "estimated_time": "This process may take a while, hang tight!",
      "contacts_to_enrich": "contacts to enrich"
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
      "estimated_time": "Ce processus peut prendre un certain temps, accrochez-vous !",
      "contacts_to_enrich": "contacts à enrichir"
    },
    "button": {
      "halt_enrichment": "Annuler l'enrichissement",
      "start_new_mining": "Commencer une nouvelle extraction"
    }
  }
}
</i18n>
