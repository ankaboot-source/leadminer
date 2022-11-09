<template>
  <div class="row q-col-gutter-sm">
    <div class="col-lg-12 col-md-12 col-sm-12 col-xs-12">
      <q-card-section class="q-pa-none">
        <div v-if="renderDialog" class="row q-pa-sm">
          <div class="bg-stransparent q-mr-sm col-lg-5 col-md-5 q-pa-sm">
            <q-card class="card-class">
              <q-card-section class="bg-tealgradient q-pa-sm text-white">
                <div class="text-h5 text-bold">Preferences</div>
                <div class="text-caption" />
              </q-card-section>
              <div class="text-custom row q-pa-sm">
                <div class="bg-grey-2 border q-pa-sm col-lg-12 col-md-6">
                  <div class="text-h6 text-bold col-lg-5 col-md-5">
                    Select mailbox folders &emsp;&emsp;&emsp;&emsp;
                    <q-btn
                      outline
                      round
                      size="sm"
                      color="orange-5"
                      icon="refresh"
                      @click="getBoxes()"
                    />
                  </div>
                  <tree-card
                    v-if="Boxes.length > 0"
                    :boxes="Boxes"
                    :scannedBoxes="Scanned"
                    @selectedBoxes="updateSelectedBoxes"
                  />
                  <q-spinner-tail v-else color="teal" size="4em" />
                </div>
                <div />

                <div class="bg-grey-1 border q-pa-md q-ml-sm col-lg-4 col-md-5 hidden">
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
                <div class="column col-lg-8">
                  <div class="col-6" />
                  <div class="q-mt-md q-ml-lg col-6">
                    <q-btn
                      v-bind:disable="loadingStatusDns"
                      no-caps
                      :color="loadingStatusDns ? 'grey-6' : 'red'"
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
                  :collectedEmails="Emails ? Emails.length : 0"
                  :loadingStatusDns="loadingStatusDns"
                  :scannedEmails="ScannedEmails"
                  :totalEmails="TotalEmails"
                  :statistics="Statistics"
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
            table-class="text-teal-10 sticky"
            table-header-class="text-teal sticky"
            title="Emails"
            :rows="Emails ?? []"
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
                @click="exportTable(Emails.length > 0 ? Emails : [])"
                :disable="loadingStatusDns"
              />
            </template>
            <template v-slot:header-cell-Names="props">
              <q-th :props="props">{{ props.col.label }} </q-th>
            </template>
            <template v-slot:header-cell-Email="props">
              <q-th :props="props">{{ props.col.label }} </q-th>
            </template>
            <template v-slot:header-cell-#="props">
              <q-th :props="props">{{ props.col.label }} </q-th> </template
            ><template v-slot:header-cell-Type="props">
              <q-th :props="props">{{ props.col.label }} </q-th> </template
            ><template v-slot:header-cell-Status="props">
              <q-th :props="props">{{ props.col.label }} </q-th>
            </template>
            <template v-slot:header-cell-Date="props">
              <q-th :props="props">
                <q-tooltip
                  class="bg-orange-13 text-caption"
                  anchor="top middle"
                  self="center middle"
                  >Date of last interaction with this person</q-tooltip
                >{{ props.col.label }}
              </q-th>
            </template>
            <template v-slot:header-cell-Engagement="props">
              <q-th :props="props">
                <q-tooltip
                  class="bg-orange-13 text-caption"
                  anchor="top middle"
                  self="center middle"
                  >Count of conversations this email address was in</q-tooltip
                >{{ props.col.label }}
              </q-th>
            </template>
            <template v-slot:header-cell-Occurence="props">
              <q-th :props="props">
                <q-tooltip
                  class="bg-orange-13 text-caption"
                  anchor="top middle"
                  self="center middle"
                  >Total occurences of this email address</q-tooltip
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
                    @click="CopyToClipboard(props.row.email)"
                /></q-td>
                <q-td key="Email" :props="props">
                  {{
                    props.row.email.length > 38
                      ? props.row.email.substring(0, 38).concat("...")
                      : props.row.email
                  }}</q-td
                >
                <q-td key="Names" :props="props">
                  <!-- <q-expansion-item
                    v-if="props.row.name != null && props.row.name.length > 1"
                    dense
                    dense-toggle
                    expand-icon-class="text-orange"
                  >
                    <template v-slot:header>
                      <q-item-section
                        v-if="props.row.name.length > 0"
                        class="padding-zero"
                      >
                        <q-badge outline color="orange" transparent
                          >{{
                            props.row.name[0].length > 25
                              ? props.row.name[0].substring(0, 22).concat("...")
                              : props.row.name[0]
                          }}
                        </q-badge>
                      </q-item-section>
                      <q-item-section v-if="props.row.name.length - 1 > 0" side>
                        <div class="row items-center">
                          <q-badge
                            class="text-little"
                            rounded
                            color="orange"
                            transparent
                            >+{{ props.row.name.length - 1 }}</q-badge
                          >
                        </div>
                      </q-item-section>
                    </template>
                    <div
                      v-for="name in props.row.name.filter((element) => {
                        return element != ' ';
                      })"
                      :bind="name.index"
                    >
                      <q-badge
                        v-if="name.length > 0"
                        outline
                        color="orange"
                        transparent
                        >{{
                          name.length > 35
                            ? name.substring(0, 30).concat("...")
                            : name
                        }} </q-badge
                      ><br /></div
                  ></q-expansion-item> -->
                  <q-badge
                    v-if="props.row.name"
                    outline
                    color="orange"
                    transparent
                    class="padding-zero"
                    >{{
                      props.row.name.length > 30
                        ? props.row.name.substring(0, 25).concat("...")
                        : props.row.name
                    }}
                  </q-badge>
                </q-td>
                <q-td key="Occurence" :props="props">
                  <q-badge outline color="orange" transparent>
                    {{ props.row.occurence }}
                  </q-badge>
                </q-td>

                <q-td key="Engagement" :props="props">
                  <q-badge outline color="orange" transparent>
                    {{ props.row.engagement }}
                  </q-badge>
                </q-td>
                <q-td key="Type" :props="props">
                  <span v-for="tag in props.row.tags"
                    ><q-badge color="teal">{{ tag }}</q-badge
                    ><br
                  /></span>
                </q-td>
                <!-- <q-td key="Date" :props="props">
                  <q-badge outline color="blue" transparent>
                    {{ formatDate(props.row.date) }}
                  </q-badge>
                  <q-tooltip
                    class="bg-blue-8"
                    anchor="top middle"
                    self="center middle"
                    >{{ getTimeOffset(props.row.date) }}</q-tooltip
                  >
                </q-td> -->

                <!-- <q-td
                  v-for="tag in props.row.tags"
                  v-bind="key"
                  key="Type"
                  :props="props"
                >
                  <q-badge class="text-little" rounded color="amber-6">
                    {{ tag }} </q-badge
                  ><br /> -->
                <!--<q-badge
                    v-if="props.row.Transactional == true"
                    class="text-little"
                    rounded
                    color="amber-7"
                  >
                    Transactional
                  </q-badge>
                  <br v-if="props.row.includes('Transactional')" /><q-badge
                    v-if="props.row.type != ''"
                    class="text-little"
                    rounded
                    color="green"
                  >
                    {{ props.row.type }}    </q-badge></q-td>-->

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
    field: (row) => row.email,
    sortable: true,
    sort: (a, b) => {
      return a.localeCompare(b);
    },
    style: "max-width:380px;min-width: 380px !important",
    headerStyle: "width: 380px !important",
  },
  {
    name: "Names",
    align: "left",
    label: "Name",
    sortable: false,
    sort: (a, b) => {
      return b.localeCompare(a);
    },
    sortOrder: "ad",
    style: "max-width:190px;min-width: 190px !important;",
    headerStyle: "width: 250px !important",
  },
  // {
  //   name: "Sender",
  //   align: "center",
  //   label: "Sender",
  //   type: "number",
  //   field: (row) => row.sender,
  //   sortOrder: "ad",
  //   style: "width: 50px !important",
  //   headerStyle: "width: 50px !important",
  //   sortable: true,
  // },
  // {
  //   name: "Recipient",
  //   align: "center",
  //   label: "Recipient",
  //   type: "number",
  //   field: (row) => row.recipient,
  //   sortOrder: "ad",
  //   style: "width: 50px !important",
  //   headerStyle: "width: 50px !important",
  //   sortable: true,
  // },
  {
    name: "Occurence",
    align: "center",
    label: "Occurence",
    type: "number",
    field: (row) => row.occurence,
    sortOrder: "ad",
    style: "width: 50px !important",
    headerStyle: "width: 51px !important",
    sortable: true,
    sort: (eng1, eng2) => {
      if (eng1 > eng2) {
        return -1;
      } else if (eng1 < eng2) {
        return 1;
      } else {
        return 0;
      }
    },
  },
  // {
  //   name: "Body",
  //   align: "center",
  //   label: "Body",
  //   type: "number",
  //   field: (row) => row.body,
  //   sortOrder: "ad",
  //   style: "width: 50px !important",
  //   headerStyle: "width: 50px !important",
  //   sortable: true,
  // },
  {
    name: "Engagement",
    align: "center",
    label: "Engagement",
    type: "number",
    field: (row) => row.engagement,
    sortOrder: "ad",
    style: "width: 50px !important",
    headerStyle: "width: 50px !important",
    sortable: true,
    sort: (eng1, eng2) => {
      if (eng1 > eng2) {
        return -1;
      } else {
        return 1;
      }
    },
  },

  // {
  //   name: "Date",
  //   align: "center",
  //   label: "Recency",
  //   sortable: true,
  //   sort: (date1, date2) => {
  //     var d1 = Date.parse(date1);
  //     var d2 = Date.parse(date2);
  //     if (d1 < d2) {
  //       return 1;
  //     } else {
  //       return -1;
  //     }
  //   },
  //   field: (row) => row.date,
  //   sortOrder: "ad",
  //   style: "width: 50px !important",
  //   headerStyle: "width: 50px !important",
  // },

  {
    name: "Type",
    align: "center",
    label: "Type",
    sortable: true,
    sortOrder: "ad",
    field: (row) => row.tags,
    sort: (s1, s2) => {
      if (s1.length > s2.length) {
        return 1;
      } else if (s1.length < s2.length) {
        return -1;
      } else {
        return 0;
      }
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
        sortBy: "Occurence",
        descending: false,
      },
      persistent: ref(false),
      selected: ref([]),
      ticked: ref([]),
      expanded: ref([]),
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
    Statistics() {
      return this.progress.statistics;
    },
    TotalEmails() {
      if (this.boxes[0]) {
        return objectScan(["**.{totalIndiv}"], {
          joined: true,
          filterFn: ({ parent, gparent, property, value, context }) => {
            if (
              property == "totalIndiv" &&
              this.selectedBoxes.includes(parent.path)
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
    this.$store.dispatch("example/setupEventSource", { this: this });
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
        if (typeof e.name[0] == "") {
          return e.address.toUpperCase().includes(term.toUpperCase());
        } else {
          return (
            e.address.toUpperCase().includes(term) ||
            e.name[0].toUpperCase().includes(term.toUpperCase())
          );
        }
      });
    },
    formatDate(e) {
      let date = new Date(e);
      return date.toLocaleDateString();
    },
    getTimeOffset(e) {
      let offset = e
        .substr(e.indexOf("+") != -1 ? e.indexOf("+") : e.indexOf("-"), 5)
        .replaceAll(0, "");
      let date = new Date(
        e.substring(0, e.indexOf("+") != -1 ? e.indexOf("+") : e.indexOf("-"))
      );
      offset = offset == "+" ? "+" + 0 : offset;
      return (
        date.toLocaleDateString(undefined, {
          weekday: "short",
          year: "2-digit",
          month: "2-digit",
          day: "2-digit",
          hour: "numeric",
          hour12: false,
          minute: "numeric",
          second: "numeric",
        }) +
        " GMT" +
        offset
      );
    },
    exportTable(Emails) {
      let csv = `Email;Alias;Status;To;From;CC;BCC;Reply-To;Sender;Recipient;Occurence;Engagement;Date of last interaction;Body;Type\n`;
      let emailsCsv = Emails;
      let emailstoExport = emailsCsv.map((element) => {
        let names = element.name.map((el) => {
          return el.includes(";") ? `"${el.replaceAll(";", "")}"` : el;
        });
        let obj = {
          Email: element.address,
          Aliase: names,
          Status: "Valid",
          To: element.to,
          From: element.from,
          Cc: element.cc,
          Bcc: element.bcc,
          Reply: element["reply-to"],
          Sender: element.sender,
          Recipient: element.recipient,
          Occurence: element.total,
          Engagement: element.conversation,
          Date: this.getTimeOffset(element.date),
          Body: element.body,
          Type: [
            element.type,
            element.Newsletter ? "newsletter" : "",
            element.Transactional ? "transactional" : "",
          ],
        };
        return obj;
      });
      emailstoExport.forEach((row) => {
        csv += Object.values(row).join(";");
        csv += "\n";
      });
      const status = exportFile("Emails.csv", "\ufeff" + csv, "text/csv");
      if (status !== true) {
        this.quasar.notify({
          message: "Browser denied file download...",
          color: "negative",
          icon: "warning",
        });
      } else {
        this.quasar.notify({
          message: "CSV downloaded",
          color: "teal-7",
          icon: "check",
        });
      }
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

      if (this.selectedBoxes.length > 0) {
        this.$store
          .dispatch("example/getEmails", { data })
          .then(() => {
            this.showNotif(
              this.$store.getters["example/getStates"].infoMessage,
              "teal-5",
              "check"
            );
          })
          .catch((error) => {
            this.showNotif(
              this.$store.getters["example/getStates"].errorMessage,
              "red",
              "error"
            );
          });
      } else {
        this.showNotif("Select at least one folder", "orange-5", "warning");
      }
    },
    getBoxes() {
      this.$store
        .dispatch("example/getBoxes")
        .then(() => {
          this.showNotif(
            this.$store.getters["example/getStates"].infoMessage,
            "teal-5",
            "check"
          );
        })
        .catch((error) => {
          this.showNotif(
            this.$store.getters["example/getStates"]?.errorMessage,
            "red",
            "error"
          );
        });
    },
  },
});
</script>
<style scoped>
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
.sticky .q-table__middle {
  max-height: 200px;
}
.sticky .q-table__top,
.sticky .q-table__bottom,
.sticky thead tr:first-child th {
  background-color: #f5f5dc;
  z-index: 1000;
}
.sticky thead tr:first-child th {
  position: sticky;
  top: 0;
}
.bg-buttons {
  background-image: linear-gradient(315deg, #000000 0%, #03c8a8 74%);
}
.bg-fetch {
  background-color: #deebdd;
  background-image: linear-gradient(315deg, #deebdd 0%, #bbdbbe 74%);
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
.text-little {
  font-size: 10px;
}
.card-class {
  width: 40vw;
}
.q-list--dense > .q-item,
.q-item--dense {
  padding: 0px;
}
</style>
