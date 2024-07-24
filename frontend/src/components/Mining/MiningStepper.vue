<template>
  <Panel v-model:collapsed="collapsePanel" class="mb-4" toggleable>
    <template #header>
      <Button
        severity="secondary"
        unstyled
        @click="collapsePanel = !collapsePanel"
      >
        <span class="font-semibold flex items-center gap-2">
          <i
            v-if="collapsePanel && activeMining"
            class="pi pi-spin pi-spinner text-lg"
          />
          {{ t('mine_contacts') }}
        </span>
      </Button>
    </template>
    <Stepper v-model:value="$stepper.index" linear>
      <StepList>
        <Step :value="1">
          <span class="hidden md:block">
            {{ t('source') }}
          </span>
        </Step>
        <Step :value="2">
          <span class="hidden md:block">
            {{ $t('common.mine') }}
          </span>
        </Step>
        <Step :value="3">
          <span class="hidden md:block">
            {{ $t('common.clean') }}
          </span>
        </Step>
        <Step :value="4">
          <span class="hidden md:block">
            {{ $t('common.enrich') }}
          </span>
        </Step>
      </StepList>
      <StepPanels>
        <StepPanel :value="1">
          <SourcePanel ref="sourcePanel" />
        </StepPanel>
        <StepPanel :value="2">
          <MinePanel :mining-source="$leadminerStore.activeMiningSource!" />
        </StepPanel>
        <StepPanel :value="3">
          <CleanPanel />
        </StepPanel>
        <StepPanel :value="4">
          <EnrichPanel />
        </StepPanel>
      </StepPanels>
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
const activeMining = computed(() => $leadminerStore.miningTask !== undefined);

const { collapsed } = defineProps<{
  collapsed: boolean;
}>();

const sourcePanel = ref<InstanceType<typeof SourcePanel>>();
const collapsePanel = ref(collapsed);
const { error, provider, source } = $route.query;

onMounted(() => {
  useRouter().replace({ query: {} });
  if (source) {
    collapsePanel.value = false;
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
    "source": "Source"
  },
  "fr": {
    "mine_contacts": "Extraire des contacts de votre compte email",
    "source": "Source"
  }
}
</i18n>
