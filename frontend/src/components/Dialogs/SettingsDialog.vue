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
          <q-btn dense flat icon="close" @click="close">
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
          <q-tab-panel name="folders">
            <div class="row items-center">
              <div class="text-h6">Select folders to mine</div>
              <q-btn
                round
                size="sm"
                color="orange-5"
                icon="refresh"
                class="q-ml-sm"
                :loading="props.isLoadingBoxes"
                @click="onRefreshImapTree"
              />
              <q-space />
              <q-badge
                color="orange"
                class="text-weight-medium text-body1"
                rounded
                transparent
              >
                {{ props.totalEmails }}
                <q-icon name="mail" class="q-ml-xs" />
                <q-tooltip> Email messages selected </q-tooltip>
              </q-badge>
            </div>
            <q-select
              v-if="miningSources.length > 1"
              v-model="activeMiningSource"
              class="q-mt-md"
              outlined
              :options="miningSources"
              :disable="props.isLoadingBoxes || activeMiningTask"
              option-value="email"
              option-label="email"
              dense
              @update:model-value="onMiningSourceChanged"
            />
            <p v-if="miningSources.length === 0">
              Please configure at least one mining source
            </p>
            <div class="bg-grey-1 text-blue-grey-10">
              <TreeCard
                v-if="shouldShowTreeCard"
                :boxes="boxes"
                :class="{ disabled: activeMiningTask }"
              />
            </div>
          </q-tab-panel>
          <q-tab-panel name="configuration">
            <div class="text-h6">Start by configuring mining sources</div>
            <div class="flex row flex-center q-gutter-md q-mt-sm text-bold">
              <q-btn :icon="mdiMicrosoft" @click="addOAuthAccount('azure')">
                Add Microsoft Account
              </q-btn>
              <q-btn :icon="mdiGoogle" @click="addOAuthAccount('google')">
                Add Google Account
              </q-btn>
              <q-btn :icon="mdiEmailLock" @click="openImapCredentialsDialog"
                >Add IMAP Credentials</q-btn
              >
            </div>
            <div class="q-mt-md flex column">
              <q-spinner
                v-if="isLoadingSources"
                class="self-center"
                color="primary"
                size="3em"
              />
              <q-expansion-item
                v-for="miningSource in miningSources"
                :key="miningSource.email"
                :hide-expand-icon="true"
                :icon="getIconByMiningSource(miningSource)"
                :label="miningSource.email"
              >
              </q-expansion-item>
            </div>

            <q-dialog
              v-model="showImapCredentialsDialog"
              transition-show="scale"
              transition-hide="scale"
            >
              <q-card class="q-pa-xl" align="center">
                <q-form class="q-gutter-md" @submit="onSubmitImapCredentials">
                  <q-input
                    v-model="imapEmail"
                    filled
                    label="Email address"
                    hint="Email address"
                    lazy-rules
                    :rules="[validateEmail]"
                  />
                  <q-input
                    v-model="imapPassword"
                    type="password"
                    filled
                    label="Email password"
                    hint="Email password"
                    lazy-rules
                    :rules="[validatePassword]"
                  />
                  <q-input
                    v-model="imapHost"
                    filled
                    label="IMAP host"
                    hint="IMAP host"
                    lazy-rules
                    :rules="[validateImapHost]"
                  />

                  <q-input
                    v-model="imapPort"
                    filled
                    type="number"
                    label="Port"
                    lazy-rules
                    :rules="[validateImapPort]"
                  />

                  <q-btn
                    :loading="isLoadingImapCredentialsCheck"
                    label="Submit"
                    type="submit"
                    color="primary"
                  />
                </q-form>
              </q-card>
            </q-dialog>
          </q-tab-panel>
        </q-tab-panels>
      </q-page-container>

      <q-footer bordered class="bg-white">
        <q-toolbar>
          <q-space />
          <q-btn color="teal-5" label="Done" no-caps @click="close" />
        </q-toolbar>
      </q-footer>
    </q-layout>
  </q-dialog>
</template>

<script setup lang="ts">
import {
  mdiEmail,
  mdiEmailLock,
  mdiGoogle,
  mdiMicrosoft,
} from "@quasar/extras/mdi-v6";

