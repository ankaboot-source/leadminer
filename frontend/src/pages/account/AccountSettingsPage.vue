<template>
  <AppLayout class="q-px-lg">
    <h1 class="text-h4 text-bold">Account Settings</h1>
    <h2 class="text-h6 text-bold">Update your password</h2>
    <q-form class="q-gutter-sm flex column" @submit="updatePassword">
      <q-input
        v-model="password"
        :disable="isSocialLogin"
        filled
        :rules="passwordRules"
        label="New password"
        :type="isPwd ? 'password' : 'text'"
      >
        <template #append>
          <q-icon
            :name="isPwd ? 'visibility_off' : 'visibility'"
            class="cursor-pointer"
            @click="isPwd = !isPwd"
          />
        </template>
      </q-input>

      <q-btn
        no-caps
        type="submit"
        :disable="isSocialLogin"
        :loading="isLoading"
        class="text-h6"
        label="Update"
        color="indigo"
      />
    </q-form>
  </AppLayout>
</template>

<script setup lang="ts">
import { useQuasar } from "quasar";
import { passwordRules } from "src/helpers/password";
import { supabase } from "src/helpers/supabase";
import AppLayout from "src/layouts/AppLayout.vue";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

const $quasar = useQuasar();
const $router = useRouter();

const isSocialLogin = ref(false);
const password = ref("");
const isPwd = ref(true);
const isLoading = ref(false);

onMounted(async () => {
  isSocialLogin.value = Boolean(
    (await supabase.auth.getSession()).data.session?.provider_token
  );
});

async function updatePassword() {
  isLoading.value = true;
  try {
    const { error } = await supabase.auth.updateUser({
      password: password.value,
    });
    if (error) {
      throw error;
    }
    $quasar.notify({
      message: "Password updated successfully",
      color: "positive",
      icon: "check",
    });
    $router.push("/dashboard");
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
