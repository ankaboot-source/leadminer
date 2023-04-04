<template>
  <div class="row q-col-gutter-sm">
    <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
      <div class="row q-pt-lg q-px-lg">
        <div class="q-mr-sm col-lg-5 col-md-5 q-ma-sm">
          <q-card flat bordered>
            <div class="row q-pa-sm">
              <div class="bg-grey-2 border q-pa-sm col-lg-12 col-md-6">
                <div class="text-bold col-lg-5 col-md-5">
                  Select mailbox folders
                  <q-btn
                    outline
                    round
                    size="sm"
                    color="orange-5"
                    icon="refresh"
                    @click="getBoxes"
                  />
                </div>
                <TreeCard
                  v-if="boxes.length > 0"
                  :boxes="boxes"
                  :scanned-boxes="scannedBoxes"
                  :class="{ disabled: activeMiningTask }"
                  @selected-boxes="updateSelectedBoxes"
                />
                <q-spinner-tail v-else color="teal" size="4em" />
              </div>
              <div class="column col-lg-8">
                <div class="col-6" />
                <div class="q-mt-md q-ml-lg col-6">
                  <q-btn
                    :disable="activeMiningTask"
                    no-caps
                    :color="activeMiningTask ? 'grey-6' : 'red'"
                    label="Start"
                    @click="startMining"
                  />
                  <q-btn
                    :disable="!activeMiningTask"
                    class="q-ma-md"
                    no-caps
                    :color="activeMiningTask ? 'red' : 'grey-6'"
                    label="Stop"
                    @click="stopMining"
                  />
                </div>
              </div>
            </div>
          </q-card>
        </div>
      </div>
      <div class="bg-transparent q-ma-sm q-pa-lg">
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

onMounted(async () => {
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
