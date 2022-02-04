<template>
  <div class="row q-col-gutter-sm">
    <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
      <q-card class="text-grey-8">
        <q-card-section class="q-pa-none">
          <div class="row q-pa-sm" v-if="renderDialog">
            <div class="col-6 q-pa-sm">
              <q-card>
                <q-card-section class="bg-teal q-pa-sm text-white">
                  <div class="text-subtitle2">Fetch prefrences:</div>
                  <div class="text-caption">
                    Select box to fetch from, fileds to import
                  </div>
                </q-card-section>
                <div class="row q-pa-sm">
                  <div class="q-mt-md col-6">
                    <q-select
                      rounded
                      v-model="model"
                      :options="boxOptions"
                      label="Box"
                    >
                      <template v-slot:prepend>
                        <q-icon
                          style="font-size: 0.8em"
                          name="fas fa-box-open"
                        />
                      </template>
                    </q-select>
                  </div>
                  <div class="q-mt-md col-6"></div>

                  <div class="q-mt-md col-6">
                    <q-option-group
                      name="accepted_genres"
                      v-model="accepted"
                      :options="options1"
                      type="checkbox"
                      color="secondary"
                      inline
                    />
                  </div>
                  <div class="q-mt-md col-6">
                    <q-option-group
                      name="accepted_genres"
                      v-model="accepted"
                      :options="options2"
                      type="checkbox"
                      color="secondary"
                      inline
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

            <div class="q-mt-md col">
              <q-btn
                no-caps
                @click="fetchEmails"
                color="secondary"
                label="Get emails"
              />
            </div>
          </div>
          <q-dialog
            v-show="loadingStatus"
            v-model="loadingStatus"
            persistent
            transition-show="scale"
            transition-hide="scale"
          >
            <div
              class="z-max bg-transparent text-cyan-2 text-h4 q-ma-md q-pa-lg"
            >
              Fetching data...
              <q-spinner-gears color="cyan-2" size="5.5em" />
            </div>
          </q-dialog>
          <q-table
            title="Treats"
            dense
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
                color="secondary"
                icon-right="archive"
                label="Export to csv"
                no-caps
                @click="exportTable(Emails)"
              />
            </template>
          </q-table>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<script>
import { defineComponent, onMounted } from "vue";
import { exportFile, useQuasar } from "quasar";
import { ref } from "vue";
import { mapState } from "vuex";

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
    name: "desc",
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
  data() {
    return {
      renderDialog: false,
      email: "",
      password: "",
      host: "",
      port: "",
      accepted: ref([]),
      options1: [
        {
          label: "From",
          value: "rock",
        },
        {
          label: "To",
          value: "funk",
        },
        {
          label: "Cc",
          value: "pop",
        },
      ],
      boxOptions: [],
      options2: [
        {
          label: "Bcc",
          value: "pop",
        },
        {
          label: "Subject",
          value: "pop",
        },
        {
          label: "Date",
          value: "pop",
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
  computed: {
    Emails() {
      return [...this.retrievedEmails];
    },
    ...mapState("example", ["retrievedEmails", "loadingStatus", "boxes"]),
  },
  methods: {
    fetchEmails() {
      this.persistent = true;
      this.$store.dispatch("example/getEmails");
    },
  },
  mounted() {
    this.boxOptions = this.$store.getters["example/getBoxes"];
    this.renderDialog = true;
  },
  setup(props) {
    const $q = useQuasar();
    const filter = ref("");
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
      promptt($q);
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
