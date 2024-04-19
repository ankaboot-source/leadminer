<<<<<<< HEAD
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
              {{ isFullScreen ? 'Minimize' : 'Maximize' }}
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
              v-if="$leadminerStore.activeMiningSource"
              v-model="$leadminerStore.activeMiningSource"
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
import TreeCard from '@/components/cards/TreeCard.vue';

type TabName = 'mailbox-folders';

interface Tab {
  icon: string;
  label: string;
  name: TabName;
  active: boolean;
  disable: boolean;
}

const menuList: Tab[] = [
  {
    name: 'mailbox-folders',
    icon: 'all_inbox',
    label: 'Mailbox Folders',
    active: false,
    disable: false,
  },
];

const props = defineProps({
  totalEmails: { type: Number, required: true },
  isLoadingBoxes: { type: Boolean, required: true },
});

const $leadminerStore = useLeadminerStore();

const currentTab = ref<TabName>('mailbox-folders');
const isFullScreen = ref(false);
const isVisible = ref(false);
const drawer = ref(true);

const activeMiningSource = computed(() => $leadminerStore.activeMiningSource);

const boxes = computed(() => $leadminerStore.boxes);

const shouldShowTreeCard = computed(
  () => boxes.value.length > 0 && !props.isLoadingBoxes
);
const activeMiningTask = computed(
  () => $leadminerStore.miningTask !== undefined
);

async function onRefreshImapTree() {
  try {
    $leadminerStore.isLoadingBoxes = true;
    await $leadminerStore.getBoxes();
    $leadminerStore.isLoadingBoxes = false;
  } catch (err) {
    $leadminerStore.isLoadingBoxes = false;
    throw err;
  }
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
=======
<template>
  <Dialog
    :visible="isVisible"
    modal
    dismissable-mask
    maximizable
    :style="{ width: '60vw', height: '70vh' }"
    pt:content:class="p-0 grow border-y border-slate-200"
    pt:footer:class="p-3"
  >
    <template #header>
      <Button
        icon="pi pi-bars"
        class="p-dialog-header-icon"
        @click="toggleMenu()"
      />
      <div class="p-dialog-title">Fine-tune your mining</div>
    </template>

    <div class="flex flex-row h-full">
      <Listbox
        v-show="menuVisible"
        v-model="settingsTab"
        :options="settingsOptions"
        option-value="value"
        class="w-3/12 border-0 rounded-none border-r border-slate-200"
      >
        <template #option="{ option }">
          <div class="flex align-items-center">
            <i :class="option.icon" />
            <span class="ml-2">{{ option.label }}</span>
          </div>
        </template>
      </Listbox>

      <div class="grow p-3">
        <div class="row items-center">
          <div class="text-h6">Select folders to mine</div>
          <Button
            rounded
            icon="pi pi-refresh"
            class="ml-1.5"
            :loading="props.isLoadingBoxes"
            :disabled="activeMiningSource === undefined"
            @click="onRefreshImapTree"
          />
          <div class="grow" />

          <Chip
            v-tooltip="'Email messages selected'"
            class="bg-primary text-white"
          >
            {{ totalEmails }}
            <i class="pi pi-envelope ml-1.5" />
          </Chip>
        </div>
        <Dropdown
          v-if="$leadminerStore.activeMiningSource"
          v-model="$leadminerStore.activeMiningSource.email"
          :options="miningSources"
          option-value="email"
          option-label="email"
          class="mt-3 w-full"
          disabled
          @update:model-value="onMiningSourceChanged"
        />
        <p v-else class="m-0">
          Please ensure you have at least one mining source selected.
        </p>
        <TreeCard
          v-if="shouldShowTreeCard"
          :class="{ disabled: activeMiningTask }"
        />
      </div>
    </div>

    <template #footer>
      <Button label="Save" @click="close" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import TreeCard from '@/components/cards/TreeCard.vue';

const settingsOptions = ref([
  {
    label: 'Mailbox Folders',
    value: 'mailbox_folders',
    icon: 'pi pi-inbox',
  },
]);
const settingsTab = ref(settingsOptions.value[0]);

const props = defineProps({
  totalEmails: { type: Number, required: true },
  isLoadingBoxes: { type: Boolean, required: true },
});

const $leadminerStore = useLeadminerStore();

const isVisible = ref(false);
const menuVisible = ref(true);
const activeMiningSource = computed(() => $leadminerStore.activeMiningSource);
const miningSources = [$leadminerStore.activeMiningSource];

const boxes = computed(() => $leadminerStore.boxes);

const shouldShowTreeCard = computed(
  () => boxes.value.length > 0 && !props.isLoadingBoxes
);
const activeMiningTask = computed(
  () => $leadminerStore.miningTask !== undefined
);

async function onRefreshImapTree() {
  try {
    $leadminerStore.isLoadingBoxes = true;
    await $leadminerStore.getBoxes();
    $leadminerStore.isLoadingBoxes = false;
  } catch (err) {
    $leadminerStore.isLoadingBoxes = false;
    throw err;
  }
}

function onMiningSourceChanged() {
  onRefreshImapTree();
}

function toggleMenu() {
  menuVisible.value = !menuVisible.value;
}

function open() {
  isVisible.value = true;
}

function close() {
  isVisible.value = false;
}

defineExpose({
  open,
});
</script>
>>>>>>> f4d841ab9f10db11448ed46d18f0dec3a7d9d2fa
