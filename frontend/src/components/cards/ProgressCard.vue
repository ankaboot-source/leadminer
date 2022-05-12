<template>
  <q-card flat class="bg-transparent q-ml-lg" style="width: 100%">
    <q-circular-progress
      show-value
      class="text-white q-ma-md"
      :value="parseFloat(Percentage) * 100"
      size="120px"
      :thickness="0.19"
      :animation-speed="10"
      color="orange"
      center-color="grey-7"
      track-color="transparent"
      ><div></div>

      <div class="text-center q-pt-sm">
        <small class="text-white text-subtitle">
          {{ parseInt(parseFloat(Percentage) * 100) }}%
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
          <small class="text-green text-caption"> Valid email</small><br />
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
</template>

<script>
import { defineComponent } from "vue";

export default defineComponent({
  name: "ProgressStatus",
  props: {
    collectedEmails: Number(0),
    loadingStatusDns: Boolean(false),
    currentBox: "",
    percentage: Number(0),
  },
  computed: {
    Percentage: function () {
      console.log(this.percentage);
      return this.percentage;
    },
    CurrentBox: function () {
      return this.currentBox;
    },
    Emails: function () {
      return this.collectedEmails;
    },
    loadingStatusDns: function () {
      return this.loadingStatusDns;
    },
  },
});
</script>
<style>
.border {
  border-radius: 10px;
}
</style>
