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
                <div class="bg-grey-2 border q-pa-md col-6">
                  <div class="text-h6 text-bold">Select mailbox folders</div>
                  <tree-card
                    v-if="Boxes.length > 0"
                    :boxes="Boxes"
                    :scannedBoxes="Scanned"
                    @selectedBoxes="updateSelectedBoxes"
                  />
                  <q-spinner-tail v-else color="teal" size="4em" />
                </div>
                <div class="col" />

                <div class="bg-grey-1 border q-pa-md q-ml-sm col-5">
                  <div class="text-h6 text-bold">Select fields</div>
                  <div
                    class="text-subtitle2 shadow-2 bborder q-pa-sm text-orange-8"
                  >
                    <fields-card
                      :selectedFields="acceptedFields"
                      @selectedFieldsChanged="updateSelectedFields"
                    />
                  </div>
                </div>
                <div class="column col-12">
                  <div class="col-6" />
                  <div class="q-mt-md q-ml-lg col-6">
                    <q-btn
                      v-bind:disable="loadingStatusDns"
                      no-caps
                      :color="loadingStatusDns ? 'grey-6' : 'teal-5'"
                      label="Collect emails addresses"
                      @click="fetchEmails()"
                    ></q-btn>
                    <q-btn
                      v-bind:disable="!loadingStatusDns"
                      class="q-ma-md"
                      no-caps
                      :color="loadingStatusDns ? 'red' : 'grey-6'"
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
              <div class="q-md col-12"></div>
              <div class="row q-md col-12">
                <progress-card
                  v-if="Boxes"
                  :collectedEmails="Emails.length"
                  :loadingStatusDns="loadingStatusDns"
                  :scannedEmails="ScannedEmails"
                  :totalEmails="TotalEmails"
                  :scannedAddresses="ScannedAddresses"
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
            style="height: 90vh"
            card-class="bg-white  text-teal-10"
            table-class="text-teal-10 "
            table-header-class="text-teal"
            title="Emails"
            :rows="Emails"
            :binary-state-sort="true"
            :columns="columns"
            :filter="filter"
            :filter-method="filterMethod"
            row-key="email"
            virtual-scroll
            column-sort-order="ad"
            :pagination.sync="pagination"
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
            <template v-slot:header-cell-Date="props">
              <q-th :props="props">
                <q-tooltip
                  class="bg-teal-4 text-caption"
                  anchor="top middle"
                  self="center middle"
                  >Date of last interaction with this person</q-tooltip
                >{{ props.col.label }}
              </q-th>
            </template>
            <template v-slot:header-cell-Engagement="props">
              <q-th :props="props">
                <q-tooltip
                  class="bg-teal-4 text-caption"
                  anchor="top middle"
                  self="center middle"
                  >Count of conversations this email address was in</q-tooltip
                >{{ props.col.label }}
              </q-th>
            </template>
            <template #body="props">
              <q-tr :props="props">
                <q-td key="#" :props="props"
                  ><q-btn
                    flat
                    round
                    size="sm"
                    color="teal"
                    icon="content_copy"
                    @click="CopyToClipboard(props.row.email.address)"
                /></q-td>
                <q-td key="Email" :props="props">
                  {{
                    props.row.email.address.length > 38
                      ? props.row.email.address.substring(0, 38).concat("...")
                      : props.row.email.address
                  }}</q-td
                >

                <q-td key="Names" :props="props">
                  {{
                    props.row.email.name.length > 38
                      ? props.row.email.name.substring(0, 38).concat("...")
                      : props.row.email.name
                  }}
                </q-td>
                <q-td key="Sender" :props="props">
                  <q-badge outline color="orange" transparent>
                    {{ props.row.field.sender }}
                  </q-badge> </q-td
                ><q-td key="Recipient" :props="props">
                  <q-badge outline color="orange" transparent>
                    {{ props.row.field.recipient }}
                  </q-badge>
                </q-td>
                <q-td key="Engagement" :props="props">
                  <q-badge outline color="orange" transparent>
                    {{ props.row.field.engagement }}
                  </q-badge>
                </q-td>

                <q-td v-show="false" key="Total" :props="props">
                  <q-badge color="blue">
                    {{ props.row.field.total }}
                  </q-badge> </q-td
                ><q-td key="Body" :props="props">
                  <q-badge outline color="orange" transparent>
                    {{ props.row.field.body }}
                  </q-badge>
                </q-td>
                <q-td key="Date" :props="props">
                  <q-badge outline color="blue" transparent>
                    {{ props.row.date }}
                  </q-badge>
                </q-td>

                <q-td key="Type" :props="props">
                  <q-badge rounded color="green">
                    {{ props.row.type }}
                  </q-badge>
                </q-td>
                <q-td key="Status" :props="props">
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
import { exportFile, useQuasar, copyToClipboard, LocalStorage } from "quasar";
import { ref } from "vue";
import { mapState } from "vuex";
import objectScan from "object-scan";

