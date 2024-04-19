<template>
  <div class="mx-4">
    <div class="flex items-center">
      <Button
        class="bg-white border-none text-black"
        icon="pi pi-arrow-left"
        style="font-size: 2rem"
        label="Settings"
        @click="goToDashboard()"
      />
    </div>

    <h6>Profile Information</h6>
    <form class="grid gap-4" @submit="updateProfile">
      <div class="grid gap-2">
        <div>
          <label class="block text-900 text-md font-medium mb-2" for=""
            >Full Name</label
          >
          <InputText
            v-model="fullName"
            class="w-full md:w-30rem mb-5"
            type="text"
            placeholder="Full name"
            required
          />
        </div>
        <div>
          <label class="block text-900 text-md font-medium mb-2" for="email"
            >Email</label
          >
          <InputText
            v-model="email"
            :disabled="isSocialLogin"
            class="w-full"
            :invalid="!Boolean(email) && !isValidEmail(email)"
            type="email"
            placeholder="Email address"
            required
            aria-describedby="email-help"
          />
        </div>
        <div>
          <label class="block text-900 text-md font-medium mb-2" for="password"
            >Password</label
          >
          <Password
            v-model="password"
            class="w-full"
            :input-style="{ width: '100%' }"
            placeholder="password"
            toggle-mask
            required
            :invalid="Boolean(password) && !isValidPassword(password)"
          />
        </div>
      </div>

      <Button type="submit" label="Update" :loading="isLoading" />
    </form>
    <br />

    <!-- Delete Account Section -->
    <div>
      <h6>Delete Account</h6>
      <p>
        You can permanently delete your account including your mined data. You
        can't undo this action.
      </p>
      <Button
        class="max-lg:w-full gap-4 max-lg:justify-center"
        severity="danger"
        @click="showWarning"
        ><span class="material-icons" style="font-size: 1.5rem">delete</span
        ><span>Delete my account</span>
      </Button>
    </div>

    <!-- Warning model Section -->
    <Dialog
      v-model:visible="showDeleteModal"
      modal
      header="Delete account"
      :style="{ width: '25rem' }"
    >
      <span class="p-text-secondary block mb-5"
        >Deleting your account is permanent. You will lose all your mining
        data.</span
      >
      <div class="flex flex-row-reverse justify-content-start gap-2">
        <Button
          type="button"
          label="Delete"
          severity="danger"
          :loading="isLoading"
          @click="deleteAccount"
        ></Button>
        <Button
          type="button"
          label="Cancel"
          severity="secondary"
          @click="closeWarning"
        ></Button>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { logout } from '@/utils/auth';

const $quasar = useQuasar();
const $router = useRouter();

const userId = ref('');
const email = ref('');
const fullName = ref('');
const password = ref('');

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
