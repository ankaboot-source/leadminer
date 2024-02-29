<template>
  <div class="q-pb-sm">
    <q-stepper
      ref="stepper"
      v-model="step"
      active-color="secondary"
      done-color="secondary"
      class="bg-banner-color"
      animated
      :contracted="stepperContractedHeader"
      @update:model-value="handleNavigation"
    >
      <q-step
        :name="1"
        title="Select source"
        icon="manage_accounts"
        active-icon="manage_accounts"
        :done="step > 1"
      >
        <div class="text-body1">Pick a source of contacts to mine</div>
        <q-select
          v-model="sourceModel"
          class="q-pt-sm"
          option-value="email"
          option-label="email"
          outlined
          unelevated
          use-chips
          stack-label
          :options="sourceOptions"
          label="Linked Emails"
        />
        <q-stepper-navigation class="text-right">
          <q-btn
            outline
            color="secondary"
            no-caps
            label="Add a new email account"
            @click="stepper.next()"
          />
          <q-btn
            class="text-black q-ml-sm"
            unelevated
            color="amber-13"
            no-caps
            label="Continue with this email account"
            @click="stepper.goTo(3)"
          />
        </q-stepper-navigation>
      </q-step>

      <q-step
        :name="2"
        title="Add a new source"
        caption="Optional"
        icon="login"
        active-icon="login"
        :done="step > 2"
      >
        <div class="text-center text-body1">Select Your Email Provider</div>
        <div class="flex row flex-center q-gutter-md q-mt-sm">
          <oauth-source
            icon="img:icons/google.png"
            label="Google"
            source="google"
          />
          <oauth-source
            icon="img:icons/microsoft.png"
            label="Microsoft or Outlook"
            source="azure"
          />
          <imap-source />
        </div>
        <q-stepper-navigation class="text-right">
          <q-btn
            v-if="step > 1"
            flat
            color="secondary"
            no-caps
            label="Back"
            @click="stepper.previous()"
          />
          <q-btn
            class="text-black q-ml-xs"
            unelevated
            color="amber-13"
            no-caps
            label="Continue"
            @click="stepper.next()"
          />
        </q-stepper-navigation>
      </q-step>

      <q-step :name="3" title="Start mining" icon="bolt" active-icon="done">
        <div class="text-center text-h6 text-bold q-pb-md">
          Discover hidden gems in your social network
        </div>
        <div class="bg-transparent q-pb-lg">
          <ProgressCard v-if="boxes" :total-emails="totalEmails" />
        </div>
        <mining-settings
          ref="miningSettingsRef"
          :total-emails="totalEmails"
          :is-loading-boxes="leadminerStore.isLoadingBoxes"
          @get-boxes="getBoxes"
        />
        <q-stepper-navigation class="text-right">
          <q-btn
            v-if="!activeMiningTask && !leadminerStore.isLoadingBoxes"
            flat
            color="secondary"
            no-caps
            label="Back"
            @click="stepper.goTo(1)"
          />
          <q-btn
            v-if="!activeMiningTask"
            no-caps
            outline
            label="Fine tune mining"
            @click="openMiningSettings"
          >
            <q-tooltip> Tailor your mining pereferences </q-tooltip>
          </q-btn>
          <q-btn
            v-if="!activeMiningTask"
            :disable="activeMiningTask || leadminerStore.isLoadingStartMining"
            :loading="leadminerStore.isLoadingStartMining"
            no-caps
            unelevated
            color="amber-13"
            class="text-black q-ml-sm"
            icon-right="img:icons/pickaxe.svg"
            style="border: 2px solid black !important"
            label="Start mining now!"
            @click="startMining"
          >
            <template #loading>
              Start mining now!
              <q-spinner class="on-right" />
              <q-tooltip> Retrieving mailboxes... </q-tooltip>
            </template>
          </q-btn>
          <q-btn
            v-else
            :loading="leadminerStore.isLoadingStartMining"
            no-caps
            unelevated
            class="text-black"
            color="amber-13"
            icon-right="stop"
            style="border: 2px solid black !important"
            label="Halt mining"
            @click="stopMining"
          />
        </q-stepper-navigation>
      </q-step>
    </q-stepper>
  </div>
  <credits-dialog
    ref="CreditsDialogRef"
    engagement-type="messages"
    action-type="mine"
    @secondary-action="startMining"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import CreditsDialog from "src/components/Credits/InsufficientCreditsDialog.vue";
import MiningSettings from "src/components/Mining/MiningSettings.vue";
import ProgressCard from "src/components/Mining/MiningProgress.vue";
import OauthSource from "src/components/Mining/AddSourceOauth.vue";
import ImapSource from "src/components/Mining/AddSourceImap.vue";
import { useLeadminerStore } from "src/stores/leadminer";
import { supabase } from "src/helpers/supabase";
import { MiningSource } from "src/types/mining";
import { useRouter } from "vue-router";
import { AxiosError } from "axios";
// @ts-expect-error "No type definitions"
import objectScan from "object-scan";
import { useQuasar } from "quasar";

