<template>
  <div class="bg-transparent col" style="height: 60vh">
    <q-table
      ref="table"
      class="q-pt-sm"
      style="height: 100%"
      virtual-scroll
      virtual-scroll-slice-size="60"
      :rows-per-page-options="[150, 500, 1000]"
      row-key="email"
      :columns="columns"
      title="Mined emails"
      :loading="isLoading"
      :filter="filter"
      :filter-method="filterFn"
      :rows="rows"
      :pagination="initialPagination"
      binary-state-sort
      bordered
      flat
      dense
    >
      <template #top-left>
        <div class="text-blue-grey-14 text-body1">
          <span class="text-h6 text-weight-bolder q-ml-sm q-mr-xs">
            {{ minedEmails }}
          </span>
          contacts mined
        </div>
      </template>
      <template #top-right="props">
        <q-input
          v-model="filterSearch"
          dense
          standout
          outlined
          color="teal-5"
          class="q-pr-sm q-pl-lg"
          style="width: 25vw"
          debounce="700"
          placeholder="Search"
        >
          <template #append>
            <q-icon name="search" />
          </template>
        </q-input>
        <div class="q-px-sm">
          <q-btn
            color="teal-5"
            icon="archive"
            label="Export to CSV"
            no-caps
            :disable="isExportDisabled"
            outline
            @click="exportTable"
          />
        </div>
        <q-btn
          flat
          round
          dense
          :icon="props.inFullscreen ? 'fullscreen_exit' : 'fullscreen'"
          class="q-px-sm"
          @click="props.toggleFullscreen"
        >
          <q-tooltip :disable="$q.platform.is.mobile">
            {{ props.inFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen" }}
          </q-tooltip>
        </q-btn>
      </template>

      <template #loading>
        <q-inner-loading showing color="teal" />
      </template>

      <!--Header tooltips -->
      <template #header-cell-recency="props">
        <q-th :props="props">
          <q-tooltip
            class="bg-orange-13 text-caption"
            anchor="top middle"
            self="center middle"
          >
            Date of last interaction with this person
          </q-tooltip>
          {{ props.col.label }}
        </q-th>
      </template>

      <template #header-cell-engagement="props">
        <q-th :props="props">
          <q-tooltip
            class="bg-orange-13 text-caption"
            anchor="top middle"
            self="center middle"
          >
            Count of conversations this email address was in
          </q-tooltip>
          {{ props.col.label }}
        </q-th>
      </template>

      <template #header-cell-occurrence="props">
        <q-th :props="props">
          <q-tooltip
            class="bg-orange-13 text-caption"
            anchor="top middle"
            self="center middle"
          >
            Total occurrences of this email address
          </q-tooltip>
          {{ props.col.label }}
        </q-th>
      </template>

      <!-- Table body slots -->
      <template #body-cell-copy="props">
        <q-td auto-width>
          <q-btn
            flat
            round
            size="xs"
            color="teal"
            class="q-mr-none"
            icon="content_copy"
            @click="
              copyValueToClipboard(
                `${props.row.name} <${props.row.email}>`,
                'Contact'
              )
            "
          />
        </q-td>
      </template>
      <template #body-cell-email="props">
        <q-td :props="props">
          {{ props.row.email }}
        </q-td>
      </template>

      <template #body-cell-tags="props">
        <q-td :props="props">
          <q-badge
            v-for="tag in props.row.tags"
            :key="tag"
            color="teal-1"
            class="q-pa-xs text-uppercase text-teal-8 q-mx-xs"
          >
            {{ tag }}
          </q-badge>
        </q-td>
      </template>

      <template #body-cell-name="props">
        <q-td :props="props">
          <q-expansion-item
            v-if="props.row.name && props.row.alternate_names?.length > 1"
            dense
            dense-toggle
            expand-icon-class="text-orange"
            header-class="q-prl-16"
          >
            <template #header>
              <q-item-section>
                <div class="row items-center">
                  <q-badge outline color="orange">
                    {{
                      props.row.name.length > 35
                        ? props.row.name.substring(0, 30).concat("...")
                        : props.row.name
                    }}
                  </q-badge>
                  <q-badge
                    class="text-little q-ml-sm"
                    outline
                    color="orange"
                    transparent
                  >
                    +{{ props.row.alternate_names.length - 1 }}
                  </q-badge>
                </div>
              </q-item-section>
            </template>
            <div
              v-for="name in props.row.alternate_names.filter((element: string) => {
                return element.trim() !== '' && element !== props.row.name;
              })"
              :key="name.index"
              :bind="name.index"
              style="padding-left: 16px"
            >
              <q-badge v-if="name.length > 0" outline color="orange">
                {{
                  name.length > 35 ? name.substring(0, 30).concat("...") : name
                }}
              </q-badge>
              <br />
            </div>
          </q-expansion-item>
          <div
            v-else-if="props.row.name"
            class="row items-center"
            style="padding-left: 16px"
          >
            <q-badge outline color="orange">
              {{ props.row.name ? props.row.name : "" }}
            </q-badge>
          </div>
        </q-td>
      </template>

      <template #body-cell-status="props">
        <q-td :props="props">
          <q-badge rounded :color="mailboxValidityCurrent">
            {{ " " }}
            <q-tooltip :class="'bg-' + mailboxValidityCurrent">
              {{ mailboxValidity[mailboxValidityCurrent] }}
            </q-tooltip>
          </q-badge>
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
import {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { QTable, copyToClipboard, exportFile, useQuasar } from "quasar";
import { getCsvStr } from "src/helpers/csv";
import { fetchData, supabaseClient } from "src/helpers/supabase";
import { Contact } from "src/types/contact";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useStore } from "../store/index";

