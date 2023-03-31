<template>
  <div
    class="bg-transparent q-mr-sm q-ml-sm col-12 q-pl-lg q-pr-lg"
    style="height: 60vh"
  >
    <q-table
      ref="table"
      class="q-pt-sm"
      style="height: 100%"
      virtual-scroll
      virtual-scroll-slice-size="60"
      :rows-per-page-options="[150, 500, 1000]"
      row-key="email"
      title="Mined emails"
      :loading="isLoading"
      :filter="filter"
      :filter-method="filterFn"
      :rows="rows"
      :columns="columns"
      :pagination="initialPagination"
      bordered
      flat
      dense
    >
      <template #top-left>
        <q-input
          v-model="filterSearch"
          dense
          standout
          outlined
          color="teal-5"
          class="q-pr-sm q-pl-lg"
          style="width: 25vw"
          debounce="300"
          placeholder="Search"
        >
          <template #append>
            <q-icon name="search" />
          </template>
        </q-input>
        <div class="text-blue-grey-14 text-body1">
          <span class="text-h5 text-weight-bolder q-ma-sm">
            {{ minedEmails }}
          </span>
          contacts mined
        </div>
      </template>
      <template #top-right="props">
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
        <div class="q-px-sm">
          <q-btn
            outline
            color="teal-5"
            label="Sync"
            icon="sync"
            no-caps
            :disable="isLoading"
            @click="syncTable"
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
            " /></q-td
      ></template>
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
                    >+{{ props.row.alternate_names.length - 1 }}
                  </q-badge>
                </div>
              </q-item-section>
            </template>
            <div
              v-for="name in props.row.alternate_names.filter((element) => {
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
            <q-tooltip :class="'bg-' + mailboxValidityCurrent">{{
              mailboxValidity[mailboxValidityCurrent]
            }}</q-tooltip>
          </q-badge>
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import exportFromJSON from "export-from-json";
import { copyToClipboard, useQuasar } from "quasar";
import { getLocalizedCsvSeparator } from "src/helpers/csv-helpers";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useStore } from "vuex";

const $q = useQuasar();
const $store = useStore();

const rows = ref([]);
const filterSearch = ref("");
const filter = { filterSearch };
const isLoading = ref(false);
const table = ref(null);

const minedEmails = computed(
  () => $store.getters["example/getRetrievedEmails"].length
);

const initialPagination = {
  sortBy: "engagement",
  descending: true,
};
const mailboxValidity = {
  green: "Valid mailbox",
  orange: "The mailbox could not receive your emails",
  red: "The mailbox is not valid",
};
const mailboxValidityCurrent = "green";

const isExportDisabled = computed(
  () =>
    $store.state.example.loadingStatusDns ||
    rows.value.some(
      (el) => el.engagement === undefined || el.engagement === null
    )
);

const activeMiningTask = computed(
  () => !!$store.state.example.miningTask.miningId
);

let refreshInterval = null;

watch(activeMiningTask, async (isActive) => {
  if (isActive) {
    // If mining is active, update refined persons every 3 seconds
    refreshInterval = setInterval(() => {
      // Call the refreshTable function
      refreshTable();
    }, 3000);
  } else {
    clearInterval(refreshInterval);
    await syncTable();
  }
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
  clearInterval(refreshInterval);
});

const columns = [
  {
    name: "copy",
    label: "",
    align: "left",
  },
  {
    name: "email",
    label: "Email",
    field: "email",
    sortable: true,
    align: "left",
    sort: (a, b) => {
      return a.localeCompare(b);
    },
  },
  {
    name: "name",
    label: "Name",
    field: "name",
    sortable: true,
    align: "left",
    sort: (a, b) => {
      return b.localeCompare(a);
    },
  },
  {
    name: "recency",
    label: "Recency",
    align: "center",
    field: "recency",
    format: (val) => (val ? new Date(val).toISOString().slice(0, 10) : ""),
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
  },
];

function filterFn(rows, terms) {
  return rows.filter((r) =>
    [r.email, r.name, ...(r.alternate_names ?? [])].some((field) =>
      field?.toLowerCase().includes(terms.filterSearch.value.toLowerCase())
    )
  );
}

function refreshTable() {
  const contactStoreLength =
    $store.getters["example/getRetrievedEmails"].length;
  const contactTableLength = rows.value.length;
  const hasNewContacts =
    parseInt(contactStoreLength) > parseInt(contactTableLength);

  if (hasNewContacts) {
    isLoading.value = true;
    rows.value = $store.getters["example/getRetrievedEmails"];
    isLoading.value = false;
  }
}

async function syncTable() {
  isLoading.value = true;
  await $store.dispatch("example/syncRefinedPersons");
  rows.value = $store.getters["example/getRetrievedEmails"];
  isLoading.value = false;
}

function exportTable() {
  if (!rows.value.length) {
    $q.notify({
      message: "There are no contacts present in the table.",
      textColor: "negative",
      color: "red-1",
    });
    return 0;
  }
  const currentDatetime = new Date();
  const userEmail = $store.getters["example/getUserEmail"];
  const fileName = `leadminer-${userEmail}-${currentDatetime
    .toISOString()
    .slice(0, 10)}`;

  try {
    exportFromJSON({
      data: rows.value.map((r) => {
        return {
          name: r.name,
          alternateNames: r.alternate_names
            .filter((name) => {
              return name.trim() !== "" && name !== r.name;
            })
            .join("\n"),
          email: r.email,
          engagement: r.engagement,
          occurence: r.occurence,
          recency: new Date(r.recency).toISOString().slice(0, 10),
          tags: r.tags.join("\n"),
        };
      }),
      fileName,
      withBOM: true,
      exportType: exportFromJSON.types.csv,
      delimiter: getLocalizedCsvSeparator(),
    });
    $q.notify({
      message: "Successfully exported table.",
      textColor: "positive",
      color: "white",
      icon: "task_alt",
    });
  } catch (error) {
    $q.notify("Error when exporting to CSV.");
  }
}
onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
  setTimeout(() => {
    syncTable();
  });
});

const onKeyDown = (event) => {
  if (event.key === "Escape") {
    table.value.exitFullscreen();
  }
};

function copyValueToClipboard(value, valueName) {
  copyToClipboard(value),
    $q.notify({
      message: valueName + " has been copied to clipboard.",
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
