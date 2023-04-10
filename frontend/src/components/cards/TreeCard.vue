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
import { filterDefaultSelectedFolders } from "src/helpers/treeCardHelpers";
import { defineComponent, ref } from "vue";

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
