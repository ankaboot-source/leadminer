<template>
  <Stepper v-model:value="$stepper.index" linear class="flex flex-col grow">
    <StepList>
      <Step v-slot="{ active, value }" as-child :value="1">
        <StepWithPopover
          :step-number="Number(value)"
          :is-active="active"
          :title="t('source')"
        />
      </Step>
      <Step v-slot="{ active, value }" as-child :value="2">
        <StepWithPopover
          :step-number="Number(value)"
          :is-active="active"
          :title="$t('common.mine')"
        />
      </Step>
      <Step v-slot="{ active, value }" as-child :value="3">
        <StepWithPopover
          :step-number="Number(value)"
          :is-active="active"
          :title="$t('common.clean')"
        />
      </Step>
    </StepList>

    <StepPanels class="flex flex-col grow">
      <StepPanel v-slot="{ active }" :value="1" class="flex grow">
        <SourcePanel v-if="active" ref="sourcePanel" />
      </StepPanel>
      <StepPanel v-slot="{ active }" :value="2">
        <MinePanel
          v-if="active"
          :mining-source="$leadminerStore.activeMiningSource!"
        />
      </StepPanel>
      <StepPanel v-slot="{ active }" :value="3">
        <CleanPanel v-if="active" />
      </StepPanel>
    </StepPanels>
  </Stepper>

  <MiningConsentSidebar
    v-model:show="$consentSidebar.status"
    v-model:provider="$consentSidebar.provider"
    v-model:authorize-redirect="$consentSidebar.authorizedRedirect"
  />
  <ImportPstDialog ref="importPstDialogRef" />
</template>

<script setup lang="ts">
import type { MiningSourceType } from '~/types/mining';
import {
  resolvePostOauthSourceSelection,
  shouldInitializeStepperToSourceStep,
} from '@/utils/mining-oauth-redirect';
import MiningConsentSidebar from './MiningConsentSidebar.vue';
import CleanPanel from './stepper-panels/clean/CleanPanel.vue';
import MinePanel from './stepper-panels/mine/MinePanel.vue';
import ImportPstDialog from './stepper-panels/source/ImportPstDialog.vue';
import SourcePanel from './stepper-panels/source/SourcePanel.vue';
import StepWithPopover from './stepper-panels/StepWithPopover.vue';

const { t } = useI18n({
  useScope: 'local',
});

const $route = useRoute();
const $router = useRouter();
const $stepper = useMiningStepper();
const $consentSidebar = useMiningConsentSidebar();
const $leadminerStore = useLeadminerStore();

const importPstDialogRef = ref();

const provider = computed(() => {
  const providerValue = $route.query.provider;
  return typeof providerValue === 'string' ? providerValue : undefined;
});

const error = computed(() => {
  const errorValue = $route.query.error;
  return typeof errorValue === 'string' ? errorValue : undefined;
});

const source = computed(() => {
  const sourceValue = $route.query.source;
  return typeof sourceValue === 'string' ? sourceValue : undefined;
});

const handledSourceQuery = ref<string | null>(null);

function clearOauthQueryParams() {
  const {
    provider: _provider,
    error: _error,
    source: _source,
    ...query
  } = $route.query;

  $router.replace({ query: Object.keys(query).length ? query : undefined });
}

watch(
  [
    source,
    () => $leadminerStore.miningSources,
    () => $leadminerStore.isLoadingMiningSources,
  ],
  ([sourceEmail, miningSources, isLoadingMiningSources]) => {
    if (
      shouldInitializeStepperToSourceStep({
        querySource: sourceEmail,
        currentStep: $stepper.index,
      })
    ) {
      $stepper.go(1);
      return;
    }

    if ($stepper.index !== -1) {
      return;
    }

    if ($stepper.isInitializing) {
      return;
    }

    if (!sourceEmail) {
      return;
    }

    if (handledSourceQuery.value === sourceEmail) {
      return;
    }

    handledSourceQuery.value = sourceEmail;

    const resolution = resolvePostOauthSourceSelection({
      querySource: sourceEmail,
      miningSources,
      isLoadingMiningSources,
    });

    if (resolution.status === 'wait') {
      return;
    }

    if (resolution.status === 'select') {
      $leadminerStore.boxes = [];
      $leadminerStore.selectedBoxes = [];
      $leadminerStore.activeMiningSource = resolution.source;
      $stepper.go(2);
    } else {
      $stepper.go(1);
    }

    clearOauthQueryParams();
  },
  { immediate: true },
);

onNuxtReady(() => {
  if (provider.value && error.value === 'oauth-consent') {
    $consentSidebar.show(
      provider.value as MiningSourceType,
      undefined,
      '/mine',
    );
    if (provider.value === 'azure') importPstDialogRef.value.openModal();
    clearOauthQueryParams();
  }
});
</script>

<i18n lang="json">
{
  "en": {
    "source": "Source",
    "mining": "Mining",
    "cleaning": "Cleaning"
  },
  "fr": {
    "source": "Source",
    "mining": "Extraction",
    "cleaning": "Nettoyage"
  }
}
</i18n>
