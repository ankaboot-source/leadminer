<template>
  <q-tree
    ref="tree"
    v-model:ticked="selected"
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
            v-if="!prop.expanded"
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
            :name="Scanned.includes(prop.node.label) ? 'check' : ''"
            color="orange"
            size="28px"
            class="q-mr-sm"
          />
        </div>
      </div> </template
  ></q-tree>
</template>

<script>
import { defineComponent, computed, ref } from "vue";
import objectScan from "object-scan";

const excludedFolders = [
  "spam",
  "corbeille",
  "brouillons",
  "draft",
  "trashed",
  "trash",
  "drafts",
]; //
export default defineComponent({
  name: "TreeCard",
  data() {
    return {
      selected: ref([]),
    };
  },
  props: {
    boxes: [],
    scannedBoxes: [],
  },

  computed: {
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
      if (selectedB.value.length > 0) {
        this.selected = selectedB.value;
      }
      return [...this.boxes];
    },
    Scanned() {
      return this.scannedBoxes;
    },
  },
  watch: {
    selected(newValue, oldValue) {
      this.$emit("selectedBoxes", newValue);
    },
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
                !this.selected.includes(value))
            ) {
              this.selected.push(value);
            }
          },
        })(this.boxes, { sum: 0 });
      }, 150);
    },
  },
});
</script>
<style>
.border {
  border-radius: 10px;
}
</style>
