<template>
  <div class="bg-transparent q-mr-sm q-ml-sm col-12 q-pl-lg q-pr-lg scroll">
    <q-table
      class="table"
      virtual-scroll
      :virtual-scroll-sticky-size-start="48"
      :rows-per-page-options="[20]"
      row-key="email"
      title="Mined emails"
      :loading="isLoading"
      :filter="filter"
      :filter-method="filterFn"
      :rows="rows"
      :columns="columns"
    >
      <template #top-right>
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

        <div class="q-px-sm">
          <q-btn
            color="teal-5"
            icon-right="archive"
            label="Export to csv"
            no-caps
            :disable="loadingStatusDns"
            @click="exportTable"
          />
        </div>
        <div>
          <q-btn
            color="teal-5"
            label="Refresh"
            icon="refresh"
            no-caps
            :disable="isLoading || loadingStatusDns"
            @click="fetchRefinedPersons"
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
            {{ tag }}
          </q-badge>
        </q-td>
      </template>

      <template #body-cell-name="props">
        <q-td :props="props">
          <q-expansion-item
            v-if="props.row.name && props.row.alternate_names.length > 1"
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
                return element != ' ';
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
          <q-badge rounded color="green">
            {{ " " }}
          </q-badge>
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { createClient } from "@supabase/supabase-js";
import exportFromJSON from "export-from-json";
import { useQuasar } from "quasar";
import { computed, ref } from "vue";
import { useStore } from "vuex";

const $q = useQuasar();
const $store = useStore();

const rows = ref([]);
const isLoading = ref(false);
const loadingStatusDns = computed(() => $store.state.example.loadingStatusDns);

const filter = ref("");

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_SECRET_PROJECT_TOKEN
);

// Potential solution for auto fetching of refined
//onMounted(() => {
//  setInterval(async () => {
//    await fetchRefinedPersons();
//  }, 3000);
//});

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
    format: (val) => new Date(val).toISOString().slice(0, 10),
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
    format: (val) => val.join(" "),
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

async function fetchRefinedPersons() {
  isLoading.value = true;
  const { data, error } = await supabase
    .from("refinedpersons")
    .select()
    .eq("userid", $store.state.example.userId);

  isLoading.value = false;

  if (error) {
    return $q.notify("Error when fetching refined emails.");
  }

  rows.value = data;
}

function exportTable() {
  try {
    exportFromJSON({
      data: rows.value.map((r) => {
        return {
          names: r.alternate_names.join(","),
          email: r.email,
          engagement: r.engagement,
          recency: r.recency,
          tags: r.tags.join(","),
        };
      }),
      fileName: "refined-persons",
      exportType: exportFromJSON.types.csv,
    });
    $q.notify("Successfully exported table.");
  } catch (error) {
    $q.notify("Error when exporting to CSV.");
  }
}
</script>

<style>
.table {
  /* height or max-height is important */
  height: 50vh;
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
