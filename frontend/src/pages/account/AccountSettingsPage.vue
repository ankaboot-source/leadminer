<template>
  <AppLayout class="q-px-lg">
    <h1 class="text-h4">
      <q-btn flat icon="arrow_back" round @click="goToDashboard()" />
      Settings
    </h1>
    <h2 class="text-h6">Profile Information</h2>
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
        type="submit"
        :loading="isLoading"
        class="text-h6"
        label="Update"
        color="indigo"
      />
    </q-form>
    <br />
    <!-- Delete Account Section -->
    <div>
      <h2 class="text-h6">Delete Account</h2>
      <p class="text-body1">
        You can permanently delete your account including your mined data. You
        can't undo this action.
      </p>
      <q-btn
        no-caps
        icon="delete"
        label="Delete my account"
        color="negative"
        unelevated
        @click="showWarning"
      />
    </div>

    <!-- Warning model Section -->
    <q-dialog v-model="showDeleteModal" no-refocus>
      <q-card class="delete-modal q-pa-md">
        <div style="flex: 1; text-align: right">
          <q-btn v-close-popup dense flat icon="close"></q-btn>
        </div>
        <q-card-section class="delete-modal-content">
          <p class="text-h6">
            ⚠️ Deleting your account is permanent. You will lose all your mining
            data.
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            no-caps
            class="text-h6"
            outline
            color="secondary"
            label="Cancel"
            unelevated
            @click="closeWarning"
          />

          <q-btn
            no-caps
            class="text-h6"
            label="Delete"
            color="negative"
            :loading="isLoading"
            unelevated
            @click="deleteAccount"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </AppLayout>
</template>

<script setup lang="ts">
import { User } from "@supabase/supabase-js";
import { useQuasar } from "quasar";
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
    const { error } = await supabase.auth.updateUser({
      data: {
        name: fullName.value,
        full_name: fullName.value,
        email: email.value,
      },
      email: email.value,
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
    const user = (await supabase.auth.getSession()).data.session?.user as User;
    const { error } = await supabase.rpc("delete_user_and_related_data", {
      userid: user.id,
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
    await supabase.auth.signOut();
  }
}
</script>
