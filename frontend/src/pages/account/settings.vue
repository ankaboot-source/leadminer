<template>
  <NuxtLayout name="app" class="q-px-md">
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
              v-close-popup
              class="q-ma-sm q-pa-sm"
              flat
              icon="close"
              size="sm"
              color="grey-7"
            />
          </div>
        </q-card-section>
        <q-separator />
        <!-- Buttons -->
        <q-card-actions align="right" class="q-pa-md q-pr-lg">
          <q-btn
            no-caps
            unelevated
            padding="sm md"
            class="secondary-button text-h6"
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
  </NuxtLayout>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { logout } from '@/utils/auth';
import { passwordRules } from '@/utils/password';

const $quasar = useQuasar();
const $router = useRouter();

const userId = ref('');
const email = ref('');
const fullName = ref('');
const password = ref('');

const isPwd = ref(true);
const isLoading = ref(false);

const showDeleteModal = ref(false);
const isSocialLogin = ref(false);

const { $api } = useNuxtApp();

onMounted(async () => {
  const { session } = (await useSupabaseClient().auth.getSession()).data;

  const { data: profile } = await useSupabaseClient()
    .from('profiles')
    .select('*')
    .single();

  if (!session || !profile) {
    $quasar.notify({
      message: 'Session is expired.',
      color: 'negative',
      icon: 'error',
    });
    await useSupabaseClient().auth.signOut();
    return;
  }

  const { provider_token: providerToken } = session;
  const { user_id: userid, full_name: userFullName } = profile;

  userId.value = userid;
  fullName.value = userFullName;
  email.value = String(session.user.email);
  isSocialLogin.value = Boolean(providerToken);
});

function showWarning() {
  showDeleteModal.value = true;
}

function closeWarning() {
  showDeleteModal.value = false;
}

function goToDashboard() {
  $router.push('/dashboard');
}

async function updateProfile() {
  isLoading.value = true;
  try {
    const canChangeEmailPassword = Boolean(isSocialLogin.value);

    if (canChangeEmailPassword && password.value.length > 0) {
      const { error } = await useSupabaseClient().auth.updateUser({
        email: email.value,
        password: password.value,
      });

      if (error) {
        throw error;
      }
    }
    const { error } = await useSupabaseClient()
      .from('profiles')
      // @ts-expect-error - Issue with @nuxt/supabase typing
      .update({
        email: canChangeEmailPassword ? email.value : undefined,
        full_name: fullName.value,
      })
      .eq('user_id', userId.value);

    if (error) {
      throw error;
    }

    await useSupabaseClient().auth.refreshSession();

    $quasar.notify({
      message: 'Profile information updated successfully',
      color: 'positive',
      icon: 'check',
    });
    isLoading.value = false;
  } catch (err) {
    isLoading.value = false;
    throw err;
  }
}

async function deleteAccount() {
  isLoading.value = true;
  try {
    await $api('/auth/users', {
      method: 'DELETE',
    });
    await logout();
    isLoading.value = false;
  } catch (err) {
    isLoading.value = false;
    throw err;
  }
}
</script>
~/src/utils/auth~/src/utils/password~/src/utils/auth~/src/utils/password
~~/utils/auth~~/utils/password
