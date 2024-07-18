<template>
  <Panel class="mb-4" toggleable :collapsed="collapsePanel">
    <template #header>
      <Button
        severity="secondary"
        unstyled
        @click="collapsePanel = !collapsePanel"
      >
        <span class="font-semibold">
          {{ t('mine_contacts') }}
        </span>
      </Button>
    </template>
    <Stepper
      v-model:active-step="$stepper.index"
      linear
      pt:stepperpanel:header:class="pointer-events-auto md:pointer-events-none"
    >
      <StepperPanel>
        <template #header>
          <button class="p-stepper-action cursor-default">
            <span
              v-tooltip.top="t('source')"
              class="p-stepper-number pointer-events-auto md:pointer-events-none"
              >1</span
            >
            <span class="p-stepper-title hidden md:block">
              {{ t('source') }}
            </span>
          </button>
        </template>
        <SourcePanel ref="sourcePanel" />
      </StepperPanel>

      <StepperPanel>
        <template #header>
          <button class="p-stepper-action cursor-default">
            <span
              v-tooltip.top="t('mine')"
              class="p-stepper-number pointer-events-auto md:pointer-events-none"
              >2</span
            >
            <span class="p-stepper-title hidden md:block">
              {{ t('mine') }}
            </span>
          </button>
        </template>
        <MinePanel :mining-source="$leadminerStore.activeMiningSource!" />
      </StepperPanel>
      <StepperPanel>
        <template #header>
          <button class="p-stepper-action cursor-default">
            <span
              v-tooltip.top="t('clean')"
              class="p-stepper-number pointer-events-auto md:pointer-events-none"
              >3</span
            >
            <span class="p-stepper-title hidden md:block">
              {{ t('clean') }}
            </span>
          </button>
        </template>
        <CleanPanel />
      </StepperPanel>
      <StepperPanel>
        <template #header>
          <button class="p-stepper-action cursor-default">
            <span
              v-tooltip.top="t('enrich')"
              class="p-stepper-number pointer-events-auto md:pointer-events-none"
              >4</span
            >
            <span class="p-stepper-title hidden md:block">
              {{ t('enrich') }}
            </span>
          </button>
        </template>
        <EnrichPanel />
      </StepperPanel>
    </Stepper>
  </Panel>
  <MiningConsentSidebar
    v-model:show="$consentSidebar.status"
    v-model:provider="$consentSidebar.provider"
  />
</template>

<script setup lang="ts">
import MiningConsentSidebar from '@/components/Mining/MiningConsentSidebar.vue';
import CleanPanel from '@/components/Mining/StepperPanels/CleanPanel.vue';
import EnrichPanel from '@/components/Mining/StepperPanels/EnrichPanel.vue';
import MinePanel from '@/components/Mining/StepperPanels/MinePanel.vue';
import SourcePanel from '@/components/Mining/StepperPanels/SourcePanel.vue';
import type { MiningSourceType } from '~/types/mining';

const { t } = useI18n({
  useScope: 'local',
});

const $route = useRoute();
const $stepper = useMiningStepper();
const $consentSidebar = useMiningConsentSidebar();
const $leadminerStore = useLeadminerStore();

const { collapsed } = defineProps<{
  collapsed: boolean;
}>();

const sourcePanel = ref<InstanceType<typeof SourcePanel>>();
const collapsePanel = ref(collapsed);

const { error, provider, source } = $route.query;

onMounted(() => {
  useRouter().replace({ query: {} });

  if (source) {
    sourcePanel.value?.selectSource(source as string);
  } else if (error === 'oauth-consent') {
    $consentSidebar.show(provider as MiningSourceType);
  }
});
</script>

<i18n lang="json">
{
  "en": {
    "mine_contacts": "Mine contacts from your email account",
    "source": "Source",
    "mine": "Mine",
    "clean": "Clean",
    "enrich": "Enrich"
  },
  "fr": {
    "mine_contacts": "Extraire des contacts de votre compte email",
    "source": "Source",
    "mine": "Extraire",
    "clean": "Clean",
    "enrich": "Enrichir"
  }
}
</i18n>
