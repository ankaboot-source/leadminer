<template>
  <q-card class="bg-transparent no-shadow no-border">
    <q-card-section class="q-pa-none">
      <div class="row q-col-gutter-sm">
        <q-item class="q-pa-none border"
          ><div
            v-for="(item, index) in items"
            :key="index"
            class="col-md-3 col-sm-12 col-xs-12"
          >
            <q-item-section
              v-if="iconPosition === 'left'"
              side
              :style="`background-color: ${item.color2}`"
              class="q-pa-md border q-ma-sm text-teal"
            >
              <q-icon :name="item.icon" color="white" size="24px" />
            </q-item-section>
            <q-item-section class="q-pa-md q-ml-none text-teal">
              <q-item-label class="text-teal text-h6 text-weight-bolder">
                {{ item.value }}
              </q-item-label>
              <q-item-label>{{ item.title }}</q-item-label>
            </q-item-section>
            <q-item-section
              v-if="iconPosition === 'right'"
              side
              class="q-mr-md text-white"
            >
              <q-icon :name="item.icon" color="white" size="44px" />
            </q-item-section>
          </div>
        </q-item>
      </div>
    </q-card-section>
  </q-card>
</template>

<script>
import { defineComponent } from "vue";

export default defineComponent({
  name: "CountCard",
  props: {
    iconPosition: {
      required: false,
      default: "left",
      type: String,
    },
    minedEmails: Number(0),
  },
  computed: {
    items: function () {
      return [
        {
          title: "Legit email address",
          icon: "email",
          value: this.minedEmails,
          color1: "#f8f9fa",
          color2: "#03c8a8",
        },
        {
          title: "over email address mined ",
          icon: "email",
          value: this.minedEmails,
          color1: "#f8f900",
          color2: "#03c8a8",
        },
        {
          title: "emails messages mined so far",
          icon: "email",
          value: this.minedEmails,
          color1: "#f8f9fa",
          color2: "#03c8a8",
        },
        {
          title: "Over emails to mine",
          icon: "email",
          value: this.minedEmails,
          color1: "#f8f9fa",
          color2: "#03c8a8",
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
