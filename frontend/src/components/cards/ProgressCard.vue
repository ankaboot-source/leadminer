<template>
  <!-- <q-stepper v-model="step" ref="stepper" color="primary" animated>
    <q-step
      :name="1"
      title="Initialize Connection..."
      icon="settings"
      :done="step > 1"
      style="min-height: 200px"
    >
    </q-step>

    <q-step
      :name="2"
      title="Mining messages"
      icon="create_new_folder"
      :done="step > 2"
      style="min-height: 200px"
    >
    </q-step>

    <q-step
      :name="3"
      title="Done"
      icon="assignment"
      disable
      style="min-height: 200px"
    >
      This step won't show up because it is disabled.
    </q-step>

    <template v-slot:navigation>
       <q-stepper-navigation>
        <q-btn
          @click="$refs.stepper.next()"
          color="primary"
          :label="step === 4 ? 'Finish' : 'Continue'"
        />
        <q-btn
          v-if="step > 1"
          flat
          color="primary"
          @click="$refs.stepper.previous()"
          label="Back"
          class="q-ml-sm"
        />
      </q-stepper-navigation> -->
  <div class="text-h3 text-teal">
    <q-badge :class="buttonColor" color="teal" outline
      >{{ Emails }} legit email address over {{ ScannedAddresses }} email
      address mined </q-badge
    ><br />
    <q-badge :class="buttonColor" color="teal-5" outline
      >{{ ScannedEmails }} emails messages mined so far over
      {{ TotalEmails }} emails to mine</q-badge
    >
  </div>
</template>

<!-- <q-circular-progress
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
  >-->

<script>
import { defineComponent, computed } from "vue";
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
  name: "ProgressStatus",
  props: {
    collectedEmails: Number(0),
    loadingStatusDns: Boolean(false),
    scannedEmails: Number(0),
    totalEmails: Number(0),
    scannedAddresses: Number(0),
  },
  computed: {
    TotalEmails: function () {
      return this.totalEmails;
    },
    ScannedEmails: function () {
      return this.scannedEmails;
    },
    ScannedAddresses: function () {
      return this.scannedAddresses;
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
