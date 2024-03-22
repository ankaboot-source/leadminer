<template>
  <q-dialog
    v-model="isVisible"
    transition-show="scale"
    transition-hide="scale"
    :maximized="isFullScreen"
  >
    <q-layout
      view="hHh Lpr lFF"
      container
      class="shadow-2 rounded-borders bg-white"
    >
      <q-header>
        <q-toolbar>
          <q-btn round dense icon="menu" flat @click="toggleDrawer" />
          <q-toolbar-title>Fine-tune your mining</q-toolbar-title>
          <q-space />
          <q-btn
            dense
            flat
            :icon="isFullScreen ? 'fullscreen_exit' : 'crop_square'"
            @click="toggleFullScreen"
          >
            <q-tooltip class="bg-white text-black">
              {{ isFullScreen ? "Minimize" : "Maximize" }}
            </q-tooltip>
          </q-btn>
          <q-btn dense flat icon="close" @click="close">
            <q-tooltip class="bg-white text-black">Close</q-tooltip>
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
              :disable="menuItem.disable"
              :active="menuItem.name === currentTab"
              @click="tabItemClicked(menuItem.name)"
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
        <q-tab-panels v-model="currentTab" animated swipeable vertical>
          <q-tab-panel name="mailbox-folders">
            <div class="row items-center">
              <div class="text-h6">Select folders to mine</div>
              <q-btn
                round
                size="xs"
                color="primary"
                icon="refresh"
                class="q-ml-sm"
                :loading="props.isLoadingBoxes"
                :disable="activeMiningSource === undefined"
                @click="onRefreshImapTree"
              />
              <q-space />
              <q-badge color="primary" class="text-body1" rounded transparent>
                <span class="q-mx-xs">
                  {{ totalEmails }}
                </span>
                <q-icon name="mail" class="q-mr-xs" />
                <q-tooltip> Email messages selected </q-tooltip>
              </q-badge>
            </div>
            <q-select
              v-if="leadminerStore.activeMiningSource"
              v-model="leadminerStore.activeMiningSource"
              outlined
              disable
              dense
              class="q-mt-md"
              option-value="email"
              option-label="email"
              @update:model-value="onMiningSourceChanged"
            />
            <p v-else>
              Please ensure you have at least one mining source selected.
            </p>
            <div class="bg-grey-1 text-blue-grey-10">
              <TreeCard
                v-if="shouldShowTreeCard"
                :class="{ disabled: activeMiningTask }"
              />
            </div>
          </q-tab-panel>
        </q-tab-panels>
      </q-page-container>
      <q-footer bordered class="bg-white">
        <q-toolbar>
          <q-space />
          <q-btn
            color="primary"
            unelevated
            label="Save"
            no-caps
            @click="close"
          />
        </q-toolbar>
      </q-footer>
    </q-layout>
  </q-dialog>
</template>

<script setup lang="ts">
import { useLeadminerStore } from "src/stores/leadminer";
import { computed, ref } from "vue";
import TreeCard from "src/components/cards/TreeCard.vue";

type TabName = "mailbox-folders";

interface Tab {
  icon: string;
  label: string;
  name: TabName;
  active: boolean;
  disable: boolean;
}

const menuList: Tab[] = [
  {
    name: "mailbox-folders",
    icon: "all_inbox",
    label: "Mailbox Folders",
    active: false,
    disable: false,
  },
];

const props = defineProps({
  totalEmails: { type: Number, required: true },
  isLoadingBoxes: { type: Boolean, required: true },
});
const emit = defineEmits<(e: "get-boxes") => void>();

const leadminerStore = useLeadminerStore();

const currentTab = ref<TabName>("mailbox-folders");
const isFullScreen = ref(false);
const isVisible = ref(false);
const drawer = ref(true);

const activeMiningSource = computed(() => leadminerStore.activeMiningSource);

const boxes = computed(() => leadminerStore.boxes);

const shouldShowTreeCard = computed(
  () => boxes.value.length > 0 && !props.isLoadingBoxes
);
const activeMiningTask = computed(
  () => leadminerStore.miningTask !== undefined
);

function onRefreshImapTree() {
  emit("get-boxes");
}

function onMiningSourceChanged() {
  onRefreshImapTree();
}

function toggleDrawer() {
  drawer.value = !drawer.value;
}

function open() {
  isVisible.value = true;
}

function close() {
  isVisible.value = false;
}

function toggleFullScreen() {
  isFullScreen.value = !isFullScreen.value;
}

function tabItemClicked(name: TabName) {
  menuList.forEach((menuItem) => {
    if (menuItem.name === name) {
      menuItem.active = true;
      currentTab.value = name;
    } else {
      menuItem.active = false;
    }
  });
}

defineExpose({
  open,
});
</script>
