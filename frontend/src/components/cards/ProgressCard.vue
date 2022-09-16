<template>
  <div class="text-h3 text-teal border">
    <q-banner rounded class="bg-tealgradient border">
      <q-chip :size="buttonColor" color="transparent" text-color="blue-grey-14">
        <div class="text-h5 text-weight-bolder q-ma-sm">{{ Emails }}</div>
        legit email address mined.
        <div class="text-h5 text-weight-bolder q-ma-sm">
          {{ InvalidDomain + NoReply }}
        </div>
        Poor emails addresses removed (
        <div class="text-h5 text-weight-bolder q-ma-sm">
          {{ InvalidDomain }}
        </div>
        invalid domain,
        <div class="text-h5 text-weight-bolder q-ma-sm">{{ NoReply }}</div>
        no-reply) </q-chip
      ><br />
      <q-chip :size="buttonColor" color="transparent" text-color="blue-grey-14">
        <div class="text-h5 text-weight-bolder q-ma-sm">
          {{ ScannedEmails }}
        </div>
        emails messages mined so far over
        <div class="text-h5 text-weight-bolder q-ma-sm">{{ TotalEmails }}</div>
        emails to mine
      </q-chip>
    </q-banner>
  </div>
</template>

<script>
import { defineComponent, computed } from "vue";
import { useQuasar } from "quasar";
export default defineComponent({
  setup() {
    const $q = useQuasar();
    const buttonColor = computed(() => {
      switch (true) {
        case $q.screen.lt.sm == true:
          return "0.7em";
        case $q.screen.gt.sm == true && $q.screen.lt.md == true:
          return "2em";

        case $q.screen.gt.md == true:
          return "1.15em";

        default:
          return "1em";
      }
    });

    return { buttonColor };
  },
  name: "ProgressStatus",
  props: {
    collectedEmails: Number(0),
    scannedEmails: Number(0),
    totalEmails: Number(0),
    scannedAddresses: Number(0),
    statistics: {},
  },
  computed: {
    TotalEmails: function () {
      return this.totalEmails;
    },
    ScannedEmails: function () {
      return this.scannedEmails;
    },
    InvalidDomain: function () {
      if (Object.keys(this.statistics).length == 0) {
        return 0;
      }
      return this.statistics.invalidDomain;
    },
    NoReply: function () {
      if (Object.keys(this.statistics).length == 0) {
        return 0;
      }
      return this.statistics.noReply;
    },

    ScannedAddresses: function () {
      return this.scannedAddresses;
    },
    Emails: function () {
      return this.collectedEmails;
    },
  },
});
</script>
<style scoped>
.border {
  border-radius: 10px;
  margin-right: 10px;
}
.bg-tealgradient {
  background-color: #e7e7e783;
}
</style>
