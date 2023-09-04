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
      :sort-method="customSortLogic"
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
          <validity-indicator
            :key="props.row.status"
            :email-status="props.row.status ?? 'UNKNOWN'"
          />
        </q-td>
      </template>

      <template #loading>
        <q-inner-loading showing color="teal">
          <template #default>
            <q-circular-progress
              v-if="isVerifying"
              show-value
              :value="verificationProgress"
              size="3em"
              color="primary"
              track-color="grey-3"
              class="q-ma-md"
            >
              {{ verificationProgress }}%
            </q-circular-progress>
            <q-spinner v-else color="primary" size="3em" />
            <p>{{ loadingLabel }}</p>
          </template>
        </q-inner-loading>
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
import { AxiosError } from "axios";
import { QTable, copyToClipboard, exportFile, useQuasar } from "quasar";
import { api } from "src/boot/axios";
import { supabase } from "src/helpers/supabase";
import { useLeadminerStore } from "src/stores/leadminer";
import { Contact, EmailStatusScore } from "src/types/contact";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import ValidityIndicator from "./ValidityIndicator.vue";

const $q = useQuasar();
const leadminerStore = useLeadminerStore();
const rows = ref<Contact[]>([]);
const filterSearch = ref("");
const filter = { filterSearch };
const isLoading = ref(true);
const isVerifying = ref(false);
const loadingLabel = ref("");
const table = ref<QTable>();

let contactsCache = new Map<string, Contact>();

const minedEmails = computed(() => rows.value.length);
const unverifiedEmails = ref(0);
const verifiedEmails = ref(0);

const verificationProgress = computed(() =>
  unverifiedEmails.value !== 0
    ? Math.min(
        Math.floor((verifiedEmails.value / unverifiedEmails.value) * 100),
        100
      )
    : 0
);

const isExportDisabled = computed(() => leadminerStore.loadingStatusDns);
const activeMiningTask = computed(
  () => leadminerStore.miningTask !== undefined
);

let refreshInterval: number;
let subscription: RealtimeChannel;

async function setupSubscription() {
  // We are 100% sure that the user is authenticated in this component
  const user = (await supabase.auth.getSession()).data.session?.user as User;
  subscription = supabase.channel("*").on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "persons",
      filter: `user_id=eq.${user.id}`,
    },
    (payload: RealtimePostgresChangesPayload<Contact>) => {
      const newContact = payload.new as Contact;
      contactsCache.set(newContact.email, newContact);
    }
  );
}

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

async function refineContacts() {
  loadingLabel.value = "Refining contacts...";
  const user = (await supabase.auth.getSession()).data.session?.user as User;

  try {
    const refine = await supabase.rpc("refine_persons", {
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

async function getContacts(userId: string): Promise<Contact[]> {
  const { data, error } = await supabase.rpc("get_contacts_table", {
    userid: userId,
  });

  if (error) {
    throw error;
  }

  return data;
}

async function syncTable() {
  try {
    loadingLabel.value = "Syncing...";
    const user = (await supabase.auth.getSession()).data.session?.user as User;
    const contacts = await getContacts(user.id);
    rows.value = contacts;
  } catch (error) {
    if (error instanceof Error) {
      /* eslint-disable no-console */
      console.log(error.message);
      $q.notify({
        message: "Error occurred when refreshing table",
        textColor: "negative",
        color: "red-1",
      });
    }
  }
}

async function verifyContacts() {
  const user = (await supabase.auth.getSession()).data.session?.user as User;
  loadingLabel.value = "Verifying contacts...";
  isVerifying.value = true;

  const contacts = await getContacts(user.id);

  unverifiedEmails.value = contacts.filter((c) => !c.status).length;
  verifiedEmails.value = 0;
  let verifiedEmailsCountBuffer = 0;
  const maxMsBeforeClosingRealtime = 5000;

  return new Promise<void>((resolve) => {
    let interval: number;
    let msWaiting = 0;

    const setupInterval = () =>
      window.setInterval(async () => {
        msWaiting += 1000;
        if (msWaiting >= maxMsBeforeClosingRealtime) {
          verifiedEmails.value += verifiedEmailsCountBuffer;
          await subscription?.unsubscribe();
          isVerifying.value = false;
          resolve();
        }
      }, 1000);

    interval = setupInterval();
    subscription = supabase
      .channel("*")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "persons",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // We use a buffer to reduce how many times we update the DOM
          verifiedEmailsCountBuffer += 1;
          if (verifiedEmailsCountBuffer >= 50) {
            verifiedEmails.value += verifiedEmailsCountBuffer;
            verifiedEmailsCountBuffer = 0;
          }
          if (interval) {
            clearInterval(interval);
          }
          msWaiting = 0;
          interval = setupInterval();
        }
      )
      .subscribe();
  });
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
    }, 5000);
  } else {
    // Close realtime and re-open again later
    if (subscription) {
      await subscription.unsubscribe();
    }
    clearInterval(refreshInterval);
    contactsCache.clear();
    isLoading.value = true;
    await refineContacts();
    await verifyContacts();
    await syncTable();
    isLoading.value = false;
  }
});

