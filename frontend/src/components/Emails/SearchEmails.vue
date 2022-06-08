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

                  <q-tree
                    v-if="Boxes.length > 0"
                    ref="tree"
                    v-model:ticked="selectedBoxes"
                    v-model:selected="selected"
                    v-model:expanded="expanded"
                    :default-expand-all="true"
                    class="col-12 col-sm-6"
                    icon="arrow_forward_ios"
                    :nodes="Boxes"
                    @update:ticked="Ticked"
                    node-key="label"
                    color="teal"
                    tick-strategy="leaf"
                    ><template class="row" v-slot:default-header="prop">
                      <div
                        class="full-width row inline no-wrap justify-between items-end content-center borderForBoxes"
                      >
                        <div class="col-10 text-weight-bold text-primary">
                          {{ prop.node.label
                          }}<q-badge
                            v-if="isExpanded(prop.node.label)"
                            color="orange"
                            class="q-ml-lg"
                            rounded
                            floating
                            transparent
                            >{{ prop.node.total }}</q-badge
                          ><q-badge
                            v-else
                            color="orange"
                            class="q-ml-lg"
                            rounded
                            floating
                            transparent
                            >{{ prop.node.totalIndiv }}</q-badge
                          >
                        </div>

                        <div class="col-2">
                          <q-icon
                            :name="
                              Scanned.includes(prop.node.label) ? 'check' : ''
                            "
                            color="orange"
                            size="28px"
                            class="q-mr-sm"
                          />
                        </div>
                      </div> </template></q-tree
                  ><q-spinner-tail v-else color="teal" size="4em" />
                </div>
                <div class="col" />

                <div class="bg-grey-1 border q-pa-md q-ml-sm col-5">
                  <div class="text-h6 text-bold">Select fields</div>
                  <div
                    class="text-subtitle2 shadow-2 bborder q-pa-sm text-orange-8"
                  >
                    <q-tree
                      class="col-12 col-sm-6 text-cyan-10"
                      :nodes="optionsSenderFields"
                      node-key="value"
                      icon="arrow_forward_ios"
                      tick-strategy="leaf"
                      color="teal"
                      expanded="Sender"
                      v-model:ticked="acceptedHeaders"
                      ><template class="row" v-slot:header-root="prop">
                        <div
                          class="col-5 text-weight-bold text-primary text-orange-8"
                        >
                          {{ prop.node.label }}
                        </div> </template
                      ><template class="row" v-slot:default-header="prop"
                        ><div
                          class="full-width row inline no-wrap justify-between items-end content-center borderForBoxes"
                        >
                          <div class="col-5 text-weight-bold text-teal-5">
                            {{ prop.node.label
                            }}<q-badge
                              v-if="prop.node.label == 'Reply-to'"
                              color="transparent"
                              class="text-bold q-ml-lg"
                              rounded
                              floating
                              align="middle"
                              outlined
                              transparent
                              ><q-icon
                                name="o_info"
                                color="orange"
                                size="22px"
                              /><q-tooltip
                                anchor="bottom middle"
                                class="bg-orange-6 text-white text-caption"
                                self="top middle"
                              >
                                Emails address you'll answer to
                              </q-tooltip></q-badge
                            >
                          </div>
                        </div></template
                      ></q-tree
                    >

                    <q-tree
                      class="col-12 col-sm-6 text-cyan-10"
                      :nodes="optionsRecipientFields"
                      node-key="value"
                      tick-strategy="leaf"
                      icon="arrow_forward_ios"
                      color="teal"
                      expanded="Recipient"
                      v-model:ticked="acceptedHeaders"
                      ><template class="row" v-slot:header-root="prop">
                        <div class="col-5 text-weight-bold text-orange-8">
                          {{ prop.node.label }}
                        </div> </template
                      ><template
                        class="row paddingzero"
                        v-slot:default-header="prop"
                        ><div
                          class="full-width row inline no-wrap justify-between items-end content-center borderForBoxes"
                        >
                          <div class="col-5 text-weight-bold text-teal-5">
                            {{ prop.node.label }}
                          </div>
                        </div></template
                      ></q-tree
                    >
                    <div class="text-subtitle2 q-pa-sm text-orange-8">
                      <q-tree
                        class="col-12 col-sm-6 text-cyan-10"
                        :nodes="optionsBody"
                        node-key="value"
                        tick-strategy="leaf"
                        icon="arrow_forward_ios"
                        color="teal"
                        v-model:ticked="acceptedBody"
                        ><template class="row" v-slot:header-root="prop"
                          ><div
                            class="full-width row inline no-wrap justify-between items-end content-center borderForBoxes"
                          >
                            <div
                              class="col-5 text-weight-bold text-primary text-orange-8"
                            >
                              {{ prop.node.label }}
                            </div>

                            <div class="col-5 text-weight-bold text-primary">
                              <q-badge
                                color="transparent"
                                class="text-bold q-ml-lg"
                                rounded
                                floating
                                align="middle"
                                outlined
                                transparent
                                ><q-icon
                                  name="o_info"
                                  color="orange"
                                  size="22px"
                                /><q-tooltip
                                  anchor="bottom middle"
                                  self="top middle"
                                  class="bg-orange-6 text-white text-caption"
                                >
                                  Emails addressed found inside the email
                                </q-tooltip></q-badge
                              >
                            </div>
                          </div></template
                        ></q-tree
                      >
                    </div>
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
              <div class="q-md col-12">
                <!-- <count-card
                  icon_position="left"
                  :collected-emails="Emails.length"
                /> -->
              </div>
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
            ><template #top-left>
              <div
                class="border col-12 q-ma-sm"
                v-for="(item, n) in infos"
                :key="`xl-${n}`"
              >
                <div class="row text-teal-6 border text-no-wrap">
                  <div class="col-1">
                    <q-badge class="q-pa-sm" rounded :color="item.color">
                    </q-badge>
                  </div>
                  <div class="col-11">{{ "  " + item.text }}</div>
                </div>
              </div>
            </template>
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
                <q-td key="#" style="width: 3vw" :props="props"
                  ><q-btn
                    flat
                    round
                    size="sm"
                    color="teal"
                    icon="content_copy"
                    @click="CopyToClipboard(props.row.email.address)"
                /></q-td>
                <q-td key="Email" style="width: 25vw" :props="props">
                  {{
                    props.row.email.address.length > 38
                      ? props.row.email.address.substring(0, 38).concat("...")
                      : props.row.email.address
                  }}</q-td
                >

                <q-td key="Names" style="width: 25vw" :props="props">
                  {{
                    props.row.email.name.length > 38
                      ? props.row.email.name.substring(0, 38).concat("...")
                      : props.row.email.name
                  }}
                </q-td>
                <q-td key="Sender" style="width: 5vw" :props="props">
                  <q-badge outline color="orange" transparent>
                    {{ props.row.field.sender }}
                  </q-badge> </q-td
                ><q-td key="Recipient" style="width: 5vw" :props="props">
                  <q-badge outline color="orange" transparent>
                    {{ props.row.field.recipient }}
                  </q-badge>
                </q-td>
                <q-td key="Engagement" style="width: 5vw" :props="props">
                  <q-badge outline color="orange" transparent>
                    {{ props.row.field.engagement }}
                  </q-badge>
                </q-td>

                <q-td
                  v-show="false"
                  key="Total"
                  style="width: 3vw"
                  :props="props"
                >
                  <q-badge color="blue">
                    {{ props.row.field.total }}
                  </q-badge> </q-td
                ><q-td key="Body" style="width: 5vw" :props="props">
                  <q-badge outline color="orange" transparent>
                    {{ props.row.field.body }}
                  </q-badge>
                </q-td>
                <q-td key="Date" style="width: 5vw" :props="props">
                  <q-badge outline color="blue" transparent>
                    {{ props.row.date }}
                  </q-badge>
                </q-td>

                <q-td key="Type" style="width: 5vw" :props="props">
                  <q-badge rounded color="green">
                    {{ props.row.type }}
                  </q-badge>
                </q-td>
                <q-td key="Status" style="width: 5vw" :props="props">
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
import objectScan from "object-scan";
const infos = [
  {
    text: "Valid mailbox",
    color: "green",
    icon: "check",
  },
  {
    text: "The mailbox could not receive your emails",
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
  },
  {
    name: "Sender",
    align: "center",
    label: "Sender",
    type: "number",
    field: (row) => row.field.sender,
    sortOrder: "ad",
    sortable: true,
  },
  {
    name: "Recipient",
    align: "center",
    label: "Recipient",
    type: "number",
    field: (row) => row.field.recipient,
    sortOrder: "ad",
    sortable: true,
  },
  {
    name: "Engagement",
    align: "center",
    label: "Engagement",
    type: "number",
    field: (row) => row.field.engagement,
    sortOrder: "ad",
    sortable: true,
  },

  // {
  //   name: "Total",
  //   align: "center",
  //   label: "Total of interactions",
  //   type: "number",
  //   field: (row) => row.field.total,
  //   sortOrder: "ad",
  //   sortable: true,
  // },
  {
    name: "Body",
    align: "center",
    label: "Body",
    type: "number",
    field: (row) => row.field.body,
    sortOrder: "ad",
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
  },
  {
    name: "Status",
    align: "center",
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
        // function getListSeparator() {
        //   var list = ["a", "b"],
        //     str;
        //   if (list.toLocaleString) {
        //     str = list.toLocaleString();
        //     if (str.indexOf(";") > 0 && str.indexOf(",") == -1) {
        //       return ";";
        //     }
        //   }
        //   return ",";
        // }
        // let seperator = getListSeparator();
        let csv = `Email;Alias;Status;To;From;CC;BCC;Reply-To;Total of interactions;Date of last interaction;Body;Type\n`;
        let emailsCsv = Emails;
        let emailstoExport = emailsCsv.map((element) => {
          console.log(element.email.name);
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
      acceptedHeaders: ref(["FROM", "TO", "CC", "BCC", "REPLY-TO"]),
      acceptedBody: ref(["1"]),
      selectedBoxes: ref([]),
      quasar: useQuasar(),
      optionsSenderFields: [
        {
          label: "Sender",
          value: "Sender",
          header: "root",
          children: [
            {
              label: "From",
              value: "FROM",
            },
            {
              label: "Reply-to",
              value: "REPLY-TO",
            },
          ],
        },
      ],
      optionsRecipientFields: [
        {
          label: "Recipient",
          value: "Recipient",
          header: "root",

          children: [
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
        },
      ],
      boxOptions: [],
      optionsBody: [
        {
          label: "Body",
          value: "1",
          header: "root",
        },
      ],
    };
  },
  computed: {
    Scanned() {
      return this.progress.scannedBoxes;
    },
    Emails() {
      // if (this.loadingStatusDns) {
      //   this.Emails = this.retrievedEmails.slice(0, 20);
      // }
      return this.retrievedEmails;
    },
    Boxes() {
      const selectedB = ref([]);
      function printValues(obj, dataThis) {
        for (var key in obj) {
          if (typeof obj[key] === "object") {
            printValues(obj[key], dataThis);
          } else if (typeof obj[key] === "string") {
            if (!excludedFolders.includes(obj[key].toLowerCase())) {
              selectedB.value.push(obj[key]);
            }
          }
        }
      }

      printValues(this.boxes, this);

      let WithCheckAll = [...this.boxes];
      if (selectedB.value.length > 0) {
        this.selectedBoxes = selectedB.value;
      }

      return [...WithCheckAll];
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
    //this.scroll();
    const googleUser = this.quasar.localStorage.getItem("googleUser");
    let imapUser;
    if (!googleUser) {
      imapUser = this.quasar.localStorage.getItem("imapUser");
    }
    if (googleUser) {
      this.$store.commit("example/SET_GOOGLE_USER", googleUser);
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
    Ticked(e) {
      setTimeout(() => {
        objectScan(["**.label"], {
          joined: true,
          filterFn: ({ parent, gparent, property, value, context }) => {
            if (
              (value,
              this.$refs.tree.isTicked(value) &&
                value != "Check All" &&
                !this.selectedBoxes.includes(value))
            ) {
              this.selectedBoxes.push(value);
            }
          },
        })(this.boxes, { sum: 0 });
      }, 150);
    },
    isExpanded(value) {
      if (this.$refs.tree) {
        if (this.$refs.tree.isExpanded(value)) {
          return false;
        } else {
          return true;
        }
      }
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
      // console.log(cancelAction.cancel);
      cancelAction.cancelRequest = true;
    },
    fetchEmails() {
      var fields = [];
      var bot = this.boxes;
      //  default if nothing is selected
      if (this.acceptedBody.length == 0 && this.acceptedHeaders.length == 0) {
        fields =
          "HEADER.FIELDS (FROM TO CC BCC REPLY-TO DATE LIST-UNSUBSCRIBE REFERENCES),TEXT";
      } else if (this.acceptedHeaders.length != 0) {
        this.acceptedBody.length == 0
          ? (fields = `HEADER`)
          : (fields = `HEADER.FIELDS (${this.acceptedHeaders.join(
              " "
            )} DATE LIST-UNSUBSCRIBE REFERENCES),${this.acceptedBody[0]}`);
      } else if (this.acceptedHeaders.length == 0) {
        fields = `HEADER.FIELDS (DATE LIST-UNSUBSCRIBE REFERENCES),${this.acceptedBody[0]}`;
      }

      let data = {
        boxes: this.selectedBoxes.filter(
          (e) => e !== "generic" && e != "Check all"
        ),
        fields: fields,
        folders: this.boxes[0].children,
      };
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
        setTimeout(() => {
          if (this.$refs.tree) {
            this.$refs.tree.expandAll();
          }
          this.quasar.localStorage.clear(),
            this.quasar.localStorage.set(
              "googleUser",
              this.$store.state.example.googleUser
            );
          console.dir(this.quasar.localStorage.getItem("googleUser"));
          console.dir(this.$store.state.example.googleUser);
        }, 2000);
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
.q-tree > .q-tree__node--child > .q-tree__node-header {
  padding: 5px;
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
.sticky thead tr:first-child th {
  position: sticky;
  background-color: #ffffff;
  top: 0;
  z-index: 1;
}
</style>
