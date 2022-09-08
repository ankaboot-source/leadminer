<template>
  <q-tree
    ref="tree"
    class="col-12 col-sm-6 text-cyan-10"
    :nodes="OptionsFields"
    node-key="value"
    icon="arrow_forward_ios"
    tick-strategy="leaf"
    color="teal"
    v-model:ticked="selected"
    ><template class="row" v-slot:header-root="prop">
      <div class="col-5 text-weight-bold text-primary text-orange-8">
        {{ prop.node.label
        }}<q-badge
          v-if="prop.node.label == 'Body'"
          color="transparent"
          class="text-bold q-ml-lg"
          rounded
          floating
          align="middle"
          outlined
          transparent
          ><q-icon name="o_info" color="orange" size="22px" /><q-tooltip
            anchor="bottom middle"
            self="top middle"
            class="bg-orange-6 text-white text-caption"
          >
            Emails addresses found inside the email
          </q-tooltip></q-badge
        >
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
            ><q-icon name="o_info" color="orange" size="22px" /><q-tooltip
              anchor="bottom middle"
              class="bg-orange-6 text-white text-caption"
              self="top middle"
            >
              Emails addresses you'll answer to
            </q-tooltip></q-badge
          >
        </div>
      </div></template
    ></q-tree
  >
</template>

<script>
import { defineComponent, computed, ref } from "vue";
import { useQuasar } from "quasar";
export default defineComponent({
  setup() {
    const $q = useQuasar();
    const buttonColor = computed(() => {
      switch (true) {
        case $q.screen.lt.sm == true:
          return "text-body2";
        case $q.screen.lt.md == true:
          return "text-subtitle2";
        case $q.screen.lt.lg == true:
          return "text-subtitle1";
        case $q.screen.lt.xl == true:
          return "text-h6";
        default:
          return "text-h6";
      }
    });

    return { buttonColor };
  },
  name: "FieldsCard",
  data() {
    return {
      selected: ref([]),
      optionsFields: [
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
        {
          label: "Body",
          value: "1",
          header: "root",
        },
      ],
    };
  },
  props: {
    selectedFields: {
      type: Array,
      default() {
        return [];
      },
    },
  },
  mounted() {
    this.selected = this.selectedFields;
  },
  computed: {
    OptionsFields: function () {
      return this.optionsFields;
    },
  },
  watch: {
    selected(newValue, oldValue) {
      this.$emit("selectedFieldsChanged", newValue);
    },
  },
});
</script>
<style>
.border {
  border-radius: 10px;
}
</style>
