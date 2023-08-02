<template>
  <AppLayout class="q-px-md">
    <div class="flex items-center">
      <q-btn flat icon="arrow_back" round @click="goToDashboard()" />
      <div class="text-h4">Settings</div>
    </div>
    <h2 class="text-h6 q-mt-xs">Profile Information</h2>
    <q-form class="q-gutter-sm flex column" @submit="updateProfile">
      <q-input v-model="fullName" outlined label="Full Name" />
      <q-input
        v-model="email"
        :disable="isSocialLogin"
        outlined
        label="Email"
      />
      <q-input
        v-model="password"
        outlined
        hide-bottom-space
        label="Password"
        :disable="isSocialLogin"
        :rules="passwordRules"
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
        :loading="isLoading"
        class="text-h6"
        label="Update"
        color="primary"
        unelevated
      />
    </q-form>
    <br />
    <!-- Delete Account Section -->
    <div>
      <h2 class="text-h6 q-mb-xs">Delete Account</h2>
      <p class="text-body1">
        You can permanently delete your account including your mined data. You
        can't undo this action.
      </p>
      <q-btn
        no-caps
        class="text-h6"
        icon="delete"
        label="Delete my account"
        color="negative"
        unelevated
        @click="showWarning"
      />
    </div>

    <!-- Warning model Section -->
    <q-dialog v-model="showDeleteModal">
      <q-card>
        <q-card-section class="row items-center q-card-actions">
          <p class="text-h6 q-ma-none q-mr-md">
            ⚠️ Deleting your account is permanent. You will lose all your mining
            data.
          </p>
          <q-space />
          <div class="absolute-top-right">
            <q-btn
              class="q-ma-sm q-pa-sm"
              v-close-popup
              flat
              icon="close"
              size="sm"
              color="grey-7"
            ></q-btn>
          </div>
        </q-card-section>
        <q-separator />
        <!-- Buttons -->
        <q-card-actions align="right" class="q-pa-md q-pr-lg">
          <q-btn
            no-caps
            unelevated
            padding="sm md"
            class="custom-btn-style text-h6"
            label="Cancel"
            @click="closeWarning"
          />
          <q-btn
            no-caps
            unelevated
            padding="sm md"
            color="negative"
            class="text-h6"
            label="Delete"
            :loading="isLoading"
            @click="deleteAccount"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { AxiosError } from "axios";
import { useQuasar } from "quasar";
import { api } from "src/boot/axios";
import { logout } from "src/helpers/auth";
import { passwordRules } from "src/helpers/password";
import { supabase } from "src/helpers/supabase";
import AppLayout from "src/layouts/AppLayout.vue";
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

const $quasar = useQuasar();
const $router = useRouter();

const fullName = ref("");
const email = ref("");
const password = ref("");

const isPwd = ref(true);
const isLoading = ref(false);

const showDeleteModal = ref(false);
const isSocialLogin = ref(false);

onMounted(async () => {
  const { session } = (await supabase.auth.getSession()).data;

  if (session) {
    const { full_name: fullUserName, email: userEmail } =
      session.user.user_metadata;
    fullName.value = fullUserName;
    email.value = userEmail;
    isSocialLogin.value = Boolean(session.provider_token);
  }
});

function showWarning() {
  showDeleteModal.value = true;
}

function closeWarning() {
  showDeleteModal.value = false;
}

function goToDashboard() {
  $router.push("/dashboard");
}

async function updateProfile() {
  isLoading.value = true;
  try {
    const body = {
      data: {
        name: fullName.value,
        full_name: fullName.value,
        email: email.value,
      },
      email: email.value,
      password: password.value.length > 0 ? password.value : undefined,
    };
    const { error } = await supabase.auth.updateUser(body);

    if (error) {
      throw error;
    }

    await supabase.auth.refreshSession();

    $quasar.notify({
      message: "Profile information updated successfully",
      color: "positive",
      icon: "check",
    });
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

async function deleteAccount() {
  isLoading.value = true;
  try {
    const { error } = (await api.delete("/auth/users")).data;

    if (error) {
      throw error;
    }

    await logout();
  } catch (error) {
    let message =
      "Apologies, an unexpected error has occurred. Please try again later.";

    if (error instanceof Error) {
      message = error.message;
    }

    if (error instanceof AxiosError) {
      const err =
        error.response?.data?.error ?? error.response?.data?.error ?? error;

      if (err.message?.toLowerCase() === "network error") {
        message =
          "Unable to access server. Please retry again or contact your service provider.";
      } else {
        message = err.message;
      }
    }

    $quasar.notify({
      message,
      color: "negative",
      icon: "error",
    });
  } finally {
    isLoading.value = false;
  }
}
</script>
<style>
.custom-btn-style {
  border: 1px solid #abb1ba;
}
</style>
