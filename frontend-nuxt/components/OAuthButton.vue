<template>
  <Button :icon="icon" :label="label" outlined size="large" @click="loginWithOAuth(source)" severity="secondary" />
</template>
<script setup lang="ts">
import type { Provider } from "@supabase/supabase-js";
import Button from "./Button.vue";
import { ref } from "vue";

const supabase = useSupabaseClient();

const { label, icon, source, } = defineProps<{
  label: string;
  icon: string;
  size: "large" | "small";
  source: Provider;
  align?: "left" | "right" | "center" | "around" | "between" | "evenly";
}>();

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
    }
  } finally {
    isLoading.value = false;
  }
}
</script>