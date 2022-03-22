<template>
  <q-page class="q-pa-sm">
    <find-emails />
  </q-page>
</template>

<script>
import { defineComponent, defineAsyncComponent } from "vue";
export default defineComponent({
  name: "DashboardComponent",
  components: {
    FindEmails: defineAsyncComponent(() =>
      import("components/Emails/SearchEmails")
    ),
  },
});
</script>
