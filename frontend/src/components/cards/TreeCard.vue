<template>
  <q-tree
    ref="tree"
    v-model:ticked="selected"
    class="col-10 col-sm-6 q-ma-sm"
    icon="arrow_forward_ios"
    :nodes="$props.boxes"
    node-key="path"
    color="teal"
    control-color="teal"
    tick-strategy="leaf"
  >
    <template #default-header="prop">
      <div
        class="full-width row inline no-wrap justify-between items-end content-center borderForBoxes"
      >
        <div class="col-10 text-weight-bold text-blue-grey-10 q-pb-xs">
          {{ prop.node.label }}
          <q-badge
            v-if="!prop.expanded"
            color="orange"
            class="q-ml-lg text-weight-medium"
            rounded
            floating
            transparent
          >
            {{ prop.node.path ? prop.node.cumulativeTotal : prop.node.total }}
            <q-tooltip v-if="prop.node.total && !prop.node.cumulativeTotal">
              Total email messages
            </q-tooltip>
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
      </div>
    </template>
  </q-tree>
</template>

<script>
import objectScan from "object-scan";
import { defineComponent, ref } from "vue";

const EMAIL_EXCLUDED_FOLDERS = [
  "mailspring",
  "outbox",
  "drafts",
  "junk",
  "trash",
  "\\all",
  "\\drafts",
  "\\junk",
  "\\trash",
];

export default defineComponent({
  name: "TreeCard",
  props: {
    boxes: {
      type: Array,
      default() {
        return [];
      },
    },
  },
  data() {
    return {
      selected: ref(this.getDefaultSelectedFolders(this.$props.boxes)),
    };
  },

  watch: {
    selected(newValue) {
      this.$store.commit("leadminer/setSelectedBoxes", newValue);
    },
  },
  methods: {
    /**
     * Filters out default selected folders from the input boxes based on email service
     * @param {Array} boxes - The array of folder names to filter
     * @returns {Array} - The filtered array of boxes
     */
    getDefaultSelectedFolders(boxes) {
      const filteredBoxes = [];

      objectScan(["**.path"], {
        joined: true,
        filterFn: ({ parent }) => {
          const { path, attribs } = parent;
          const folder = path.split("/");
          const folderName = folder.pop();
          const folderParent = folder.pop();

          const isExcluded = [...attribs, folderName, folderParent]
            .filter(Boolean)
            .map((name) => name.toLowerCase())
            .some((name) => EMAIL_EXCLUDED_FOLDERS.includes(name));

          if (!isExcluded) {
            filteredBoxes.push(path);
          }
        },
      })(boxes);

      return filteredBoxes;
    },
  },
});
</script>
<style></style>
