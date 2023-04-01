<template>
  <div class="row q-col-gutter-sm">
    <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
      <div class="row q-pa-lg">
        <q-card flat bordered class="q-mr-sm q-ma-sm">
          <div class="row q-pa-sm q-pt-md q-pl-lg">
            <div>
              <q-btn
                :disable="activeMiningTask"
                :color="activeMiningTask ? 'grey-6' : 'teal'"
                label="Get To Mining!"
                @click="startMining"
                no-caps
                unelevated
              />
              <q-btn
                :disable="!activeMiningTask"
                :color="activeMiningTask ? 'red' : 'grey-6'"
                label="Have a rest"
                @click="stopMining"
                no-caps
                outline
                class="q-ma-md"
              />
              <br />
              <a
                label="Advanced options"
                @click="mailbox = true"
                :disable="activeMiningTask"
                class="cursor-pointer q-hoverable text-teal-6"
                style="text-decoration: underline"
              >
                Advanced options
              </a>
            </div>
          </div>
          <q-dialog v-model="mailbox">
            <div class="bg-grey-2 border q-pa-lg">
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
                default-expand-all
              />
              <q-spinner-tail v-else color="teal" size="4em" />
            </div>
          </q-dialog>
        </q-card>
        <div class="bg-transparent col q-ma-sm">
          <ProgressCard
            v-if="boxes"
            :mined-emails="minedEmails"
            :scanned-emails="scannedEmails"
            :extracted-emails="extractedEmails"
            :total-emails="totalEmails"
          />
        </div>
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
