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
                  <q-tree
                    ref="tree"
                    v-model:ticked="selectedBoxes"
                    v-model:selected="selected"
                    v-model:expanded="expanded"
                    :default-expand-all="true"
                    class="col-12 col-sm-6"
                    :nodes="Boxes"
                    node-key="label"
                    color="teal"
                    tick-strategy="strict"
                    ><template v-slot:header-generic="prop">
                      <div class="row items-center">
                        <q-icon
                          :name="
                            Scanned.includes(prop.node.label) ? 'check' : ''
                          "
                          color="orange"
                          size="28px"
                          class="q-mr-sm"
                        />
                        <div class="text-weight-bold text-primary">
                          {{ prop.node.label }}
                        </div>
                      </div>
                    </template></q-tree
                  >
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
                  <div class="q-mt-md q-ml-lg col-6">
                    <q-btn
                      v-bind:disable="loadingStatusDns"
                      no-caps
                      color="teal-5"
                      label="Collect emails addresses"
                      @click="fetchEmails()"
                    ></q-btn>
                    <q-btn
                      class="q-ma-md"
                      no-caps
                      color="red-5"
                      label="Stop mining"
                      @click="cancelFetchEmails()"
                    ></q-btn>
                  </div>
                </div>
              </div>
            </q-card>
          </div>
          <div class="bg-transparent q-md col">
            <div class="row">
              <div class="q-md col-12">
                <count-card
                  icon_position="left"
                  :collected-emails="Emails.length"
                />
              </div>
              <div class="row q-md col-12">
                <progress-card
                  :collectedEmails="Emails"
                  :loadingStatusDns="loadingStatusDns"
                  :scannedEmails="ScannedEmails"
                  :totalEmails="TotalEmails"
                />
              </div>
            </div>
          </div>
        </div>

        <div
          class="bg-transparent q-mr-sm q-ml-sm col-12 q-pl-lg q-pr-lg scroll"
        >
          <q-table
            class="sticky"
            card-class="bg-white  text-teal-10"
            table-class="text-teal-10 "
            table-header-class="text-teal"
            title="Emails"
            :rows="emailsinfinit"
            :binary-state-sort="true"
            :columns="columns"
            :filter="filter"
            :filter-method="filterMethod"
            row-key="email"
            column-sort-order="ad"
            :pagination.sync="pagination"
            ><template #top-left>
              <div class="row">
                <div
                  class="border col-4 q-ma-sm"
                  v-for="(item, n) in infos"
                  :key="`xl-${n}`"
                >
                  <div class="row text-teal-6 border">
                    <div class="col-1">
                      <q-badge class="q-pa-sm" rounded :color="item.color">
                      </q-badge>
                    </div>
                    <div class="col-10">{{ "  " + item.text }}</div>
                  </div>
                </div>
              </div></template
            >
            <template #top-right="props">
              <q-input
                v-model="filter"
                rounded
                :disable="loadingStatusDns"
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
                color="teal-5"
                icon-right="archive"
                label="Export to csv"
                no-caps
                @click="exportTable(Emails)"
                :disable="loadingStatusDns"
              />
            </template>
            <template #body="props">
              <q-tr :props="props">
                <q-td key="#" style="width: 3%" :props="props"
                  ><q-btn
                    flat
                    round
                    size="sm"
                    color="teal"
                    icon="content_copy"
                    @click="CopyToClipboard(props.row.email.address)"
                /></q-td>
                <q-td key="Email" style="width: 25%" :props="props">
                  {{
                    props.row.email.address
                      ? props.row.email.address.length > 45
                        ? props.row.email.address.substring(0, 44).concat("...")
                        : props.row.email.address
                      : ""
                  }}</q-td
                >

                <q-td key="Names" style="width: 20%" :props="props">
                  {{
                    props.row.email.name
                      ? props.row.email.name.length > 30
                        ? props.row.email.name.substring(0, 38).concat("...")
                        : props.row.email.name
                      : ""
                  }}
                </q-td>
                <q-td key="Sender" style="width: 8%" :props="props">
                  <q-badge outline color="orange" transparent>
                    {{ props.row.field.sender }}
                  </q-badge> </q-td
                ><q-td key="Recipient" style="width: 8%" :props="props">
                  <q-badge outline color="orange" transparent>
                    {{ props.row.field.recipient }}
                  </q-badge>
                </q-td>
                <q-td key="Body" style="width: 8%" :props="props">
                  <q-badge outline color="orange" transparent>
                    {{ props.row.field.body }}
                  </q-badge>
                </q-td>
                <q-td key="Total" style="width: 8%" :props="props">
                  <q-badge color="blue">
                    {{ props.row.field.total }}
                  </q-badge>
                </q-td>
                <q-td key="Type" style="width: 10%" :props="props">
                  <q-badge rounded color="green">
                    {{ props.row.type }}
                  </q-badge>
                </q-td>
                <q-td key="Status" style="width: 10%" :props="props">
                  <q-badge rounded color="green">
                    {{ " " }}
                  </q-badge>
                </q-td>
              </q-tr>
            </template>
          </q-table>
        </div>
      </q-card-section>
    </div>
  </div>
