<template>
  <div class="row q-col-gutter-sm">
    <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
      <q-card-section class="q-pa-none">
        <div class="row q-pa-sm" v-if="renderDialog">
          <div class="bg-stransparent q-mr-sm col-7 q-pa-sm">
            <q-card>
              <q-card-section class="bg-tealgradient q-pa-sm text-white">
                <div class="text-h5 text-bold">Preferences</div>
                <div class="text-caption"></div>
              </q-card-section>
              <div class="text-custom row q-pa-sm">
                <div class="bg-grey-1 border q-pa-md col-6">
                  <div class="text-h6 text-bold">Select a mailbox</div>

                  <q-select
                    ref="select"
                    filled
                    v-model="selectedBoxes"
                    multiple
                    :options="boxes"
                    use-chips
                    editable="true"
                    stack-label
                    @input="$refs.select.hidePopup()"
                    label="Mailbox files"
                    ><template #before-options>
                      <q-item>
                        <q-item-section>
                          <q-item-label>All mailbox files</q-item-label>
                        </q-item-section>
                        <q-item-section side>
                          <q-checkbox
                            color="secondary"
                            v-model="all"
                            @click="checkAll(boxes)"
                          ></q-checkbox>
                        </q-item-section>
                      </q-item> </template
                    ><q-tooltip
                      v-if="showing"
                      v-model="showing"
                      :offset="[10, 10]"
                      anchor="bottom middle"
                      class="bg-orange-9 text-body2"
                    >
                      Select a Mailbox
                    </q-tooltip>
                    <q-avatar>
                      <q-spinner-orbit
                        v-if="this.loadingStatusbox"
                        color="teal"
                        size="1.5em"
                      />
                    </q-avatar>
                  </q-select>
                </div>
                <div class="col"></div>

                <div class="bg-grey-1 border q-pa-md q-ml-sm col-5">
                  <div class="text-h6 text-bold">Select fields</div>
                  <div
                    class="text-subtitle2 shadow-2 bborder q-pa-sm text-orange-8"
                  >
                    Header

                    <q-option-group
                      class="text-cyan-10"
                      name="accepted_genres"
                      v-model="acceptedHeaders"
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
                      class="text-cyan-10"
                      name="accepted_genres"
                      v-model="acceptedBody"
                      :options="optionsBody"
                      type="checkbox"
                      color="secondary"
                      inline
                    />
                  </div>
                </div>
                <div class="column col-12">
                  <div class="col-6"></div>
                  <div class="q-mt-md q-ml-lg col-12">
                    <q-btn
                      no-caps
                      @click="fetchEmails"
                      class="bg-buttons text-white"
                      label="Collect emails adresses"
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
                  :collectedEmails="retrievedEmails.length"
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
            row-key="name"
          >
            <template v-slot:top-right="props">
              <q-input
                borderless
                dense
                debounce="300"
                v-model="filter"
                placeholder="Search"
              >
                <template v-slot:append>
                  <q-icon name="search" />
                </template>
              </q-input>

              <q-btn
                flat
                round
                dense
                :icon="props.inFullscreen ? 'fullscreen_exit' : 'fullscreen'"
                @click="props.toggleFullscreen"
                v-if="mode === 'list'"
                class="q-px-sm"
              >
                <q-tooltip :disable="$q.platform.is.mobile" v-close-popup
                  >{{
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
            <template v-slot:body="props">
              <q-tr :props="props">
                <q-td key="Emails" :props="props">
                  {{ splitEmails(props.row) }}
                </q-td>
                <q-td key="Aliases" :props="props">
                  <q-badge color="orange-10">
                    {{ splitAliases(props.row) }}
                  </q-badge>
                </q-td>
                <q-td key="verification" :props="props">
                  <q-badge color="green"> Verification </q-badge>
                </q-td></q-tr
              >
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
            {{ dataCleaning }}
          </div>
          <q-linear-progress size="32px" :value="progress" color="teal-10">
            <div
              class="absolute-full bg-transparent text-teal text-h5 flex flex-center"
            >
              {{ progressLabel }}
            </div>
          </q-linear-progress></q-card
        >
      </q-dialog>
    </div>
  </div>
</template>

<script>
import { defineComponent, defineAsyncComponent } from "vue";
import { exportFile, useQuasar } from "quasar";
import { ref } from "vue";
import { mapState } from "vuex";

function wrapCsvValue(val, formatFn) {
  let formatted = formatFn !== void 0 ? formatFn(val) : val;

  formatted =
    formatted === void 0 || formatted === null ? "" : String(formatted);

  formatted = formatted.split('"').join('""');

  return `"${formatted}"`;
}

const columns = [
  {
    name: "Emails",
    align: "left",
    label: "Emails",
    field: "Emails",
    sortable: true,
  },
  {
    name: "Aliases",
    align: "left",
    label: "Aliases",
    field: "Aliases",
    sortable: true,
  },
  {
    name: "verification",
    align: "left",
    label: "Verification",
    field: "verification",
    sortable: true,
  },
];

export default defineComponent({
  components: {
    CountCard: defineAsyncComponent(() => import("../cards/CountCard.vue")),
  },
  data() {
    return {
      renderDialog: false,
      progress: 0,
      total: 0,
      showing: false,
      progressLabel: "",
      email: "",
      dataCleaning: "",
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
  name: "TableVisits",

  // props : ['emails'],
  // mounted(){
  //   console.log(emails)
  // },
  ...mapState("example", [
    "retrievedEmails",
    "loadingStatus",
    "loadingStatusbox",
    "boxes",
  ]),
  computed: {
    Emails() {
      this.emails = [...this.retrievedEmails];
      return [...this.retrievedEmails];
    },
    ...mapState("example", [
      "retrievedEmails",
      "loadingStatus",
      "loadingStatusbox",
      "boxes",
    ]),
  },

  methods: {
    checkAll(allboxes) {
      if (this.selectedBoxes.length != allboxes.length) {
        this.selectedBoxes = allboxes;
      } else {
        this.selectedBoxes = [];
      }
      this.$refs.select.hidePopup();
    },
    splitEmails(data) {
      if (!data.split("<")[1]) {
        return data;
      }
      return data.split("<")[1];
    },
    splitAliases(data) {
      return data.split("<")[0];
    },
    fetchEmails() {
      var fields = [];
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
        SessionId: this.$store.state.socketId,
        fields: fields,
      };
      console.log(fields);

      this.$store.dispatch("example/getEmails", { data }).then(() => {
        this.total = 0;
        this.dataCleaning = "";
        this.progress = 0;
        this.progressLabel = "";
      });
    },
    getBoxes() {
      this.$store.dispatch("example/getBoxes").then(() => {
        this.$refs.select.showPopup();
      });
    },
  },
  // watch:{
  //   '$store.state.progress': {
  //     handler() {
  //       console.log(data)
  //     },
  //     immediate: true
  //   }

  // },
  mounted() {
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
  created() {
    this.$socket.on("totalMessages", (data) => {
      this.total = data;
    });
    this.$socket.on("dataCleaning", (data) => {
      this.dataCleaning = "Cleaning data";
    });
    this.$socket.on("duplicates", (data) => {
      this.dataCleaning = "Removing duplicates";
    });
    this.$socket.on("uploadProgress", (data) => {
      this.progress = Math.round((((data / this.total) * 100) / 100) * 10) / 10;
      this.progressLabel = data + " email fetched from total: " + this.total;
    });
  },
  setup() {
    const $q = useQuasar();
    const filter = ref("");
    const progress = ref("");

    return {
      filter,
      mode: "list",
      columns,
      pagination: {
        rowsPerPage: 10,
      },
      persistent: ref(false),

      exportTable(Emails) {
        // naive encoding to csv format
        const content = [columns.map((col) => wrapCsvValue(col.label))]
          .concat(Emails.map((row) => row))
          .join("\r\n");

        const status = exportFile("table-export.csv", content, "text/csv");

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
