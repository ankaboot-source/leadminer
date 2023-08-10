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
      :visible-columns="visibleColumns"
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
            When was the last time this contact was seen
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
            Count of conversations this contact was in
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
            Total occurrences of this contact
          </q-tooltip>
          {{ props.col.label }}
        </q-th>
      </template>

      <template #header-cell-reply="props">
        <q-th :props="props">
          <q-tooltip
            class="bg-orange-13 text-caption"
            anchor="top middle"
            self="center middle"
          >
            How many times this contact replied
          </q-tooltip>
          {{ props.col.label }}
        </q-th>
      </template>

      <template #header-cell-tags="props">
        <q-th :props="props">
          <q-tooltip
            class="bg-orange-13 text-caption"
            anchor="top middle"
            self="center middle"
          >
            Categorize your contacts
          </q-tooltip>
          {{ props.col.label }}
        </q-th>
      </template>

      <template #header-cell-status="props">
        <q-th :props="props">
          <q-tooltip
            class="bg-orange-13 text-caption"
            anchor="top middle"
            self="center middle"
          >
            How reachable is your contact
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
          <div class="row items-center">
            <q-badge v-if="props.row.name" outline color="orange">
              {{ props.row.name }}
            </q-badge>
          </div>
        </q-td>
      </template>

      <template #body-cell-status="props">
        <q-td :props="props">
          <validity-indicator :email-status="props.row.status" />
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup lang="ts">
import {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  User,
} from "@supabase/supabase-js";
import { QTable, copyToClipboard, exportFile, useQuasar } from "quasar";
import { getCsvStr } from "src/helpers/csv";
import { fetchData, supabase } from "src/helpers/supabase";
import { useLeadminerStore } from "src/store/leadminer";
import { Contact, EmailStatus, EmailStatusScore } from "src/types/contact";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import ValidityIndicator from "./ValidityIndicator.vue";

const $q = useQuasar();
const leadminerStore = useLeadminerStore();
const rows = ref<Contact[]>([]);
const filterSearch = ref("");
const filter = { filterSearch };
const isLoading = ref(false);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = ref<QTable>();

let contactsCache = new Map<string, Contact>();

const minedEmails = computed(() => rows.value.length);

const initialPagination = {
  sortBy: "status",
};

const isExportDisabled = computed(() => leadminerStore.loadingStatusDns);

const activeMiningTask = computed(
  () => leadminerStore.miningTask !== undefined
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
async function setupSubscription() {
  // We are 100% sure that the user is authenticated in this component
  const user = (await supabase.auth.getSession()).data.session?.user as User;
  subscription = supabase.channel("*").on(
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
  const user = (await supabase.auth.getSession()).data.session?.user as User;

  try {
    // Populate the data in the table one final time before refining,
    // ensure that undesirable tags are filtered.
    const populate = await supabase.rpc("populate_refined", {
      _userid: user.id,
    });

    if (populate.error) {
      throw populate.error;
    }

    const refine = await supabase.rpc("refined_persons", {
      userid: user.id,
    });

    if (refine.error) {
      throw refine.error;
    }
  } catch (error) {
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
  const user = (await supabase.auth.getSession()).data.session?.user as User;
  const contacts = await getContacts(user.id);
  rows.value = contacts;
}

watch(activeMiningTask, async (isActive) => {
  if (isActive) {
    // If mining is active, update refined persons every 3 seconds
    await setupSubscription();
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

const visibleColumns = ref([
  "copy",
  "email",
  "name",
  "occurrence",
  "recency",
  "reply",
  "tags",
  "status",
]);
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
    format: (val: Date) =>
      val ? new Date(val).toISOString().slice(0, 10) : "",
    sortable: true,
  },
  {
    name: "seniority",
    label: "Seniority",
    align: "center",
    field: "seniority",
    format: (val: Date) =>
      val ? new Date(val).toISOString().slice(0, 10) : "",
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
    name: "occurrence",
    label: "Occurrence",
    field: "occurrence",
    align: "center",
    sortable: true,
  },
  {
    name: "reply",
    label: "Reply",
    field: "replied_conversations",
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
    field: "status",
    sortable: true,
    sort: (a: EmailStatus, b: EmailStatus) =>
      EmailStatusScore[a] - EmailStatusScore[b],
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
  const { data: session } = await supabase.auth.getUser();

  const currentDatetime = new Date();
  const email = session.user?.email;
  const fileName = `leadminer-${email}-${currentDatetime
    .toISOString()
    .slice(0, 10)}.csv`;

  const csvData = rows.value.map((r) => ({
    name: r.name?.trim(),
    email: r.email,
    recency: r.recency ? new Date(r.recency).toISOString().slice(0, 10) : "",
    seniority: r.seniority
      ? new Date(r.seniority).toISOString().slice(0, 10)
      : "",
    occurrence: r.occurrence,
    sender: r.sender,
    recipient: r.recipient,
    conversations: r.conversations,
    repliedConversations: r.replied_conversations,
    tags: r.tags?.join("\n"),
    status: r.status,
  }));

  try {
    const csvStr = await getCsvStr(
      [
        { key: "name", header: "Name" },
        { key: "email", header: "Email" },
        { key: "recency", header: "Recency" },
        { key: "seniority", header: "Seniority" },
        { key: "occurrence", header: "Occurrence" },
        { key: "sender", header: "Sender" },
        { key: "recipient", header: "Recipient" },
        { key: "conversations", header: "Conversations" },
        { key: "repliedConversations", header: "Replied conversations" },
        { key: "tags", header: "Tags" },
        { key: "status", header: "Status" },
      ],
      csvData
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
