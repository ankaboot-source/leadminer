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
                    rounded
                    v-model="selectedBox"
                    :options="boxes"
                    label="Box"
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
                      <q-btn round dense flat icon="add" @click="getBoxes" />
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
          <!-- <div class="q-mt-md col-6">
              <div class="q-gutter-sm">
                <q-checkbox
                  keep-color
                  v-model="from"
                  label="From"
                  color="secondary"
                />
                <q-checkbox
                  keep-color
                  v-model="to"
                  label="To"
                  color="secondary"
                />
                <q-checkbox
                  keep-color
                  v-model="Cc"
                  label="Cc"
                  color="secondary"
                />
                <q-checkbox
                  keep-color
                  v-model="Bcc"
                  label="Bcc"
                  color="secondary"
                />
                <q-checkbox
                  keep-color
                  v-model="subject"
                  label="subject"
                  color="secondary"
                />
              </div></div> -->

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
        <q-dialog
          v-show="loadingStatus"
          v-model="loadingStatus"
          persistent
          transition-show="scale"
          transition-hide="scale"
        >
          <div class="z-max bg-transparent text-cyan-2 text-h4 q-ma-md q-pa-lg">
            Fetching data...
            <q-linear-progress size="32px" :value="progress" color="teal">
              <div class="absolute-full flex flex-center">
                <q-badge
                  color="teal"
                  text-color="white"
                  :label="progressLabel"
                />
              </div>
            </q-linear-progress>
          </div>
        </q-dialog>
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
            <template v-slot:body-cell-from="props">
              <q-td :props="props">
                <q-item>
                  <q-item-section>
                    <q-item-label>{{ props.row.from[0] }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-td>
            </template>
            <template v-slot:body-cell-to="props">
              <q-td :props="props">
                <q-item>
                  <q-item-section>
                    <q-item-label>{{ props.row.to[0] }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-td>
            </template>
            <template v-slot:body-cell-subject="props">
              <q-td :props="props" class="text-left">
                <q-chip
                  class="text-white text-capitalize"
                  :label="props.row.subject[0]"
                  color="secondary"
                ></q-chip>
              </q-td>
            </template>
            <template v-slot:body-cell-date="props">
              <q-td :props="props" class="text-left">
                <q-chip
                  class="text-white text-capitalize"
                  :label="props.row.date[0]"
                  color="secondary"
                ></q-chip>
              </q-td>
            </template>
          </q-table>
        </div>
      </q-card-section>
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
  { name: "to", align: "left", label: "To", field: "to", sortable: true },
  { name: "from", align: "left", label: "From", field: "from", sortable: true },
  {
    name: "subject",
    required: true,
    label: "Subject",
    align: "left",
    field: (row) => row.subject,
    sortable: true,
  },
  {
    name: "date",
    align: "left",
    label: "Date",
    field: "date",
    sortable: true,
  },
];
const rows = [
  {
    id: "U0001",
    name: "/login",
    date: "12-10-2019",
    user_name: "Pratik Patel",
  },
  {
    id: "U0002",
    name: "/Dashboard",
    date: "11-02-2019",
    user_name: "Razvan Stoenescu",
  },
  {
    id: "U0003",
    name: "/Map",
    date: "03-25-2019",
    user_name: "Pratik Patel",
  },
  {
    id: "U0004",
    name: "/Mail",
    date: "03-18-2019",
    user_name: "Jeff Galbraith",
  },
  {
    id: "U0005",
    name: "/Profile",
    date: "04-09-2019",
    user_name: "Pratik Patel",
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
      progressLabel: "",
      email: "",
      password: "",
      host: "",
      port: "",
      accepted: ref([]),
      selectedBox: "",
      options1: [
        {
          label: "From",
          value: "from",
        },
        {
          label: "To",
          value: "to",
        },
        {
          label: "Cc",
          value: "cc",
        },
      ],
      boxOptions: [],
      options2: [
        {
          label: "Bcc",
          value: "bcc",
        },
        {
          label: "Body",
          value: "body",
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
    fetchEmails: function () {
      const box = { boxe: this.selectedBox };
      console.log(this.$store.state);
      let data = {
        box: this.selectedBox,
        SessionId: this.$store.state.socketId,
      };
      this.$store.dispatch("example/getEmails", { data }).then(() => {});
    },
    getBoxes() {
      this.$store.dispatch("example/getBoxes").then(() => {});
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
    // this.$socket.on("uploadProgress", (data) => {
    //   console.log(data);
    // });
  },
  created() {
    this.$socket.on("totalMessages", (data) => {
      this.total = data;
    });
    this.$socket.on("uploadProgress", (data) => {
      this.progress = Math.round((((data / this.total) * 100) / 100) * 10) / 10;
      console.log(this.progress);
      this.progressLabel = data + "email fetched from total: " + this.total;
    });
  },
  setup() {
    const $q = useQuasar();
    const filter = ref("");
    const progress = ref("");

    const promptt = () => {
      $q.dialog({
        // title: "We need to verify mailbox existance first",
        // message: "Email address",
        // model: [],
        //   // inline: true,
        //   items: [
        //     { label: 'Option 1', value: 'opt1', color: 'secondary' },
        //     { label: 'Option 2', value: 'opt2' },
        //     { label: 'Option 3', value: 'opt3' }
        //   ]
        // prompt: {
        //   model: "",
        //   isValid: (val) => val.length > 10 && val.includes("@"), // << here is the magic
        //   type: "text", // optional
        // },
        // ok: {
        //   push: true,
        //   color: "secondary",
        // },
        // cancel: {
        //   push: true,
        //   color: "negative",
        // },
        persistent: true,
      }).onOk((data) => {
        // console.log('>>>> OK, received', data)
      });
    };
    onMounted(() => {
      //promptt($q);
    });
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
          .concat(
            Emails.map((row) =>
              columns
                .map((col) =>
                  wrapCsvValue(
                    typeof col.field === "function"
                      ? col.field(row)
                      : row[col.field === void 0 ? col.name : col.field],
                    col.format
                  )
                )
                .join(",")
            )
          )
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
</style>
