<template>
  <div
    class="bg-transparent q-mr-sm q-ml-sm col-12 q-pl-lg q-pr-lg scroll container"
  >
    <q-table
      class="table"
      virtual-scroll
      :virtual-scroll-sticky-size-start="48"
      :rows-per-page-options="[150, 500, 1000]"
      row-key="email"
      title="Mined emails"
      :loading="isLoading"
      :filter="filter"
      :filter-method="filterFn"
      :rows="rows"
      :columns="columns"
      :pagination="initialPagination"
    >
      <template #top-right="props">
        <q-input
          v-model="filter"
          rounded
          dense
          standout
          bg-color="teal-4"
          class="q-px-sm"
          debounce="300"
          placeholder="Search"
        >
          <template #append>
            <q-icon name="search" />
          </template>
        </q-input>

        <q-btn
          flat
          round
          dense
          :icon="props.inFullscreen ? 'fullscreen_exit' : 'fullscreen'"
          class="q-px-sm"
          @click="props.toggleFullscreen"
        >
          <q-tooltip v-close-popup :disable="$q.platform.is.mobile">
            {{ props.inFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen" }}
          </q-tooltip>
        </q-btn>

        <div class="q-px-sm">
          <q-btn
            color="teal-5"
            icon-right="archive"
            label="Export to csv"
            no-caps
            :disable="isExportDisabled"
            @click="exportTable"
          />
        </div>
        <div>
          <q-btn
            color="teal-5"
            label="Refresh"
            icon="refresh"
            no-caps
            :disable="isLoading"
            @click="updateRefinedPersons"
          />
        </div>
        <div class="q-pl-sm">
          <q-btn
            color="teal-5"
            label="Fetch"
            icon="factory"
            no-caps
            :disable="isLoading"
            @click="fetchRefined"
          />
        </div>
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
      <template #body-cell-tags="props">
        <q-td :props="props">
          <q-badge v-for="tag in props.row.tags" :key="tag" color="teal">
            {{ tag }} <br />
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
import { getLocalizedCsvSeparator } from "src/helpers/csv-helpers";
import { useQuasar } from "quasar";
import { computed, onUnmounted, ref, onMounted } from "vue";
import { useStore } from "vuex";

const $q = useQuasar();
const $store = useStore();

const rows = ref([]);
const filter = ref("");
const isLoading = ref(false);
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

const refreshInterval = setInterval(() => {
  if (
    $store.getters["example/getRetrievedEmails"].length > rows.value.length ||
    rows.value.some((el) => el.engagement === undefined)
  ) {
    updateRefinedPersons();
  }
}, 3000);

onUnmounted(() => {
  clearInterval(refreshInterval);
});

const columns = [
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
    label: "Names",
    field: "name",
    sortable: true,
    align: "left",
    sort: (a, b) => {
      return b.localeCompare(a);
    },
  },
  {
    name: "occurrence",
    label: "Occurrence",
    field: "occurence",
    align: "center",
    sortable: true,
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
    label: "Type",
    align: "center",
    field: "tags",
  },
  {
    name: "status",
    label: "Status",
    align: "center",
  },
];

function filterFn(rows, term) {
  return rows.filter((r) => r.email.toLowerCase().includes(term.toLowerCase()));
}

function updateRefinedPersons() {
  isLoading.value = true;
  rows.value = $store.getters["example/getRetrievedEmails"];
  isLoading.value = false;
}

async function fetchRefined() {
  isLoading.value = true;
  await $store.dispatch("example/fetchRefinedPersons");
  rows.value = $store.getters["example/getRetrievedEmails"];
  isLoading.value = false;
}

function exportTable() {
  if (!rows.value.length) {
    $q.notify("There are no contacts present in the table.");
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
          alternateNames: r.alternate_names.filter((name) => {
            return name.trim() !== '' && name !== r.name;
          }).join("\n"),
          email: r.email,
          engagement: r.engagement,
          recency: new Date(r.recency).toISOString().slice(0, 10),
          tags: r.tags.join("\n"),
        };
      }),
      fileName,
      withBOM: true,
      exportType: exportFromJSON.types.csv,
      delimiter: getLocalizedCsvSeparator(),
    });
    $q.notify("Successfully exported table.");
  } catch (error) {
    $q.notify("Error when exporting to CSV.");
  }
}
onMounted(() => {
  setTimeout(() => {
    fetchRefined();
  });
});
</script>

<style>
.container {
  height: 50vh;
}
.table {
  height: 100%;
}
.q-table__top,
  .q-table__bottom,
  thead tr:first-child th /* bg color is important for th; just specify one */ {
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
