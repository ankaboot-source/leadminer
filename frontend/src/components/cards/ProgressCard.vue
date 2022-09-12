<template>
  <div class="text-h3 text-teal">
    <q-badge :class="buttonColor" color="teal" outline
      >{{ Emails }} legit email address over {{ ScannedAddresses }} email
      address mined </q-badge
    ><br />
    <q-badge :class="buttonColor" color="teal-5" outline
      >{{ ScannedEmails }} emails messages mined so far over
      {{ TotalEmails }} emails to mine</q-badge
    >
    <q-badge :class="buttonColor" color="orange-14" outline
      >{{ InvalidDomain }} Invalid email address </q-badge
    ><br />
    <q-badge :class="buttonColor" color="orange-14" outline
      >{{ NoReply }} No-reply email address </q-badge
    ><br />
    <q-badge :class="buttonColor" color="orange-14" outline
      >{{ Transactional }} Transactional email address
    </q-badge>
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
    Transactional: function () {
      if (Object.keys(this.statistics).length == 0) {
        return 0;
      }
      return this.statistics.transactional;
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
<style>
.border {
  border-radius: 10px;
  margin-right: 10px;
}
</style>
