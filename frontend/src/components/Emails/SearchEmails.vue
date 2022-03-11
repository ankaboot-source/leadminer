<template>
  <div class="row q-col-gutter-sm">
    <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
      <q-card-section class="q-pa-none">
        <div v-if="renderDialog" class="row q-pa-sm">
          <div class="bg-stransparent q-mr-sm col-7 q-pa-sm">
            <q-card>
              <q-card-section class="bg-tealgradient q-pa-sm text-white">
                <div class="text-h5 text-bold">Preferences</div>
                <div class="text-caption" />
              </q-card-section>
              <div class="text-custom row q-pa-sm">
                <div class="bg-grey-1 border q-pa-md col-6">
                  <div class="text-h6 text-bold">Select mailbox folders</div>
                  <q-checkbox
                    v-model="all"
                    color="orange-10"
                    class="text-subtitle2 text-orange-8"
                    label="Select all "
                    @click="checkAll(boxes)"
                  />
                  <q-tree
                    ref="tree"
                    v-model:ticked="selectedBoxes"
                    v-model:selected="selected"
                    v-model:expanded="expanded"
                    class="col-12 col-sm-6"
                    :nodes="boxes"
                    node-key="label"
                    color="teal"
                    tick-strategy="strict"
                  />
                </div>
                <div class="col" />

                <div class="bg-grey-1 border q-pa-md q-ml-sm col-5">
                  <div class="text-h6 text-bold">Select fields</div>
                  <div
                    class="text-subtitle2 shadow-2 bborder q-pa-sm text-orange-8"
                  >
                    Header

                    <q-option-group
                      v-model="acceptedHeaders"
                      class="text-cyan-10"
                      name="accepted_genres"
                      :options="optionsHeaderFields"
                      type="checkbox"
                      color="secondary"
                      inline
                    />
                  </div>
                  <div
                    class="text-subtitle2 q-pa-sm q-mt-sm shadow-2 bborder text-orange-8"
                  >
                    Body

                    <q-option-group
                      v-model="acceptedBody"
                      class="text-cyan-10"
                      name="accepted_genres"
                      :options="optionsBody"
                      type="checkbox"
                      color="secondary"
                      inline
                    />
                  </div>
                </div>
                <div class="column col-12">
                  <div class="col-6" />
                  <div class="q-mt-md q-ml-lg col-12">
                    <q-btn
                      no-caps
                      class="bg-buttons text-white"
                      label="Collect emails adresses"
                      @click="fetchEmails"
                    />
                  </div>
                </div>
              </div>
            </q-card>
          </div>
          <div class="bg-transparent q-md col">
            <div class="row q-pa-sm">
              <div class="q-md col-12">
                <count-card
                  icon_position="left"
                  :collected-emails="retrievedEmails.length"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="bg-transparent q-ma-sm col-12 q-pa-sm">
          <q-table
            card-class="bg-white text-teal-10"
            table-class="text-teal-10"
            table-header-class="text-teal"
            title="Emails"
            :rows="Emails"
            :columns="columns"
            :filter="filter"
            :filter-method="filterMethod"
            row-key="email"
          >
            <template #top-right="props">
              <q-input
                v-model="filter"
                rounded
                dense
                standout
                bg-color="teal-4"
                debounce="300"
                placeholder="Search"
              >
                <template #append>
                  <q-icon name="search" />
                </template>
              </q-input>

              <q-btn
                v-if="mode === 'list'"
                flat
                round
                dense
                :icon="props.inFullscreen ? 'fullscreen_exit' : 'fullscreen'"
                class="q-px-sm"
                @click="props.toggleFullscreen"
              >
                <q-tooltip v-close-popup :disable="$q.platform.is.mobile">
                  {{
                    props.inFullscreen ? "Exit Fullscreen" : "Toggle Fullscreen"
                  }}
                </q-tooltip>
              </q-btn>

              <q-btn
                class="bg-buttons text-white"
                icon-right="archive"
                label="Export to csv"
                no-caps
                @click="exportTable(Emails)"
              />
            </template>
            <template #body="props">
              <q-tr :props="props">
                <q-td key="Emails" style="width: 30%" :props="props">
                  {{ props.row.address }}
                </q-td>
                <q-td key="Names" style="width: 30%" :props="props">
                  {{ props.row.name ? props.row.name : "" }}
                </q-td>

                <q-td key="Domain" style="width: 30%" :props="props">
                  <q-badge v-if="props.row.domain == 'Valid'" color="green">
                    Valid
                  </q-badge>
                  <q-badge v-else color="red"> Invalid </q-badge>
                </q-td>
              </q-tr>
            </template>
          </q-table>
        </div>
      </q-card-section>
      <q-dialog
        v-show="loadingStatus"
        v-model="loadingStatus"
        persistent
        transition-show="scale"
        transition-hide="scale"
      >
        <q-card class="bg-white q-pa-lg" style="width: 80vw">
          <div
            class="z-max bg-transparent text-teal text-h5 text-bold q-ma-md text-center"
          >
            Fetching data...<br />

            <q-badge class="text-h6" color="teal-3">
              Analysing mailfolder: {{ currentBox }} </q-badge
            ><br />
            {{ dataCleaning }}
          </div>
          <q-linear-progress size="32px" :value="progress" color="teal-10">
            <div
              class="absolute-full bg-transparent text-teal text-h5 flex flex-center"
            >
              {{ progressLabel }}
            </div>
          </q-linear-progress>
        </q-card>
      </q-dialog>
    </div>
  </div>
