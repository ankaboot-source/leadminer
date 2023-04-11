<template>
  <q-tree
    ref="tree"
    v-model:ticked="selected"
    class="col-10 col-sm-6 q-ma-sm"
    icon="arrow_forward_ios"
    :nodes="Boxes"
    node-key="path"
    color="teal"
    tick-strategy="leaf"
    @update:ticked="Ticked"
  >
    <template #default-header="prop">
      <div
        class="full-width row inline no-wrap justify-between items-end content-center borderForBoxes"
      >
        <div class="col-10 text-weight-bold text-primary q-pb-xs">
          {{ prop.node.label }}
          <q-badge
            v-if="!prop.expanded"
            color="orange"
            class="q-ml-lg"
            rounded
            floating
            transparent
          >
            {{ prop.node.path ? prop.node.cumulativeTotal : prop.node.total }}
          </q-badge>
          <q-badge
            v-else
            color="orange"
            class="q-ml-lg"
            rounded
            floating
            transparent
          >
            {{ prop.node.totalIndiv }}
          </q-badge>
        </div>
        <div class="col-2">
          <q-icon
            :name="Scanned.includes(prop.node.label) ? 'check' : ''"
            color="orange"
            size="28px"
            class="q-mr-sm"
          />
        </div>
      </div>
    </template>
  </q-tree>
</template>

<script>
import objectScan from "object-scan";
import { defineComponent, ref } from "vue";

const EMAIL_EXCLUDED_FOLDERS = [
  "junk",
  "mailspring",
  "spam",
  "corbeille",
  "brouillons",
  "draft",
  "trashed",
  "trash",
  "drafts",
  "important",
  "sent mail",
  "starred",
  "deleted",
  "outbox",
];
const GMAIL_EXCLUDED_FOLDERS = ["inbox", ...EMAIL_EXCLUDED_FOLDERS];
const OUTLOOK_EXCLUDED_FOLDERS = [...EMAIL_EXCLUDED_FOLDERS];

/**
 * Filters out default selected folders from the input boxes based on email service
 * @param {Array} boxes - The array of folder names to filter
 * @returns {Array} - The filtered array of boxes
 */
 function filterDefaultSelectedFolders(boxes) {
  const email = boxes[0].label;
  const excludedFolders = email.includes("gmail")
    ? GMAIL_EXCLUDED_FOLDERS
    : OUTLOOK_EXCLUDED_FOLDERS;

  const filteredBoxes = [];

  objectScan(["**.path"], {
    joined: true,
    filterFn: ({ value }) => {
      const folderName = value.slice(value.lastIndexOf("/") + 1).toLowerCase();
      if (!excludedFolders.includes(folderName)) {
        filteredBoxes.push(value);
      }
    },
  })(boxes);

  return filteredBoxes;
}


export default defineComponent({
  name: "TreeCard",
  props: {
    boxes: {
      type: Array,
      default() {
        return [];
      },
    },
    scannedBoxes: {
      type: Array,
      default() {
        return [];
      },
    },
  },
  emits: ["selected-boxes"],
  data() {
    return {
      selected: ref([]),
    };
  },

  computed: {
    Boxes() {
      const selectedB = filterDefaultSelectedFolders(this.boxes);

      if (selectedB.length > 0) {
        // TODO : Rework this
        // eslint-disable-next-line vue/no-side-effects-in-computed-properties
        this.selected = selectedB;
      }
      return [...this.boxes];
    },
    Scanned() {
      return this.scannedBoxes;
    },
  },
  watch: {
    selected(newValue) {
      this.$emit("selected-boxes", newValue);
    },
  },
  methods: {
    Ticked() {
      setTimeout(() => {
        objectScan(["**.path"], {
          joined: true,
          filterFn: ({ value }) => {
            if (
              this.$refs.tree.isTicked(value) &&
              !this.selected.includes(value)
            ) {
              this.selected.push(value);
            }
            if (
              !this.$refs.tree.isTicked(value) &&
              this.selected.includes(value)
            ) {
              let index = this.selected.indexOf(value);
              if (index !== -1) {
                this.selected.splice(index, 1);
              }
            }
          },
        })(this.boxes, { sum: 0 });
      }, 200);
    },
  },
});
</script>
<style>
.border {
  border-radius: 10px;
}
</style>
