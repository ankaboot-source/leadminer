<template>
  <AppLayout>
    <div class="col">
      <q-card flat class="q-px-md bg-banner-color">
        <div class="row justify-around">
          <div class="col text-center self-center q-py-lg">
            <div class="row justify-center q-pb-lg">
              <div class="col-8 text-h6 text-weight-medium">
                Discover hidden gems in your social network
              </div>
            </div>
            <SettingsDialog
              ref="settingsDialogRef"
              :total-emails="totalEmails"
              :is-loading-boxes="isLoadingBoxes"
              @get-boxes="getBoxes"
            />
            <div class="row justify-center">
              <q-btn
                v-if="!activeMiningTask"
                :disable="activeMiningTask || isLoadingStartMining"
                color="amber-13"
                label="Start mining now!"
                no-caps
                unelevated
                icon-right="mail"
                :loading="isLoadingStartMining"
                size="lg"
                class="text-black shadow-7 q-mr-none"
                style="border: 2px solid black !important"
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
                color="amber-13"
                label="Halt mining"
                no-caps
                unelevated
                icon-right="stop"
                :loading="isLoadingStartMining"
                size="lg"
                class="text-black shadow-7 q-mr-none"
                style="border: 2px solid black !important"
                @click="stopMining"
              />
              <q-btn
                icon="more_vert"
                flat
                round
                dense
                size="lg"
                @click="openDialog"
              >
                <q-tooltip> Advanced options </q-tooltip>
              </q-btn>
            </div>
          </div>
          <div class="col-6 self-center gt-sm">
            <q-img
              :src="imgUrl"
              spinner-color="amber"
              fit="contain"
              height="10vw"
            />
          </div>
        </div>

        <div class="bg-transparent col q-pb-lg">
          <ProgressCard
            v-if="boxes"
            :scanned-emails="scannedEmails"
            :extracted-emails="extractedEmails"
            :total-emails="totalEmails"
          />
        </div>
      </q-card>
    </div>
    <MinedPersons />
  </AppLayout>
</template>

<script lang="ts" setup>
// @ts-expect-error "No type definitions"
import objectScan from "object-scan";
import { AxiosError } from "axios";
import { useQuasar } from "quasar";
import SettingsDialog from "src/components/Dialogs/SettingsDialog.vue";
import MinedPersons from "src/components/MinedPersons.vue";
import ProgressCard from "src/components/cards/ProgressCard.vue";
import { supabase } from "src/helpers/supabase";
import AppLayout from "src/layouts/AppLayout.vue";
import { useLeadminerStore } from "src/store/leadminer";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

const leadminerStore = useLeadminerStore();
const $quasar = useQuasar();
const $router = useRouter();

const settingsDialogRef = ref<InstanceType<typeof SettingsDialog>>();

const imgUrl = process.env.BANNER_IMAGE_URL;

const isLoadingStartMining = ref(false);
const isLoadingStopMining = ref(false);
const isLoadingBoxes = ref(false);

async function getBoxes() {
  try {
    isLoadingBoxes.value = true;
    isLoadingStartMining.value = true;
    await leadminerStore.getBoxes();

    $quasar.notify({
      message: leadminerStore.infoMessage,
      color: "positive",
      icon: "check",
    });
  } catch (_) {
    $quasar.notify({
      message: leadminerStore.errorMessage,
      color: "negative",
      icon: "error",
      timeout: 10000,
    });
  } finally {
    isLoadingBoxes.value = false;
    isLoadingStartMining.value = false;
  }
}

onMounted(async () => {
  settingsDialogRef.value?.open();
  await leadminerStore.getMiningSources();
  if (leadminerStore.activeMiningSource) {
    await getBoxes();
  }
});

const boxes = computed(() => leadminerStore.boxes);
const selectedBoxes = computed<string[]>(() => leadminerStore.selectedBoxes);
const activeMiningTask = computed(
  () => leadminerStore.miningTask !== undefined
);
const scannedEmails = computed(() => leadminerStore.scannedEmails);
const extractedEmails = computed(() => leadminerStore.extractedEmails);
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

function openDialog() {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  settingsDialogRef.value!.open();
}

async function stopMining() {
  isLoadingStopMining.value = true;
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
    isLoadingStopMining.value = false;
  }
}

// eslint-disable-next-line consistent-return
async function startMining() {
  isLoadingStartMining.value = true;
  if (selectedBoxes.value.length === 0) {
    isLoadingStartMining.value = false;
    $quasar.notify({
      message: "Select at least one folder",
      color: "warning",
      icon: "error",
    });
    return;
  }
  try {
    await leadminerStore.startMining();
    $quasar.notify({
      message: leadminerStore.infoMessage,
      color: "positive",
      icon: "check",
    });
  } catch (error) {
    const provider = leadminerStore.activeMiningSource?.type;

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
    isLoadingStartMining.value = false;
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