const initialPagination = {
  sortBy: "custom",
};

function customSortLogic(
  rowsToFilter: readonly Contact[],
  sortBy: string,
  descending: boolean
) {
  switch (sortBy) {
    case "custom":
      return [...rowsToFilter].sort((a: Contact, b: Contact) => {
        const {
          status: statusA,
          replied_conversations: repliedA,
          occurrence: occurrenceA,
        } = a;
        const {
          status: statusB,
          replied_conversations: repliedB,
          occurrence: occurrenceB,
        } = b;

        if (statusA !== statusB) {
          // Sort by 'status' column (VALID before UNKNOWN)
          return (
            EmailStatusScore[statusA ?? "UNKNOWN"] -
            EmailStatusScore[statusB ?? "UNKNOWN"]
          );
        }

        if (repliedA !== repliedB) {
          // Sort by 'reply' column in descending order
          return (repliedB ?? 0) - (repliedA ?? 0);
        }
        // Sort by 'occurrence' column in descending order
        return (occurrenceB ?? 0) - (occurrenceA ?? 0);
      });

    case "status":
      return [...rowsToFilter].sort((a: Contact, b: Contact) => {
        const { status: statusA } = a;
        const { status: statusB } = b;

        return descending
          ? EmailStatusScore[statusA ?? "UNKNOWN"] -
              EmailStatusScore[statusB ?? "UNKNOWN"]
          : EmailStatusScore[statusB ?? "UNKNOWN"] -
              EmailStatusScore[statusA ?? "UNKNOWN"];
      });

    case "name":
    case "email":
      return [...rowsToFilter].sort((a, b) => {
        const aValue = (a[sortBy as keyof Contact] as string) ?? "";
        const bValue = (b[sortBy as keyof Contact] as string) ?? "";

        if (aValue === "") {
          return 1;
        }

        if (bValue === "") {
          return -1;
        }
        return descending
          ? bValue.localeCompare(aValue)
          : aValue.localeCompare(bValue);
      });

    default:
      if (typeof rowsToFilter[0][sortBy as keyof Contact] === "number") {
        return [...rowsToFilter].sort((a, b) => {
          const aValue = a[sortBy as keyof Contact] as number;
          const bValue = b[sortBy as keyof Contact] as number;

          return descending ? aValue - bValue : bValue - aValue;
        });
      }

      return rowsToFilter;
  }
}

const visibleColumns = ref([
  "copy",
  "email",
  "name",
  "occurrence",
  "recency",
  "replied_conversations",
  "tags",
  "status",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const columns: any = [
  {
    // This colums is only used to trigger the custom sort.
    name: "custom",
  },
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
  },
  {
    name: "name",
    label: "Name",
    field: "name",
    sortable: true,
    align: "left",
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
    name: "replied_conversations",
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
  try {
    const currentDatetime = new Date().toISOString().slice(0, 10);

    const { data: session } = await supabase.auth.getUser();
    const email = session.user?.email;

    const response = await api.get("/imap/export/csv");
    const status = exportFile(
      `leadminer-${email}-${currentDatetime}.csv`,
      response.data,
      "text/csv"
    );

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
    let message = "Error when exporting to CSV";

    if (error instanceof AxiosError) {
      message = error.response?.data.message ?? error.message;

      if (message.toLocaleLowerCase() === "network error") {
        message =
          "Unable to access server. Please retry again or contact your service provider.";
      }
    }

    $q.notify({
      message,
      color: "negative",
      icon: "error",
    });
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