import { AxiosError } from "axios";
import { useQuasar } from "quasar";
import { api } from "src/boot/axios";
import { isValidEmail } from "src/helpers/email";
import { showNotification } from "src/helpers/notification";
import { useStore } from "src/store";
import { MiningSource } from "src/types/providers";
import { computed, ref } from "vue";
import TreeCard from "../cards/TreeCard.vue";

type TabName = "configuration" | "folders";

interface Tab {
  icon: string;
  label: string;
  name: TabName;
  active: boolean;
  disable: boolean;
}

const menuList: Tab[] = [
  {
    name: "configuration",
    icon: "settings",
    label: "Configuration",
    active: true,
    disable: false,
  },
  {
    name: "folders",
    icon: "all_inbox",
    label: "Mailbox folders",
    active: false,
    disable: false,
  },
];

const props = defineProps({
  totalEmails: { type: Number, required: true },
  isLoadingBoxes: { type: Boolean, required: true },
});
const emit = defineEmits<{
  (e: "get-boxes", activeMiningSource: MiningSource): void;
}>();

const $store = useStore();
const $quasar = useQuasar();

const currentTab = ref<TabName>("configuration");
const isFullScreen = ref(false);
const isVisible = ref(false);
const drawer = ref(true);

const showImapCredentialsDialog = ref(false);
const isLoadingImapCredentialsCheck = ref(false);
const imapHost = ref("");
const imapEmail = ref("");
const imapPort = ref(993);
const imapPassword = ref("");

const miningSources = computed<MiningSource[]>(
  () => $store.state.leadminer.miningSources
);

const activeMiningSource = ref<MiningSource>();

const isLoadingSources = computed(
  () => $store.state.leadminer.isLoadingSources
);
const boxes = computed(() => $store.state.leadminer.boxes);

const shouldShowTreeCard = computed(
  () => boxes.value.length > 0 && !props.isLoadingBoxes
);
const activeMiningTask = computed(
  () => $store.state.leadminer.miningTask !== null
);

function validateEmail(emailStr: string) {
  return isValidEmail(emailStr) || "Please insert a valid email address";
}

function getIconByMiningSource(miningSource: MiningSource) {
  switch (miningSource.type) {
    case "Google":
      return mdiGoogle;
    case "Azure":
      return mdiMicrosoft;
    case "IMAP":
      return mdiEmail;
    default:
      return mdiEmail;
  }
}

function onRefreshImapTree() {
  const miningSource =
    miningSources.value.length === 1
      ? miningSources.value[0]
      : activeMiningSource.value;
  if (miningSource) {
    emit("get-boxes", miningSource);
  }
}

function onMiningSourceChanged() {
  $store.commit("leadminer/setActiveMiningSource", activeMiningSource.value);
  onRefreshImapTree();
}

function validatePassword(passwordStr: string) {
  return passwordStr !== "" || "Please insert your IMAP password";
}

function validateImapHost(imapHostStr: string) {
  return imapHostStr !== "" || "Please insert your IMAP host";
}

function validateImapPort(port: number) {
  return (
    (port > 0 && port <= 65536) || "Please insert a valid IMAP port number"
  );
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

function openImapCredentialsDialog() {
  showImapCredentialsDialog.value = true;
}

function closeImapCredentialsDialog() {
  showImapCredentialsDialog.value = false;
}

async function onSubmitImapCredentials() {
  isLoadingImapCredentialsCheck.value = true;

  try {
    await api.post("/imap/mine/sources/imap", {
      email: imapEmail.value,
      host: imapHost.value,
      port: imapPort.value,
      password: imapPassword.value,
    });
    await $store.dispatch("leadminer/getMiningSources");
    closeImapCredentialsDialog();
  } catch (error) {
    if (error instanceof AxiosError) {
      showNotification($quasar, error.message, "negative", "error");
    }
  } finally {
    isLoadingImapCredentialsCheck.value = false;
  }
}

async function addOAuthAccount(provider: "azure" | "google") {
  try {
    const { data } = await api.post<{ authorizationUri: string }>(
      `/imap/mine/sources/${provider}`
    );
    window.location.href = data.authorizationUri;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
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
