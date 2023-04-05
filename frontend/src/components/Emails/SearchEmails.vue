<template>
  <div class="row q-col-gutter-sm">
    <div class="col">
      <div class="row q-pt-lg">
        <q-card flat bordered class="q-pa-md">
          <div class="row">
            <div>
              <q-btn
                :disable="activeMiningTask"
                :color="activeMiningTask ? 'grey-6' : 'teal'"
                label="Get To Mining!"
                no-caps
                unelevated
                :loading="!(boxes.length > 0)"
                size="lg"
                @click="startMining"
              >
                <template #loading>
                  <q-spinner-box class="on-left" />
                  Loading...
                  <q-tooltip class="text-body2 bg-teal-1 text-teal-8 bordered">
                    Retrieving mailboxes...
                  </q-tooltip>
                </template>
              </q-btn>
              <q-btn
                :disable="!activeMiningTask"
                :color="activeMiningTask ? 'red' : 'grey-6'"
                label="Have a rest"
                no-caps
                outline
                class="q-ma-md"
                @click="stopMining"
              />
              <br />
              <a
                label="Advanced options"
                :disable="activeMiningTask"
                class="cursor-pointer q-hoverable text-teal-6"
                style="text-decoration: underline"
                @click="mailbox = true"
              >
                Advanced options
              </a>
            </div>
          </div>
          <div
            v-show="mailbox"
            role="dialog"
            aria-modal="true"
            class="q-dialog fullscreen no-pointer-events q-dialog--modal"
          >
            <div
              class="q-dialog__backdrop fixed-full"
              aria-hidden="true"
              tabindex="-1"
              @click="mailbox = false"
            ></div>
            <div
              class="q-dialog__inner flex no-pointer-events q-dialog__inner--minimized q-dialog__inner--standard fixed-full flex-center"
              tabindex="-1"
            >
              <q-card class="bg-grey-2 border">
                <q-card-section class="row items-center q-pb-none">
                  <div class="text-h6">Select mailbox folders</div>
                  <q-btn
                    outline
                    round
                    size="sm"
                    color="orange-5"
                    icon="refresh"
                    class="q-ml-sm"
                    :disable="activeMiningTask"
                    @click="getBoxes"
                  />
                  <q-space />
                  <q-btn
                    icon="close"
                    flat
                    round
                    dense
                    @click="mailbox = false"
                  />
                </q-card-section>
                <q-card-section class="q-pa-lg">
                  <TreeCard
                    v-if="boxes.length > 0"
                    :boxes="boxes"
                    :scanned-boxes="scannedBoxes"
                    :class="{ disabled: activeMiningTask }"
                    @selected-boxes="updateSelectedBoxes"
                  />
                  <q-spinner-tail v-else color="teal" size="4em" />
                </q-card-section>
              </q-card>
            </div>
          </div>
        </q-card>
      </div>
      <div class="bg-transparent col q-py-lg">
        <ProgressCard
          v-if="boxes"
          :mined-emails="minedEmails"
          :scanned-emails="scannedEmails"
          :extracted-emails="extractedEmails"
          :total-emails="totalEmails"
        />
      </div>
      <MinedPersons />
    </div>
  </div>
</template>

<script setup>
import objectScan from "object-scan";
import { LocalStorage, useQuasar } from "quasar";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import ProgressCard from "../cards/ProgressCard.vue";
import TreeCard from "../cards/TreeCard.vue";
import MinedPersons from "../MinedPersons.vue";

const selectedBoxes = ref([]);

const $q = useQuasar();
const $store = useStore();
const $router = useRouter();
const mailbox = ref(false);
onMounted(async () => {
  window.addEventListener("keydown", onKeyDown);

  const googleUser = LocalStorage.getItem("googleUser");
  const imapUser = LocalStorage.getItem("imapUser");

  if (!googleUser && !imapUser) {
    return $router.push("/");
  }

  if (googleUser) {
    $store.commit("example/SET_GOOGLE_USER", googleUser);
  } else if (imapUser) {
    $store.commit("example/SET_IMAP", imapUser);
  }

  await getBoxes();
});

const onKeyDown = (event) => {
  if (event.key === "Escape" && mailbox.value) {
    mailbox.value = false;
  }
};

const boxes = computed(() => $store.state.example.boxes);

const scannedBoxes = computed(() => $store.state.example.progress.scannedBoxes);
const minedEmails = computed(
  () => $store.getters["example/getRetrievedEmails"].length
);
const activeMiningTask = computed(() =>
  $store.state.example.miningTask.miningId ? true : false
);
const scannedEmails = computed(
  () => $store.state.example.progress.scannedEmails
);
const extractedEmails = computed(
  () => $store.state.example.progress.extractedEmails
);

const totalEmails = computed(() => {
  if (boxes.value[0]) {
    return objectScan(["**.{total}"], {
      joined: true,
      filterFn: ({ parent, property, value, context }) => {
        if (
          property == "total" &&
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

function updateSelectedBoxes(val) {
  $store.commit("example/SET_SCANNEDEMAILS", 0);
  $store.commit("example/SET_EXTRACTEDEMAILS", 0);
  selectedBoxes.value = val;
}

function showNotification(msg, color, icon) {
  $q.notify({
    message: msg,
    color: color,
    icon: icon,
    actions: [
      {
        label: "ok",
        color: "white",
      },
    ],
  });
}

async function stopMining() {
  const miningId = $store.state.example.miningTask.miningId;
  try {
    await $store.dispatch("example/stopMining", { data: { miningId } });
    showNotification($store.state.example.infoMessage, "green", "");
  } catch (error) {
    showNotification($store.state.example.errorMessage, "red", "error");
  }
}

async function startMining() {
  if (selectedBoxes.value.length === 0) {
    return showNotification(
      "Select at least one folder",
      "orange-5",
      "warning"
    );
  }

  try {
    await $store.dispatch("example/startMining", {
      data: { boxes: selectedBoxes.value },
    });
    showNotification($store.state.example.infoMessage, "green", "");
  } catch (error) {
    showNotification($store.state.example.errorMessage, "red", "error");
  }
}

async function getBoxes() {
  try {
    await $store.dispatch("example/getBoxes");
    console.log($store.state.example.infoMessage);
  } catch (_) {
    LocalStorage.clear();
    $router.replace("/");
  }
}
</script>
<style>
.q-tree.disabled {
  pointer-events: none;
}
</style>
