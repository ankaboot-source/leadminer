<template>
  <q-page class="q-pa-sm">
    <find-emails />
    <ul
      v-for="email in retrievedEmails"
      :key="email.id"
    >
      <li>{{ retrievedEmails.length }}</li>
    </ul>
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