</template>

<script>
import { defineComponent, defineAsyncComponent } from "vue";
import { exportFile, useQuasar, copyToClipboard } from "quasar";
import { ref } from "vue";
import { mapState, useStore } from "vuex";
const infos = [
  {
    text: "Valid mailbox",
    color: "green",
    icon: "check",
  },
  {
    text: "The mailbox is valid but could not receive your emails",
    color: "yellow-8",
    icon: "warning",
  },
  {
    text: "The mailbox is not valid",
    color: "red",
    icon: "fa-solid fa-circle-x",
  },
];
const excludedFolders = [
  "spam",
  "brouillons",
  "draft",
  "trashed",
  "trash",
  "drafts",
];
const columns = [
  {
    name: "#",
    label: "",
    field: " ",
  },
  {
    name: "Email",
    align: "left",
    label: "Email",
    field: (row) => row.email.address,
    sortable: true,
    sort: (a, b) => {
      const domainA = a.split("@")[0];
      const domainB = b.split("@")[0];
      return domainA.localeCompare(domainB);
    },
  },
  {
    name: "Names",
    align: "left",
    label: "Name",
    field: (row) => row.email.name.substring(0, 10).concat("..."),
    sortable: true,
    sort: (a, b) => {
      return b.localeCompare(a);
    },
    sortOrder: "ad",
    style: "max-width: 50px",
    headerStyle: "max-width: 50px",
  },
  {
    name: "Sender",
    align: "left",
    label: "Sender",
    type: "number",
    field: (row) => row.field.sender,
    sortable: true,
    sortOrder: "ad",
  },
  {
    name: "Recipient",
    align: "left",
    label: "Recipient",
    type: "number",
    field: (row) => row.field.recipient,
    sortable: true,
    sortOrder: "ad",
  },
  {
    name: "Body",
    align: "left",
    label: "Body",
    type: "number",
    field: (row) => row.field.body,
    sortable: true,
    sortOrder: "ad",
  },
  {
    name: "Total",
    align: "left",
    label: "Total",
    type: "number",
    field: (row) => row.field.total,
    sortable: true,
    sortOrder: "ad",
  },
  {
    name: "Type",
    align: "left",
    label: "Type",
    field: "type",
  },
  {
    name: "Status",
    align: "left",
    label: "Status",
    field: "status",
  },
];
export default defineComponent({
  name: "TableVisits",
  components: {
    CountCard: defineAsyncComponent(() => import("../cards/CountCard.vue")),
    ProgressCard: defineAsyncComponent(() =>
      import("../cards/ProgressCard.vue")
    ),
  },
  setup() {
    const $q = useQuasar();
    const filter = ref("");
    return {
      filter,
      mode: "list",
      columns,
      infos,
      pagination: {
        rowsPerPage: 55000,
      },
      persistent: ref(false),
      selected: ref([]),
      ticked: ref([]),
      expanded: ref([]),
      exportTable(Emails) {
        function getListSeparator() {
          var list = ["a", "b"],
            str;
          if (list.toLocaleString) {
            str = list.toLocaleString();
            if (str.indexOf(";") > 0 && str.indexOf(",") == -1) {
              return ";";
            }
          }
          return ",";
        }
        let seperator = getListSeparator();
        let csv = `Email;Alias;Status;To;From;CC;BCC;Reply-To;Body;Total;Type\n`;
        let emailsCsv = Emails;
        let emailstoExport = emailsCsv.map((element) => {
          let obj = {
            Email: element.email.address,
            Aliase: element.email.name.trim(),
            Status: "Valid",
            To: Object.keys(element.field).includes("to")
              ? element.field["to"]
              : 0,
            From: Object.keys(element.field).includes("from")
              ? element.field["from"]
              : 0,
            Cc: Object.keys(element.field).includes("cc")
              ? element.field["cc"]
              : 0,
            Bcc: Object.keys(element.field).includes("bcc")
              ? element.field["bcc"]
              : 0,
            Reply: Object.keys(element.field).includes("reply-to")
              ? element.field["reply-to"]
              : 0,
            Body: Object.keys(element.field).includes("body")
              ? element.field["body"]
              : 0,
            Total: element.field.total,
            Type: element.type,
          };
          return obj;
        });
        emailstoExport.forEach((row) => {
          csv += Object.values(row).join(";");
          csv += "\n";
        });
        const status = exportFile("Emails.csv", "\ufeff" + csv, "text/csv");
        if (status !== true) {
          $q.notify({
            message: "Browser denied file download...",
            color: "negative",
            icon: "warning",
          });
        } else {
          $q.notify({
            message: "CSV downloaded",
            color: "teal-7",
            icon: "check",
          });
        }
      },
    };
  },
  data() {
    return {
      renderDialog: false,
      total: 0,
      showing: false,
      email: "",
      boxess: [],
      queue: [],
      render: false,
      dataCleaning: "",
      alreadyExculudes: false,
      totalEmails: "",
      all: false,
      emailsinfinit: [],
      emails: [],
      password: "",
      host: "",
      scrolledToBottom: false,
      port: "",
      acceptedHeaders: ref(["FROM", "TO", "CC", "BCC", "REPLY-TO"]),
      acceptedBody: ref(["1"]),
      selectedBoxes: ref([]),
      quasar: useQuasar(),
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
          value: "1",
        },
      ],
    };
  },
  computed: {
    TickChildren(e) {
      console.log(e);
    },
    Scanned() {
      return this.progress.scannedBoxes;
    },
    Emails() {
      if (this.loadingStatusDns) {
        this.emailsinfinit = this.retrievedEmails.slice(0, 20);
      }
      return this.retrievedEmails;
    },
    Boxes() {
      const selectedB = ref([]);
      function printValues(obj, dataThis) {
        for (var key in obj) {
          if (typeof obj[key] === "object") {
            obj[key]["header"] = "generic";
            printValues(obj[key], dataThis);
          } else {
            if (!excludedFolders.includes(obj[key].toLowerCase())) {
              selectedB.value.push(obj[key]);
            }
          }
        }
      }
      printValues(this.boxes, this);

      let WithCheckAll = [
        { label: "Check all", header: "generic", children: [...this.boxes] },
      ];
      if (selectedB.value.length > 0) {
        this.selectedBoxes = selectedB.value;
      }
      return [...WithCheckAll];
    },
    ScannedEmails() {
      return this.progress.scannedEmails;
    },
    Status() {
      return this.progress.status;
    },
    TotalEmails() {
      return this.progress.totalEmails;
    },
    ProgressLabel() {
      return this.progress.ProgressLabel;
    },
    ...mapState("example", [
      "retrievedEmails",
      "loadingStatus",
      "loadingStatusDns",
      "loadingStatusbox",
      "boxes",
      "progress",
    ]),
  },
  mounted() {
    this.scroll();
    const googleUser = this.quasar.sessionStorage.getItem("googleUser");
    let imapUser;
    if (!googleUser) {
      imapUser = this.quasar.sessionStorage.getItem("ImapUser");
    }
    if (googleUser) {
      let timeNow = Date.now();
      if (googleUser.token.expires_at > timeNow) {
        this.$store.commit("example/SET_TOKEN", googleUser.token.access_token);
        let imap = {
          id: Math.random().toString(36).substr(2),
          email: googleUser.user,
          host: "",
          port: "",
        };
        this.$store.commit("example/SET_IMAP", imap);
      } else {
        this.quasar.sessionStorage.remove("googleUser");
        this.$router.push("/");
      } //
    } else if (imapUser) {
      this.$store.commit("example/SET_IMAP", imapUser);
      this.$store.commit("example/SET_PASSWORD", imapUser.password);
    } else {
      this.$router.push("/");
    }
    this.getBoxes();
    this.boxOptions = this.$store.state.boxes;
    this.renderDialog = true;
  },
  methods: {
    CopyToClipboard(address) {
      copyToClipboard(address)
        .then(() => {
          // success!
        })
        .catch(() => {
          // fail
        });
    },
    isScrolledIntoView(el) {
      let rect = el.getBoundingClientRect();
      let elemTop = rect.top;
      let elemBottom = rect.bottom;
      let isVisible = elemTop < window.innerHeight && elemBottom >= 0;
      return isVisible;
    },
    scroll() {
      window.onscroll = () => {
        let scrolledTo = document.querySelector(".scroll");
        if (scrolledTo && this.isScrolledIntoView(scrolledTo)) {
          this.emailsinfinit = [
            ...this.emailsinfinit,
            ...this.retrievedEmails.slice(
              this.emailsinfinit.length,
              this.emailsinfinit.length + 1
            ),
          ];
        }
      };
    },
    showNotif(msg, color, icon) {
      if (msg && typeof msg != "undefined") {
        this.quasar.notify({
          message: msg,
          color: color,
          icon: icon,
          actions: [
            {
              label: "ok",
              color: "white",
            },
          ],
        });
      }
    },
    filterMethod(rows, term) {
      return rows.filter((e) => {
        if (typeof e.email.name == "undefined") {
          return e.email.address.includes(term);
        } else {
          return e.email.address.includes(term) || e.email.name.includes(term);
        }
      });
    },
    cancelFetchEmails() {
      let cancelAction = this.$store.getters["example/getStates"].cancel;
      // console.log(cancelAction.cancel);
      cancelAction.cancelRequest = true;
      console.log(cancelAction);
    },
    fetchEmails() {
      var fields = [];
      var bot = this.boxes;
      //  default if nothing is selected
      if (this.acceptedBody.length == 0 && this.acceptedHeaders.length == 0) {
        fields = "HEADER.FIELDS (FROM TO CC BCC),TEXT";
      } else if (this.acceptedHeaders.length != 0) {
        this.acceptedBody.length == 0
          ? (fields = `HEADER.FIELDS (${this.acceptedHeaders.join(" ")})`)
          : (fields = `HEADER.FIELDS (${this.acceptedHeaders.join(" ")}),${
              this.acceptedBody[0]
            }`);
      } else if (this.acceptedHeaders.length == 0) {
        fields = `${this.acceptedBody[0]}`;
      }
      let data = {
        boxes: this.selectedBoxes.filter((e) => e !== "generic"),
        fields: fields,
        folders: bot,
      };
      if (this.selectedBoxes.length > 0) {
        console.log(data.boxes);
        this.$store.dispatch("example/getEmails", { data }).then(() => {
          this.showNotif(
            this.$store.getters["example/getStates"].infoMessage,
            "teal-5",
            "check"
          );
        });
      } else {
        this.showNotif("Select at least one folder", "orange-5", "warning");
      }
    },
    getBoxes() {
      this.$store.dispatch("example/getBoxes").then(() => {
        this.$refs.tree.expandAll();
        this.showNotif(
          this.$store.getters["example/getStates"].infoMessage,
          "teal-5",
          "check"
        );
      });
    },
  },
});
</script>
<style>
.border {
  border-radius: 10px;
}
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
  background-image: linear-gradient(315deg, #000000 0%, #03c8a8 74%);
}
.bg-fetch {
  background-color: #deebdd;
  background-image: linear-gradient(315deg, #deebdd 0%, #bbdbbe 74%);
}
.sticky thead tr:first-child th {
  position: sticky;
  top: 0;
}
</style>
