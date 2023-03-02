<template>
  <div class="text-h3 text-teal">
    <q-banner rounded>
      <q-chip :size="buttonColor" color="transparent" text-color="blue-grey-14">
        <div class="text-h5 text-weight-bolder q-ma-sm">
          {{ minedEmails }}
        </div>
        legit email addresses mined.
      </q-chip>
      <br />
      <q-chip :size="buttonColor" color="transparent" text-color="blue-grey-14">
        <div class="text-h5 text-weight-bolder q-ma-sm">
          {{ scannedEmails }}
        </div>
        emails messages fetched so far over
        <div class="text-h5 text-weight-bolder q-ma-sm">{{ totalEmails }}</div>
        emails to fetch.
      </q-chip>
      <br />
      <q-chip :size="buttonColor" color="transparent" text-color="blue-grey-14">
        <div class="text-h5 text-weight-bolder q-ma-sm">
          {{ extractedEmails }}
        </div>
        emails messages extracted over
        <div class="text-h5 text-weight-bolder q-ma-sm">
          {{ scannedEmails }}
        </div>
        emails to extract.
      </q-chip>
    </q-banner>
  </div>
</template>

<script>
import { useQuasar } from "quasar";
import { computed, defineComponent } from "vue";
export default defineComponent({
  name: "ProgressStatus",
  props: {
    extractedEmails: Number(0),
    minedEmails: Number(0),
    scannedEmails: Number(0),
    totalEmails: Number(0),
  },
  setup() {
    const $q = useQuasar();
    const buttonSize = computed(() => {
      switch (true) {
        case $q.screen.lt.sm === true:
          return "0.7em";
        case $q.screen.gt.sm === true && $q.screen.lt.md === true:
          return "2em";

        case $q.screen.gt.md === true:
          return "1.15em";

        default:
          return "1em";
      }
    });
    return { buttonColor: buttonSize };
  },
});
</script>
