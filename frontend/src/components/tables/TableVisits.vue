<template>
  <div class="row q-col-gutter-sm">
    <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
      <q-card-section class="q-pa-none">
        <div class="row q-pa-sm" v-if="renderDialog">
          <div class="bg-stransparent q-mr-sm col-6 q-pa-sm">
            <q-card>
              <q-card-section class="bg-tealgradient q-pa-sm text-white">
                <div class="text-h5 text-bold">Prefrences</div>
                <div class="text-caption">
                  Select box to fetch from, fileds to import
                </div>
              </q-card-section>
              <div class="text-custom row q-pa-sm">
                <div class="bg-grey-1 border q-pa-md col-5">
                  <div class="text-subtitle2 text-bold">Select a mailbox</div>
                  <q-select
                    ref="boxesOpen"
                    rounded
                    v-model="selectedBox"
                    :options="boxes"
                    label="Mailbox"
                  >
                    <template v-slot:prepend>
                      <q-icon
                        style="font-size: 0.8em"
                        class="text-teal"
                        name="fas fa-box-open"
                      />
                    </template>
                    <template v-slot:append>
                      <q-avatar>
                        <q-spinner-pie
                          v-if="this.loadingStatusbox"
                          color="primary"
                          size="2em"
                        />
                      </q-avatar>
                      <q-btn round dense flat icon="add" @click="getBoxes"
                        ><q-tooltip
                          v-if="showing"
                          v-model="showing"
                          :offset="[20, 29]"
                          anchor="top middle"
                          class="bg-orange-9 text-body2"
                        >
                          Select a Mailbox
                        </q-tooltip></q-btn
                      >
                    </template>
                  </q-select>
                </div>
                <div class="col"></div>

                <div class="bg-grey-1 border q-pa-md q-ml-sm col-6">
                  <div class="text-subtitle2 text-bold">Select fields</div>
                  <q-option-group
                    class="text-cyan-10"
                    name="accepted_genres"
                    v-model="accepted"
                    :options="options1"
                    type="checkbox"
                    color="secondary"
                    inline
                  />
                  <q-option-group
                    class="text-cyan-10"
                    name="accepted_genres"
                    v-model="accepted"
                    :options="options2"
                    type="checkbox"
                    color="secondary"
                    inline
                  />
                </div>

                <div class="q-mt-md col-6">
                  <q-btn
                    no-caps
                    @click="fetchEmails"
                    class="bg-buttons text-white"
                    label="Get emails"
                  />
                </div>
              </div>
            </q-card>
          </div>
          <div class="bg-transparent q-md col">
            <div class="row q-pa-sm">
              <div class="q-md col-12">
                <card-social
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
import {
  watchEffect,
  defineComponent,
  defineAsyncComponent,
  onMounted,
  getCurrentInstance,
} from "vue";
import { exportFile, useQuasar } from "quasar";
import { ref } from "vue";
import { mapGetters, mapState } from "vuex";

function wrapCsvValue(val, formatFn) {
  let formatted = formatFn !== void 0 ? formatFn(val) : val;

  formatted =
    formatted === void 0 || formatted === null ? "" : String(formatted);

  formatted = formatted.split('"').join('""');
  /**
   * Excel accepts \n and \r in strings, but some other CSV parsers do not
   * Uncomment the next two lines to escape new lines
   */
  // .split('\n').join('\\n')
  // .split('\r').join('\\r')

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
    CardSocial: defineAsyncComponent(() => import("../cards/CardSocial.vue")),
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
      emails: [],
      password: "",
      host: "",
      port: "",
      accepted: ref([]),
      selectedBox: "",
      options1: [
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
      ],
      boxOptions: [],
      options2: [
        {
          label: "Bcc",
          value: "BCC",
        },
        {
          label: "Body",
          value: "TEXT",
        },
      ],
    };
  },

  props: {
    emails: Array,
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
  watch: {
    boxes: function () {
      this.$refs.boxesOpen.showPopup();
    },
  },
  methods: {
    splitEmails(data) {
      if (!data.split("<")[1]) {
        return data;
      }
      return data.split("<")[1];
    },
    splitAliases(data) {
      return data.split("<")[0];
    },
    fetchEmails: function () {
      const box = { boxe: this.selectedBox };
      console.log(this.options1);
      console.log(this.$store.state);
      let data = {
        box: this.selectedBox,
        SessionId: this.$store.state.socketId,
      };
      this.$store.dispatch("example/getEmails", { data }).then(() => {});
    },
    getBoxes() {
      this.$store.dispatch("example/getBoxes").then(() => {
        this.$refs.boxesOpen.showPopup();
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
    this.boxOptions = this.$store.state.boxes;
    this.renderDialog = true;

    setTimeout(() => {
      this.showing = true;
    }, 1000);
    setTimeout(() => {
      this.showing = false;
    }, 3000);
    // this.$socket.on("uploadProgress", (data) => {
    //   console.log(data);
    // });
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
      console.log(this.progress);
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
      to: ref(false),
      from: ref(false),
      Bcc: ref(false),
      Cc: ref(false),
      subject: ref(false),
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