const $q = useQuasar();
const $store = useStore();

const rows = ref<Contact[]>([]);
const filterSearch = ref("");
const filter = { filterSearch };
const isLoading = ref(false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = ref<QTable>();

let contactsCache = new Map<string, Contact>();

const minedEmails = computed(() => rows.value.length);

const initialPagination = {
  sortBy: "engagement",
  descending: true,
};
const mailboxValidity = {
  green: "Valid mailbox",
  orange: "The mailbox could not receive your emails",
  red: "The mailbox is not valid",
};
const mailboxValidityCurrent: "green" | "orange" | "red" = "green";

const isExportDisabled = computed(
  () => $store.state.leadminer.loadingStatusDns
);

const activeMiningTask = computed(
  () => !!$store.state.leadminer.miningTask.miningId
);

let refreshInterval: number;
function refreshTable() {
  const contactCacheLength = contactsCache.size;
  const contactTableLength = rows.value.length;
  const hasNewContacts = contactCacheLength > contactTableLength;

  if (hasNewContacts) {
    isLoading.value = true;
    rows.value = Array.from(contactsCache.values());
    isLoading.value = false;
  }
}

let subscription: RealtimeChannel;
function setupSubscription() {
  const user = $store.getters["leadminer/getCurrentUser"];
  subscription = supabaseClient.channel("*").on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "refinedpersons",
      filter: `userid=eq.${user.id}`,
    },
    (payload: RealtimePostgresChangesPayload<Contact>) => {
      const newContact = payload.new as Contact;
      contactsCache.set(newContact.email, newContact);
    }
  );
}

