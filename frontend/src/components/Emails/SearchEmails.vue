<template>
  <div class="row q-col-gutter-sm">
    <div class="col">
      <div class="col">
        <q-card flat class="q-px-md bg-amber-1">
          <!--style="background: linear-gradient(135deg,  rgba(255, 230, 149,0.5) 0%,rgba(255, 248, 225,0.5) 100%);"-->
          <div class="row justify-around">
            <div class="col-6 text-center self-center q-pb-md q-pt-xl">
              <div class="row justify-center q-pb-lg">
                <div class="col-8 text-h4 text-weight-medium">
                  Mine the riches of your social network and discover your
                  hidden treasures!
                </div>
              </div>
              <div class="row justify-center">
                <q-btn
                  :disable="activeMiningTask"
                  :color="activeMiningTask ? 'grey-6' : 'amber-13'"
                  label="Mine My Mailbox"
                  no-caps
                  unelevated
                  icon-right="mail"
                  :loading="!(boxes.length > 0)"
                  size="xl"
                  class="text-black shadow-7"
                  style="border: 2px solid black !important"
                  @click="startMining"
                >
                  <template #loading>
                    <q-spinner-box class="on-left" />
                    Loading...
                    <q-tooltip> Retrieving mailboxes... </q-tooltip>
                  </template>
                </q-btn>
                <q-btn
                  icon="more_vert"
                  :disable="activeMiningTask"
                  flat
                  round
                  dense
                  size="lg"
                  @click="
                    advancedOptionsShow = true;
                    scrollDisable();
                  "
                >
                  <q-tooltip> Advanced options </q-tooltip>
                </q-btn>
              </div>
              <div class="row justify-center">
                <q-btn
                  :disable="!activeMiningTask"
                  :color="activeMiningTask ? 'red' : 'grey-6'"
                  class="q-mr-xl q-mt-sm"
                  :class="!activeMiningTask ? 'invisible' : ''"
                  label="Have a rest"
                  size="md"
                  no-caps
                  outline
                  @click="stopMining"
                />
              </div>
            </div>
            <div class="col-6 self-center">
              <q-img
                src="https://www.pngall.com/wp-content/uploads/2016/05/Gold-Free-Download-PNG.png"
                spinner-color="amber"
                fit="contain"
                height="14vw"
              />
            </div>
          </div>

          <q-dialog
            v-model="advancedOptions"
            :class="!advancedOptionsShow ? 'invisible' : ''"
            persistent
            :maximized="maximizedToggle"
            transition-show="slide-up"
            transition-hide="slide-down"
          >
            <q-layout
              view="hHh Lpr lff"
              container
              class="shadow-2 rounded-borders bg-white"
            >
              <q-header class="bg-teal">
                <q-toolbar>
                  <q-btn
                    round
                    dense
                    icon="menu"
                    flat
                    @click="drawer = !drawer"
                  />
                  <q-toolbar-title>Advanced Options</q-toolbar-title>
                  <q-space />
                  <q-btn
                    dense
                    flat
                    :icon="maximizedToggle ? 'fullscreen_exit' : 'crop_square'"
                    @click="maximizedToggle = !maximizedToggle"
                  >
                    <q-tooltip class="bg-white text-primary">
                      {{ maximizedToggle ? "Minimize" : "Maximize" }}
                    </q-tooltip>
                  </q-btn>
                  <q-btn
                    dense
                    flat
                    icon="close"
                    @click="
                      advancedOptionsShow = false;
                      scrollDisable(false);
                    "
                  >
                    <q-tooltip class="bg-white text-primary">Close</q-tooltip>
                  </q-btn>
                </q-toolbar>
              </q-header>

              <q-drawer
                v-model="drawer"
                vertical
                class="text-blue-grey-10 bg-grey-2"
                show-if-above
                :width="200"
                :breakpoint="500"
                bordered
              >
                <q-scroll-area class="fit">
                  <q-list separator>
                    <template
                      v-for="(menuItem, index) in menuList"
                      :key="index"
                    >
                      <q-item
                        v-ripple
                        clickable
                        :active="menuItem.label === tab"
                        @click="itemClicked(menuItem.label)"
                      >
                        <q-item-section avatar>
                          <q-icon :name="menuItem.icon" />
                        </q-item-section>
                        <q-item-section>
                          {{ menuItem.label }}
                        </q-item-section>
                      </q-item>
                    </template>
                  </q-list>
                </q-scroll-area>
              </q-drawer>

              <q-page-container>
                <q-tab-panels
                  v-model="tab"
                  animated
                  swipeable
                  vertical
                  transition-prev="jump-up"
                  transition-next="jump-up"
                >
                  <q-tab-panel name="Mailbox folders">
                    <div class="row items-center">
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
                      <q-badge
                        color="orange"
                        class="text-weight-medium text-body1"
                        rounded
                        transparent
                      >
                        {{ totalEmails.toLocaleString() }}
                        <q-icon name="mail" class="q-ml-xs" />
                        <q-tooltip> email messages selected </q-tooltip>
                      </q-badge>
                    </div>
                    <div class="bg-grey-1 text-blue-grey-10">
                      <TreeCard
                        v-if="boxes.length > 0"
                        :boxes="boxes"
                        :scanned-boxes="scannedBoxes"
                        :class="{ disabled: activeMiningTask }"
                        @selected-boxes="updateSelectedBoxes"
                      />
                      <q-linear-progress
                        v-else
                        indeterminate
                        color="teal"
                        class="q-mt-sm"
                      />
                    </div>
                  </q-tab-panel>

                  <q-tab-panel name="movies">
                    <div class="text-h6">Movies</div>
                    <p>
                      Lorem ipsum dolor sit, amet consectetur adipisicing elit.
                      Quis praesentium cumque magnam odio iure quidem, quod
                      illum numquam possimus obcaecati commodi minima assumenda
                      consectetur culpa fuga nulla ullam. In, libero.
                    </p>
                  </q-tab-panel>
                </q-tab-panels>
              </q-page-container>
            </q-layout>
          </q-dialog>
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

const $q = useQuasar();
const $store = useStore();
const $router = useRouter();

const selectedBoxes = ref([]);
const advancedOptions = ref(true);
const advancedOptionsShow = ref(false);
const maximizedToggle = ref(false);
const drawer = ref(false);
const tab = ref("Mailbox folders");
const menuList = [
  {
    icon: "all_inbox",
    label: "Mailbox folders",
  },
  {
    icon: "movie",
    label: "movies",
  },
];

onMounted(async () => {
  window.addEventListener("keydown", onKeyDown);
  setTimeout(() => {
    scrollDisable(false);
  });

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
  if (event.key === "Escape" && advancedOptionsShow.value) {
    advancedOptionsShow.value = false;
    scrollDisable(false);
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

function itemClicked(label) {
  this.menuList.forEach((menuItem) => {
    if (menuItem.label === label) {
      menuItem.active = true;
      this.tab = label;
    } else {
      menuItem.active = false;
    }
  });
}

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

function scrollDisable(Disable = true) {
  const body = document.body;
  if (Disable) {
    body.classList.add("q-body--prevent-scroll");
  } else {
    body.classList.remove("q-body--prevent-scroll");
  }
}
</script>
<style>
.q-tree.disabled {
  pointer-events: none;
}
.q-dialog__inner--minimized > div {
  max-width: 1000px;
}
</style>
