<template>
  <div class="row q-col-gutter-sm">
    <div class="col">
      <div class="col">
        <q-card flat class="q-px-md bg-banner-color">
          <div class="row justify-around">
            <div class="col text-center self-center q-py-lg">
              <div class="row justify-center q-pb-lg">
                <div class="col-8 text-h6 text-weight-medium">
                  Discover hidden gems in your social network
                </div>
              </div>
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
                  @click="toggleAdvancedOptions"
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

          <q-dialog
            v-model="advancedOptions"
            :class="!advancedOptionsVisible ? 'invisible' : ''"
            persistent
            :maximized="isFullScreen"
            transition-show="slide-up"
            transition-hide="slide-down"
          >
            <q-layout
              view="hHh Lpr lFF"
              container
              class="shadow-2 rounded-borders bg-white"
            >
              <q-header class="bg-teal">
                <q-toolbar>
                  <q-btn round dense icon="menu" flat @click="toggleDrawer" />
                  <q-toolbar-title>Advanced Options</q-toolbar-title>
                  <q-space />
                  <q-btn
                    dense
                    flat
                    :icon="isFullScreen ? 'fullscreen_exit' : 'crop_square'"
                    @click="toggleFullScreen"
                  >
                    <q-tooltip class="bg-white text-primary">
                      {{ isFullScreen ? "Minimize" : "Maximize" }}
                    </q-tooltip>
                  </q-btn>
                  <q-btn dense flat icon="close" @click="toggleAdvancedOptions">
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
                    <q-item
                      v-for="(menuItem, index) in menuList"
                      :key="index"
                      v-ripple
                      clickable
                      :active="menuItem.label === currentTab"
                      @click="itemClicked(menuItem.label)"
                    >
                      <q-item-section avatar>
                        <q-icon :name="menuItem.icon" />
                      </q-item-section>
                      <q-item-section>
                        {{ menuItem.label }}
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-scroll-area>
              </q-drawer>

              <q-page-container>
                <q-tab-panels
                  v-model="currentTab"
                  animated
                  swipeable
                  vertical
                  transition-prev="jump-up"
                  transition-next="jump-up"
                >
                  <q-tab-panel name="Mailbox folders">
                    <div class="row items-center">
                      <div class="text-h6">Select folders to mine</div>
                      <q-btn
                        round
                        size="sm"
                        color="orange-5"
                        icon="refresh"
                        class="q-ml-sm"
                        :disable="activeMiningTask"
                        :loading="isLoadingBoxes"
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
                        <q-tooltip> Email messages selected </q-tooltip>
                      </q-badge>
                    </div>
                    <div class="bg-grey-1 text-blue-grey-10">
                      <TreeCard
                        v-if="shouldShowTreeCard"
                        :boxes="boxes"
                        :scanned-boxes="scannedBoxes"
                        :class="{ disabled: activeMiningTask }"
                        @selected-boxes="updateSelectedBoxes"
                      />
                    </div>
                  </q-tab-panel>
                </q-tab-panels>
              </q-page-container>

              <q-footer bordered class="bg-white">
                <q-toolbar>
                  <q-space />
                  <q-btn
                    color="teal-5"
                    label="Done"
                    no-caps
                    @click="toggleAdvancedOptions"
                  />
                </q-toolbar>
              </q-footer>
            </q-layout>
          </q-dialog>
        </q-card>
      </div>
      <MinedPersons />
    </div>
  </div>
</template>

<script lang="ts" setup>
// @ts-expect-error "No type definitions"
import objectScan from "object-scan";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { showNotification } from "src/helpers/notification";
import { useStore } from "../../store/index";
import TreeCard from "../cards/TreeCard.vue";
import ProgressCard from "../cards/ProgressCard.vue";
import MinedPersons from "../MinedPersons.vue";

const $store = useStore();
const $router = useRouter();

