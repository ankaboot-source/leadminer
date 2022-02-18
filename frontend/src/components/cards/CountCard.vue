<template>
  <q-card class="bg-transparent no-shadow no-border">
    <q-card-section class="q-pa-none">
      <div class="row q-col-gutter-sm">
        <div
          v-for="(item, index) in items"
          :key="index"
          class="col-md-6 col-sm-12 col-xs-12"
        >
          <q-item
            :style="`background-color: ${item.color1}`"
            class="q-pa-none border"
          >
            <q-item-section
              v-if="icon_position === 'left'"
              side
              :style="`background-color: ${item.color2}`"
              class="q-pa-md border q-ma-sm text-teal"
            >
              <q-icon :name="item.icon" color="white" size="24px"></q-icon>
            </q-item-section>
            <q-item-section class="q-pa-md q-ml-none text-teal">
              <q-item-label class="text-teal text-h6 text-weight-bolder">{{
                item.value
              }}</q-item-label>
              <q-item-label>{{ item.title }}</q-item-label>
            </q-item-section>
            <q-item-section
              v-if="icon_position === 'right'"
              side
              class="q-mr-md text-white"
            >
              <q-icon :name="item.icon" color="white" size="44px"></q-icon>
            </q-item-section>
          </q-item>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script>
import { defineComponent } from "vue";

export default defineComponent({
  name: "CountCard",
  props: {
    icon_position: {
      required: false,
      default: "left",
    },
    collectedEmails: 0,
  },
  computed: {
    items: function () {
      return [
        {
          title: "Collected emails",
          icon: "email",
          value: this.collectedEmails,
          color1: "#f8f9fa",
          color2: "#03c8a8",
        },
        {
          title: "Exported email",
          icon: "archive",
          value: "0",
          color1: "#f8f9fa",
          color2: "#3ca88e",
        },
      ];
    },
  },
});
</script>
<style>
.border {
  border-radius: 10px;
}
</style>