const columns = [
  {
    name: "#",
    label: "",
    field: " ",
    style: "width: 20px",
    headerStyle: "width: 20px",
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
    style: "max-width:445px;min-width: 445px !important",
    headerStyle: "width: 450px !important",
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
    style: "max-width:190px;min-width: 190px !important",
    headerStyle: "width: 190px !important",
  },
  {
    name: "Sender",
    align: "center",
    label: "Sender",
    type: "number",
    field: (row) => row.field.sender,
    sortOrder: "ad",
    style: "width: 50px !important",
    headerStyle: "width: 50px !important",
    sortable: true,
  },
  {
    name: "Recipient",
    align: "center",
    label: "Recipient",
    type: "number",
    field: (row) => row.field.recipient,
    sortOrder: "ad",
    style: "width: 50px !important",
    headerStyle: "width: 50px !important",
    sortable: true,
  },
  {
    name: "Engagement",
    align: "center",
    label: "Engagement",
    type: "number",
    field: (row) => row.field.engagement,
    sortOrder: "ad",
    style: "width: 50px !important",
    headerStyle: "width: 50px !important",
    sortable: true,
  },
  {
    name: "Body",
    align: "center",
    label: "Body",
    type: "number",
    field: (row) => row.field.body,
    sortOrder: "ad",
    style: "width: 50px !important",
    headerStyle: "width: 50px !important",
    sortable: true,
  },
  {
    name: "Date",
    align: "center",
    label: "Recency",
    sortable: true,
    sort: (date1, date2) => {
      var d1 = Date.parse(date1);
      var d2 = Date.parse(date2);
      if (d1 < d2) {
        return 1;
      } else {
        return -1;
      }
    },
    field: (row) => row.date,
    sortOrder: "ad",
    style: "width: 50px !important",
    headerStyle: "width: 50px !important",
  },

  {
    name: "Type",
    align: "center",
    label: "Type",
    sortable: true,
    field: "type",
    sortOrder: "ad",
    sort: (s1, s2) => {
      return s1.localeCompare(s2);
    },
    style: "width: 50px !important",
    headerStyle: "width: 50px !important",
  },
  {
    name: "Status",
    align: "center",
    label: "Status",
    field: "status",
    style: "width: 50px",
    headerStyle: "width: 50px",
  },
];
export default defineComponent({
  name: "TableVisits",
  components: {
    CountCard: defineAsyncComponent(() => import("../cards/CountCard.vue")),
    ProgressCard: defineAsyncComponent(() =>
      import("../cards/ProgressCard.vue")
    ),
    FieldsCard: defineAsyncComponent(() => import("../cards/FieldsCard.vue")),
    TreeCard: defineAsyncComponent(() => import("../cards/TreeCard.vue")),
  },
  setup() {
    const $q = useQuasar();
    const filter = ref("");
    return {
      filter,
      mode: "list",
      columns,
      pagination: {
        rowsPerPage: 55000,
      },
      persistent: ref(false),
      selected: ref([]),
      ticked: ref([]),
      expanded: ref([]),
      exportTable(Emails) {
        let csv = `Email;Alias;Status;To;From;CC;BCC;Reply-To;Total of interactions;Engagement;Date of last interaction;Body;Type\n`;
        let emailsCsv = Emails;
        let emailstoExport = emailsCsv.map((element) => {
          let obj = {
            Email: element.email.address,
            Aliase: element.email.name.includes(";")
              ? `"${element.email.name}"`
              : element.email.name,
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
            Total: element.field.total,
            Engagement: element.field.engagement,
            Date: element.date,
            Body: Object.keys(element.field).includes("body")
              ? element.field["body"]
              : 0,

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
      cancel: false,
      all: false,
      emailsinfinit: [],
      emails: [],
      password: "",
      host: "",
      scrolledToBottom: false,
      port: "",
      acceptedFields: ref(["FROM", "TO", "CC", "BCC", "REPLY-TO", "1"]),
      selectedFields: ref([]),
      selectedBoxes: ref([]),
      quasar: useQuasar(),
    };
  },
  computed: {
    Boxes() {
      return this.boxes;
    },
    Scanned() {
      return this.progress.scannedBoxes;
    },
    Emails() {
      return this.retrievedEmails;
    },

    ScannedEmails() {
      return this.progress.scannedEmails;
    },
    ScannedAddresses() {
      return this.progress.invalidAddresses;
    },
    Status() {
      return this.progress.status;
    },
    TotalEmails() {
      if (this.boxes[0]) {
        return objectScan(["**.{totalIndiv}"], {
          joined: true,
          filterFn: ({ parent, gparent, property, value, context }) => {
            if (
              property == "totalIndiv" &&
              this.selectedBoxes.includes(parent.label)
            ) {
              context.sum += value;
            }
          },
        })(this.boxes, { sum: 0 }).sum;
      }
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
    const googleUser = LocalStorage.getItem("googleUser");
    const imapUser = LocalStorage.getItem("imapUser");
    if (!googleUser && !imapUser) {
      this.$router.push("/");
    } else if (googleUser) {
      this.$store.commit("example/SET_GOOGLE_USER", googleUser);
      this.getBoxes();
      this.boxOptions = this.$store.state.boxes;
      this.renderDialog = true;
    } else if (imapUser) {
      this.$store.commit("example/SET_IMAP", imapUser);
      this.getBoxes();
      this.boxOptions = this.$store.state.boxes;
      this.renderDialog = true;
    }
  },
  methods: {
    updateSelectedFields(val) {
      this.selectedFields = val;
    },
    updateSelectedBoxes(val) {
      this.selectedBoxes = val;
    },
    CopyToClipboard(address) {
      copyToClipboard(address)
        .then(() => {
          // success!
        })
        .catch(() => {
          // fail
        });
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
      this.cancel = true;
      let cancelAction = this.$store.getters["example/getStates"].cancel;
      cancelAction.cancelRequest = true;
    },
    fetchEmails() {
      var fields = [];
      //  default if nothing is selected
      if (this.selectedFields.length == 0) {
        fields =
          "HEADER.FIELDS (FROM TO CC BCC REPLY-TO DATE LIST-UNSUBSCRIBE REFERENCES),1";
      } else if (this.selectedFields.includes("1")) {
        fields = `HEADER.FIELDS (${this.selectedFields
          .filter(function (item) {
            return item !== "1";
          })
          .join(" ")} DATE LIST-UNSUBSCRIBE REFERENCES),1`;
      } else {
        fields = `HEADER.FIELDS (${this.selectedFields}DATE LIST-UNSUBSCRIBE REFERENCES)`;
      }

      let data = {
        boxes: this.selectedBoxes,
        fields: fields,
      };
      console.log(data);
      if (this.selectedBoxes.length > 0) {
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
.q-tree > .q-tree__node {
  padding: 0px;
}
.borderForBoxes {
  border: 0.2px solid transparent;
  background-color: #ffffff;
  border-radius: 5px;
  padding-left: 5px;
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
thead tr th {
  position: sticky;
  z-index: 1;
}
.q-td text-left {
  max-width: inherit;
  min-width: inherit;
}
.sticky thead tr:first-child th {
  position: sticky;
  background-color: #ffffff;
  top: 0;
  z-index: 1;
}
</style>