const imgUrl = process.env.BANNER_IMAGE_URL;
const isLoadingStartMining = ref(false);
const isLoadingStopMining = ref(false);
const isLoadingBoxes = ref(false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const selectedBoxes = ref<any>([]);
const advancedOptions = ref(true);
const advancedOptionsVisible = ref(false);
const isFullScreen = ref(false);
const drawer = ref(false);
const currentTab = ref("Mailbox folders");
const menuList = [
  {
    icon: "all_inbox",
    label: "Mailbox folders",
    active: true,
  },
];

function enableScrolling() {
  const { body } = document;
  body.classList.remove("q-body--prevent-scroll");
}

function disableScrolling() {
  const { body } = document;
  body.classList.add("q-body--prevent-scroll");
}

function toggleDrawer() {
  drawer.value = !drawer.value;
}

function toggleAdvancedOptions() {
  advancedOptionsVisible.value = !advancedOptionsVisible.value;
  // eslint-disable-next-line no-unused-expressions
  advancedOptionsVisible.value ? disableScrolling() : enableScrolling();
}

function toggleFullScreen() {
  isFullScreen.value = !isFullScreen.value;
}

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && advancedOptionsVisible.value) {
    advancedOptionsVisible.value = false;
    enableScrolling();
  }
};

async function getBoxes() {
  try {
    isLoadingBoxes.value = true;
    isLoadingStartMining.value = true;
    await $store.dispatch("leadminer/getBoxes");
    // eslint-disable-next-line no-console
    showNotification($store.state.leadminer.infoMessage, "green", "");
  } catch (_) {
    showNotification($store.state.leadminer.errorMessage, "red", "error");
  } finally {
    isLoadingBoxes.value = false;
    isLoadingStartMining.value = false;
  }
}

onMounted(async () => {
  const isLoggedIn = $store.getters["leadminer/isLoggedIn"];

  if (!isLoggedIn) {
    $router.push("/");
    return;
  }

  window.addEventListener("keydown", onKeyDown);
  setTimeout(() => {
    enableScrolling();
  }, 100);
  await getBoxes();
});

const boxes = computed(() => $store.state.leadminer.boxes);

const shouldShowTreeCard = computed(
  () => boxes.value.length > 0 && !isLoadingBoxes.value
);

const scannedBoxes = computed(
  () => $store.state.leadminer.progress.scannedBoxes
);

const activeMiningTask = computed(() =>
  Boolean($store.state.leadminer.miningTask.miningId)
);
const scannedEmails = computed(
  () => $store.state.leadminer.progress.scannedEmails
);
const extractedEmails = computed(
  () => $store.state.leadminer.progress.extractedEmails
);

const totalEmails = computed(() => {
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

function itemClicked(label: string) {
  menuList.forEach((menuItem) => {
    if (menuItem.label === label) {
      menuItem.active = true;
      currentTab.value = label;
    } else {
      menuItem.active = false;
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function updateSelectedBoxes(val: any) {
  $store.commit("leadminer/SET_SCANNEDEMAILS", 0);
  $store.commit("leadminer/SET_EXTRACTEDEMAILS", 0);
  selectedBoxes.value = val;
}

async function stopMining() {
  isLoadingStopMining.value = true;
  const { miningId } = $store.state.leadminer.miningTask;
  try {
    await $store.dispatch("leadminer/stopMining", { data: { miningId } });
    showNotification($store.state.leadminer.infoMessage, "green", "");
  } catch (error) {
    showNotification($store.state.leadminer.errorMessage, "red", "error");
  } finally {
    isLoadingStopMining.value = false;
  }
}

// eslint-disable-next-line consistent-return
async function startMining() {
  isLoadingStartMining.value = true;
  if (selectedBoxes.value.length === 0) {
    return showNotification(
      "Select at least one folder",
      "orange-5",
      "warning"
    );
  }

  try {
    await $store.dispatch("leadminer/startMining", {
      data: { boxes: selectedBoxes.value },
    });
    showNotification($store.state.leadminer.infoMessage, "green", "");
  } catch (error) {
    showNotification($store.state.leadminer.errorMessage, "red", "error");
  } finally {
    isLoadingStartMining.value = false;
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
.bg-banner-color {
  background: linear-gradient(
    135deg,
    rgba(255, 230, 149, 0.5) 0%,
    rgba(255, 248, 225, 0.5) 100%
  );
}
</style>