const $quasar = useQuasar();
const $router = useRouter();
const leadminerStore = useLeadminerStore();

const step = ref(1);
const stepper = ref();
const stepperContractedHeader = ref(false);

const sourceModel = ref<MiningSource>();
const sourceOptions = computed(() => leadminerStore.miningSources);

const miningSettingsRef = ref<InstanceType<typeof MiningSettings>>();
const CreditsDialogRef = ref<InstanceType<typeof CreditsDialog>>();

const activeMining = computed(() =>
  Boolean(
    leadminerStore.miningTask ||
      leadminerStore.isLoadingBoxes ||
      leadminerStore.isLoadingStartMining ||
      leadminerStore.isLoadingStopMining
  )
);

onMounted(async () => {
  try {
    await leadminerStore.getMiningSources();

    const user = (await supabase.auth.getSession()).data.session?.user;
    const { miningSources } = leadminerStore;

    step.value = miningSources.length ? (activeMining.value ? 3 : 1) : 2;
    sourceModel.value = miningSources.find(
      ({ email }) => user && email === user.email
    );
  } catch (err) {
    $quasar.notify({
      message: leadminerStore.errorMessage,
      color: "negative",
      icon: "error",
    });
  }
});

async function getBoxes() {
  try {
    leadminerStore.isLoadingBoxes = true;
    leadminerStore.isLoadingStartMining = true;
    await leadminerStore.getBoxes();
  } catch (_) {
    $quasar.notify({
      message: leadminerStore.errorMessage,
      color: "negative",
      icon: "error",
      timeout: 10000,
    });
  } finally {
    leadminerStore.isLoadingBoxes = false;
    leadminerStore.isLoadingStartMining = false;
  }
}

watch(sourceModel, (selectedSource) => {
  leadminerStore.boxes = [];
  leadminerStore.selectedBoxes = [];
  leadminerStore.activeMiningSource = selectedSource;
});

const boxes = computed(() => leadminerStore.boxes);
const selectedBoxes = computed<string[]>(() => leadminerStore.selectedBoxes);
const activeMiningTask = computed(
  () => leadminerStore.miningTask !== undefined
);

const totalEmails = computed<number>(() => {
  if (boxes.value[0]) {
    return objectScan(["**.{total}"], {
      joined: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filterFn: ({ parent, property, value, context }: any) => {
        if (
          property === "total" &&
          parent.path &&
          selectedBoxes.value.includes(parent.path)
        ) {
          context.sum += value;
        }
      },
    })(boxes.value, { sum: 0 }).sum;
  }
  return 0;
});

function openMiningSettings() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  miningSettingsRef.value!.open();
}

async function handleNavigation(value: number | string) {
  if (value === 3 && !activeMining.value && !leadminerStore.boxes.length) {
    await getBoxes();
  }
}

async function stopMining() {
  leadminerStore.isLoadingStopMining = true;
  try {
    await leadminerStore.stopMining();
    $quasar.notify({
      message: leadminerStore.infoMessage,
      color: "positive",
      icon: "check",
    });
  } catch (error) {
    $quasar.notify({
      message: leadminerStore.errorMessage,
      color: "negative",
      icon: "error",
    });
  } finally {
    leadminerStore.isLoadingStopMining = false;
    stepperContractedHeader.value = false;
  }
}

// eslint-disable-next-line consistent-return
async function startMining() {
  if (selectedBoxes.value.length === 0) {
    openMiningSettings();
    $quasar.notify({
      message: "Please select at least one folder to start mining.",
      color: "warning",
      icon: "error",
    });
    return;
  }
  leadminerStore.isLoadingStartMining = true;
  try {
    await leadminerStore.startMining();
    await leadminerStore.syncUserCredits();
    $quasar.notify({
      message: leadminerStore.infoMessage,
      color: "positive",
      icon: "check",
    });
  } catch (error) {
    const provider = leadminerStore.activeMiningSource?.type;

    if (error instanceof AxiosError && error.response?.status === 402) {
      const { total: totalMessages, available: availableMessages } =
        error.response.data;

      CreditsDialogRef.value?.openModal(totalMessages, availableMessages);
      return;
    }

    if (
      error instanceof AxiosError &&
      error.response?.status === 401 &&
      provider &&
      ["google", "azure"].includes(provider)
    ) {
      const { data: sessionData } = await supabase.auth.getSession();
      const referrer = sessionData.session?.user.id;
      $router.push(
        `/oauth-consent-error?provider=${provider}&referrer=${referrer}`
      );
    } else {
      $quasar.notify({
        message: leadminerStore.errorMessage,
        color: "negative",
        icon: "error",
      });
    }
  } finally {
    leadminerStore.isLoadingStartMining = false;
    stepperContractedHeader.value = true;
  }
}
</script>
<style>
.q-dialog__inner--minimized > div {
  max-width: 1000px;
}

.bg-banner-color {
  background: linear-gradient(
    135deg,
    rgba(255, 230, 149, 0.5) 0%,
    rgba(255, 248, 225, 0.5) 100%
  );
}
</style>
