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
                      v-bind:disable="loadingStatusDns"
                      no-caps
                      color="teal-5"
                      label="Collect emails addresses"
                      @click="fetchEmails()"
                    ></q-btn>
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
                  :collected-emails="Emails.length"
                />
              </div>
              <div class="row q-md col-12 text-center">
                <q-card flat class="bg-transparent q-ml-lg" style="width: 100%">
                  <q-circular-progress
                    show-value
                    class="text-white q-ma-md"
                    :value="parseFloat(percentage) * 100"
                    size="120px"
                    :thickness="0.19"
                    :animation-speed="10"
                    color="orange"
                    center-color="grey-7"
                    track-color="transparent"
                    ><div></div>

                    <div class="text-center q-pt-sm">
                      <small class="text-white text-subtitle">
                        {{ parseFloat(percentage) * 100 }}%
                      </small>
                      <div>
                        <q-badge
                          v-show="CurrentBox != ''"
                          color="orange"
                          :label="
                            CurrentBox.includes('/')
                              ? CurrentBox.substring(
                                  CurrentBox.indexOf('/') + 1,
                                  CurrentBox.length - 1
                                )
                              : CurrentBox.slice(1, -1)
                          "
                        />
                      </div>
                    </div>
                  </q-circular-progress>

                  <q-circular-progress
                    :min="0"
                    :max="Emails.length"
                    :value="Emails.length"
                    show-value
                    size="120px"
                    font-size="14px"
                    :thickness="0.1"
                    color="teal"
                    track-color="grey"
                    :angle="-90"
                    class="q-ma-md"
                  >
                    <div class="text-center q-pt-sm">
                      <div class="text-green text-h5">
                        {{ Emails.length }}
                      </div>
                      <div>
                        <small class="text-green text-caption">
                          Valid email</small
                        ><br />
                        <q-circular-progress
                          indeterminate
                          v-show="loadingStatusDns"
                          size="25px"
                          :thickness="0.22"
                          color="lime"
                          track-color="grey-8"
                          class="q-ma-md float-center"
                        />
                      </div>
                    </div> </q-circular-progress
                ></q-card>
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
              <q-btn
                class="q-ma-lg"
                outline
                :disable="loadingStatusDns"
                round
                color="teal-4"
                icon="restart_alt"
                @click="resetSort(Emails)"
                ><q-tooltip class="bg-orange-10 text-caption">
                  Rest sort state
                </q-tooltip>
              </q-btn>

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
import { exportFile, useQuasar } from "quasar";
import { ref } from "vue";
import { mapState, useStore } from "vuex";
const scrollComponent = ref(null);
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
const columns = [
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
  },

  setup() {
    const $q = useQuasar();
    const filter = ref("");
    const store = useStore();

    return {
      filter,
      mode: "list",
      columns,
      infos,
      pagination: {
        rowsPerPage: 1000,
      },
      persistent: ref(false),
      selected: ref([]),
      ticked: ref([]),
      expanded: ref([]),
      exportTable(Emails) {
        let csv =
          "Email\tAlias\tStatus\tTo\tFrom\tCC\tBCC\tReply-To\tBody\tTotal\tType\n";
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
          csv += Object.values(row).join("\t");
          csv += "\n";
        });

        const status = exportFile("Emails.csv", csv, "text/csv");

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
      currentBox: "",
      all: false,
      emailsinfinit: [],
      emails: [],
      password: "",
      host: "",
      scrolledToBottom: false,
      port: "",
      acceptedHeaders: ref([]),
      acceptedBody: ref([]),
      selectedBoxes: [],
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
    Emails() {
      if (this.loadingStatusDns) {
        this.emailsinfinit = this.retrievedEmails.slice(0, 20);
      }
      return this.retrievedEmails;
    },
    boxes() {
      return [...this.boxes];
    },

    percentage() {
      return this.progress.percentage;
    },
    Status() {
      return this.progress.status;
    },
    CurrentBox() {
      return this.progress.currentBox;
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
    this.getBoxes();
    this.boxOptions = this.$store.state.boxes;
    this.renderDialog = true;
  },

  methods: {
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
    resetSort(data) {
      var wordArr = [];
      var numArr = [];
      var emptyArr = [];
      data.forEach((el) => {
        if (Number(el.email.name.charAt(0))) {
          numArr.push(el);
        } else if (el.email.name != "") {
          wordArr.push(el);
        } else {
          emptyArr.push(el);
        }
      });
      wordArr.sort((a, b) => {
        return (
          !a.email.name - !b.email.name ||
          a.email.name.localeCompare(b.email.name)
        );
      });
      wordArr.sort((a, b) => b.field.total - a.field.total);
      numArr.sort((a, b) => a - b);
      emptyArr.sort((a, b) => b.field.total - a.field.total);
      let dataend = wordArr.concat(numArr);
      let sorted = dataend.concat(emptyArr);
      this.Emails = sorted;
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
    returnTotal(sender, reciever) {
      return sender + reciever;
    },
    returnRecipient(field) {
      if (Array.isArray(field[0])) {
        let count = 0;
        for (const i of field) {
          if (i.includes("to") || i.includes("cc") || i.includes("bcc")) {
            count += i[1];
          }
        }
        return count != 0 ? count : null;
      } else if (
        field.includes("to") ||
        field.includes("cc") ||
        field.includes("bcc")
      ) {
        return field[1];
      }
      return null;
    },
    filterMethod(rows, term) {
      console.log("hello");
      return rows.filter((e) => {
        if (typeof e.email.name == "undefined") {
          return e.email.address.includes(term);
        } else {
          return e.email.address.includes(term) || e.email.name.includes(term);
        }
      });
    },
    checkAll(allboxes) {
      let arr = [];
      function deepObject(obj) {
        for (let ele in obj) {
          if (obj[ele].label) {
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
      } else {
        this.selectedBoxes = [];
      }
    },

    fetchEmails() {
      var fields = [];
      var bot = this.boxes;

      //console.log(bot);
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
        boxes: this.selectedBoxes,
        fields: fields,
        folders: bot,
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
        //console.log(this.$store.gettersccc["example/getStates"].infoMessage);
        setTimeout(() => {
          this.showNotif(
            this.$store.getters["example/getStates"].infoMessage,
            "teal-5",
            "check"
          );
        }, 1000);
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
