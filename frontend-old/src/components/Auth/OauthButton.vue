<template>
  <q-btn
    :loading="isLoading"
    no-caps
    unelevated
    :align="align"
    :size="size"
    :icon="icon"
    :label="label"
    @click="loginWithOAuth(source)"
  />
</template>
<script setup lang="ts">
import { Provider } from "@supabase/supabase-js";
import { useQuasar } from "quasar";
import { ref } from "vue";
import { supabase } from "src/helpers/supabase";

const { label, icon, size, source, align } = defineProps<{
  label: string;
  icon: string;
  size: string;
  source: Provider;
  align: "left" | "right" | "center" | "around" | "between" | "evenly";
}>();

const $quasar = useQuasar();
const isLoading = ref(false);

async function loginWithOAuth(provider: Provider) {
  isLoading.value = true;
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        skipBrowserRedirect: false,
        redirectTo: `${window.location.origin}/dashboard`,
        scopes: "email",
      },
    });
    if (error) {
      throw error;
    }
  } catch (error) {
    if (error instanceof Error) {
      $quasar.notify({
        message: error.message,
        color: "negative",
        icon: "error",
      });
    }
  } finally {
    isLoading.value = false;
  }
}
</script>