async function refineContacts() {
  const { id } = $store.getters["leadminer/getCurrentUser"];
  const { error } = await supabaseClient.rpc("refined_persons", {
    userid: id,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
}

async function getContacts(userId: string) {
  const contacts = await fetchData<Contact>(
    userId,
    "refinedpersons",
    process.env.SUPABASE_MAX_ROWS
  );

  return contacts;
}

async function syncTable() {
  const { id } = $store.getters["leadminer/getCurrentUser"];
  const contacts = await getContacts(id);
  rows.value = contacts;
}

watch(activeMiningTask, async (isActive) => {
  if (isActive) {
    // If mining is active, update refined persons every 3 seconds
    setupSubscription();
    subscription.subscribe();
    if (rows.value.length > 0) {
      contactsCache = new Map(rows.value.map((row) => [row.email, row]));
    }
    refreshInterval = window.setInterval(() => {
      refreshTable();
    }, 3000);
  } else {
    if (subscription) {
      subscription.unsubscribe();
    }
    clearInterval(refreshInterval);
    contactsCache.clear();
    isLoading.value = true;
    await refineContacts();
    await syncTable();
    isLoading.value = false;
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const columns: any = [
  {
    name: "copy",
    label: "",
    align: "left",
    field: "",
  },
  {
    name: "email",
    label: "Email",
    field: "email",
    sortable: true,
    align: "left",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sort: (a: any, b: any) => a.localeCompare(b),
  },
  {
    name: "name",
    label: "Name",
    field: "name",
    sortable: true,
    align: "left",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sort: (a: any, b: any) => b.localeCompare(a),
  },
  {
    name: "recency",
    label: "Recency",
    align: "center",
    field: "recency",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    format: (val: any) => (val ? new Date(val).toISOString().slice(0, 10) : ""),
    sortable: true,
  },
  {
    name: "engagement",
    label: "Engagement",
    field: "engagement",
    align: "center",
    sortable: true,
  },
  {
    name: "tags",
    label: "Tags",
    align: "center",
    field: "tags",
  },
  {
    name: "status",
    label: "Status",
    align: "center",
    field: "",
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterFn(rowsToFilter: readonly any[], terms: any) {
  return rowsToFilter.filter((r) =>
    [r.email, r.name, ...(r.alternate_names ?? [])].some((field) =>
      field?.toLowerCase().includes(terms.filterSearch.value.toLowerCase())
    )
  );
}

async function exportTable() {
  if (!rows.value.length) {
    $q.notify({
      message: "There are no contacts present in the table.",
      textColor: "negative",
      color: "red-1",
    });
    return;
  }
  const currentDatetime = new Date();
  const { email } = $store.getters["leadminer/getCurrentUser"];
  const fileName = `leadminer-${email}-${currentDatetime
    .toISOString()
    .slice(0, 10)}`;

  const data = rows.value.map((r) => ({
    name: r.name?.trim(),
    alternateNames: r.alternate_names
      ?.filter((name: string) => name.trim() !== "" && name !== r.name)
      .join("\n"),
    email: r.email,
    engagement: r.engagement,
    occurence: r.occurence,
    recency: r.recency ? new Date(r.recency).toISOString().slice(0, 10) : "",
    tags: r.tags?.join("\n"),
  }));

  try {
    const csvStr = await getCsvStr(
      [
        { key: "name", header: "Name" },
        { key: "alternateNames", header: "Alternate Names" },
        { key: "email", header: "Email" },
        { key: "engagement", header: "Engagement" },
        { key: "occurence", header: "Occurrence" },
        { key: "recency", header: "Recency" },
        { key: "tags", header: "Tags" },
      ],
      data
    );

    const status = exportFile(fileName, csvStr, "text/csv");

    if (status !== true) {
      $q.notify({
        message: "Browser denied file download...",
        color: "negative",
        icon: "warning",
      });
      return;
    }

    $q.notify({
      message: "Emails exported successfully",
      textColor: "positive",
      color: "white",
      icon: "task_alt",
    });
  } catch (error) {
    $q.notify("Error when exporting to CSV");
  }
}

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Escape") {
    table.value?.exitFullscreen();
  }
};

onMounted(async () => {
  if (!$store.getters["leadminer/isLoggedIn"]) {
    return;
  }
  window.addEventListener("keydown", onKeyDown);
  isLoading.value = true;
  await refineContacts();
  await syncTable();
  isLoading.value = false;
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
  clearInterval(refreshInterval);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function copyValueToClipboard(value: any, valueName: any) {
  await copyToClipboard(value);
  $q.notify({
    message: `${valueName} copied to clipboard`,
    textColor: "positive",
    color: "white",
    icon: "content_copy",
  });
}
</script>

<style>
.q-table__top,
.q-table__bottom,
thead tr:first-child th

/* bg color is important for th; just specify one */ {
  background-color: #fff;
}

thead tr th {
  position: sticky;
  z-index: 1;
}

/* this will be the loading indicator */
thead tr:last-child th {
  /* height of all previous header rows */
  top: 48px;
}

thead tr:first-child th {
  top: 0;
}
</style>