</template>

<script>
import { defineComponent, defineAsyncComponent } from "vue";
import { exportFile, useQuasar } from "quasar";
import { ref } from "vue";
import { mapState } from "vuex";

const columns = [
  {
    name: "Emails",
    align: "left",
    label: "Emails",
    field: "address",
    sortable: true,
  },
  {
    name: "Names",
    align: "left",
    label: "Names",
    field: "name",
    sortable: true,
  },
  {
    name: "Domain",
    align: "left",
    label: "Domain",
    field: "domain",
    sortable: true,
  },
];

export default defineComponent({
  name: "TableVisits",
  components: {
    CountCard: defineAsyncComponent(() => import("../cards/CountCard.vue")),
  },

  setup() {
    const $q = useQuasar();
    const filter = ref("");

    return {
      filter,
      mode: "list",
      columns,
      pagination: {
        rowsPerPage: 10,
      },
      persistent: ref(false),
      selected: ref([]),
      ticked: ref([]),
      expanded: ref([]),

      exportTable(Emails) {
        let csv = '"""Name""","""Email""","""Type"""\n';
        let emailsCsv = Emails;
        let obj = { name: "" };
        let emailstoExport = emailsCsv.map((element) => {
          if (!("name" in element)) {
            element = { ...obj, ...element };
            return element;
          }
          return element;
        });
        emailstoExport.forEach((row) => {
          csv += Object.values(row).join(",");
          csv += "\n";
        });

        const status = exportFile("Emails.csv", csv, "text/csv");

        if (status !== true) {
          $q.notify({
            message: "Browser denied file download...",
            color: "negative",
            icon: "warning",
          });
        }
      },
    };
  },
  data() {
    return {
      renderDialog: false,
      progress: 0,
      total: 0,
      showing: false,
      progressLabel: "",
      email: "",
      boxess: [],
      queue: [],
      render: false,
      dataCleaning: "",
      currentBox: "",
      all: false,
      emails: [],
      password: "",
      host: "",
      port: "",
      acceptedHeaders: ref([]),
      acceptedBody: ref([]),
      selectedBoxes: [],
      optionsHeaderFields: [
        {
          label: "From",
          value: "FROM",
        },
        {
          label: "To",
          value: "TO",
        },
        {
          label: "Cc",
          value: "CC",
        },
        {
          label: "Bcc",
          value: "BCC",
        },
        {
          label: "Reply-to",
          value: "REPLY-TO",
        },
      ],
      boxOptions: [],
      optionsBody: [
        {
          label: "Body",
          value: "TEXT",
        },
      ],
    };
  },

  ...mapState("example", [
    "retrievedEmails",
    "loadingStatus",
    "loadingStatusbox",
    "boxes",
  ]),
  computed: {
    Emails() {
      return [...this.retrievedEmails];
    },
    boxes() {
      return [...this.boxes];
    },
    ...mapState("example", [
      "retrievedEmails",
      "loadingStatus",
      "loadingStatusbox",
      "boxes",
    ]),
  },

  mounted() {
    //const SessionId = Math.random().toString(36).substr(2, 9);

    this.getBoxes();
    this.boxOptions = this.$store.state.boxes;
    this.renderDialog = true;

    setTimeout(() => {
      this.showing = true;
    }, 1000);
    setTimeout(() => {
      this.showing = false;
    }, 3000);
  },

  unmounted() {
    this.$socket.close();
  },
  created() {
    this.$socket.on("totalMessages", (data) => {
      this.total = data.total;
      this.progress = 0;
    });
    this.$socket.on("connect_error", (data) => {
      console.log(data);
    });
    this.$socket.on("dataCleaning", () => {
      this.dataCleaning = "Cleaning data";
    });
    this.$socket.on("duplicates", () => {
      this.dataCleaning = "Removing duplicates";
    });
    this.$socket.on("progress", (data) => {
      let percentage = Math.round((data * 100) / this.total);
      this.progress = Math.round((data * 100) / this.total) / 100;
      this.progressLabel = this.progress + "%";
    });

    this.$socket.on("switching", (data) => {
      this.queue.push(data);
      this.progress = 0;
      this.progressLabel = "";
    });

    this.$socket.on("boxName", (data) => {
      this.currentBox = data;
    });
  },
  beforeUnmount() {
    this.$socket.close();
    console.log("closed");
  },

  methods: {
    filterMethod(rows, term) {
      if (rows.filter((e) => e.domain.includes(term)).length > 0) {
        console.log(term);
        return this.Emails;
      } else {
        return rows.filter((e) => {
          if (typeof e.name == "undefined") {
            return e.address.includes(term);
          } else {
            return e.address.includes(term) || e.name.includes(term);
          }
        });
      }
    },
    checkAll(allboxes) {
      let arr = [];
      function deepObject(obj) {
        for (let ele in obj) {
          if (obj[ele].label) {
            console.log(obj[ele].label);
            arr.push(obj[ele].label);
          }
          if (obj[ele].children) {
            obj[ele].children.map((v) => {
              deepObject([v]);
            });
          }
        }
        return arr;
      }
      if (this.selectedBoxes.length == 0) {
        this.selectedBoxes = deepObject([...allboxes]);
        console.log(this.selectedBoxes);
      } else {
        this.selectedBoxes = [];
      }
    },

    fetchEmails() {
      var fields = [];
      var bot = this.boxess;
      //  default if nothing is selected
      if (this.acceptedBody.length == 0 && this.acceptedHeaders.length == 0) {
        fields = "HEADER.FIELDS (FROM TO CC BCC),TEXT";
      } else {
        this.acceptedBody.length == 0
          ? (fields = `HEADER.FIELDS (${this.acceptedHeaders.join(" ")})`)
          : (fields = `HEADER.FIELDS (${this.acceptedHeaders.join(" ")}),${
              this.acceptedBody[0]
            }`);
      }
      let data = {
        boxes: this.selectedBoxes,
        fields: fields,
        folders: bot,
      };

      this.$store.dispatch("example/getEmails", { data }).then(() => {
        this.total = 0;
        this.dataCleaning = "";
        this.progress = 0;
        this.progressLabel = "";
      });
    },
    getBoxes() {
      this.$store.dispatch("example/getBoxes").then(() => {});
    },
  },
});
</script>
<style>
.bborder {
  border: 1px solid transparent;
  border-radius: 12px;
}
.text-Corange {
  color: #fc9958 !important;
}
.bg-tealgradient {
  background-color: #89d8d3;
  background-image: linear-gradient(315deg, #89d8d3 0%, #03c8a8 74%);
}
.text-tealgradient {
  color: #89d8d3;
}
.bg-buttons {
  background-color: #89d8d3;
  background-image: linear-gradient(315deg, #89d8d3 0%, #03c8a8 74%);
}
.bg-fetch {
  background-color: #deebdd;
  background-image: linear-gradient(315deg, #deebdd 0%, #bbdbbe 74%);
}
</style>
