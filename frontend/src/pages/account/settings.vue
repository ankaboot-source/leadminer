<template>
  <div class="grid gap-2">
    <Panel header="Profile Information">
      <div class="grid gap-4">
        <div class="grid gap-2">
          <div>
            <label class="block mb-2">Full Name</label>
            <InputText
              v-model="fullName"
              class="w-full md:w-30rem"
              type="text"
            />
          </div>
          <div>
            <label class="block mb-2" for="email">Email</label>
            <InputText
              v-model="email"
              :disabled="isSocialLogin"
              class="w-full"
              :invalid="isInvalidEmail(email)"
              type="email"
              aria-describedby="email-help"
            />
          </div>
          <div>
            <label class="block mb-2" for="password">Password</label>
            <Password
              v-model="password"
              class="w-full"
              :input-style="{ width: '100%' }"
              toggle-mask
              :invalid="isInvalidPassword(password)"
              :input-props="{ autocomplete: 'new-password' }"
            />
          </div>
        </div>

        <Button
          class="w-full md:w-56 gap-4"
          type="submit"
          label="Update"
          :loading="isLoading"
          @click="updateProfile"
        />
      </div>
    </Panel>

    <!-- Delete Account Section -->
    <Panel header="Delete Account">
      <div class="grid gap-2">
        <p>
          You can permanently delete your account including your mined data. You
          can't undo this action.
        </p>
        <Button
          class="w-full md:w-56 gap-4 justify-center"
          severity="danger"
          @click="showWarning"
        >
          <span class="material-icons">delete</span>
          <span>Delete my account</span>
        </Button>
      </div>
    </Panel>

    <!-- Warning model Section -->
    <Dialog
      v-model:visible="showDeleteModal"
      modal
      header="Delete account"
      :style="{ width: '25rem' }"
    >
      <span class="p-text-secondary block mb-5">
        Deleting your account is permanent. You will lose all your mining data.
      </span>
      <div class="flex flex-row-reverse justify-content-start gap-2">
        <Button
          type="button"
          label="Delete"
          severity="danger"
          :loading="isLoading"
          @click="deleteAccount"
        >
        </Button>
        <Button
          type="button"
          label="Cancel"
          severity="secondary"
          @click="closeWarning"
        >
        </Button>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

const $toast = useToast();

const userId = ref('');
const email = ref('');
const fullName = ref('');
let oldFullName = '';
const password = ref('');

const isLoading = ref(false);

const showDeleteModal = ref(false);
const isSocialLogin = ref(false);

const { $api } = useNuxtApp();

onMounted(async () => {
  useRouter().replace({ query: {} });
  const { session } = (await useSupabaseClient().auth.getSession()).data;

  const { data: profile } = await useSupabaseClient()
    .from('profiles')
    .select('*')
    .single();

  if (!session || !profile) {
    $toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Session is expired.',
      life: 3000,
    });
    await signOut();
    return;
  }

  const { provider_token: providerToken } = session;
  const { user_id: userid, full_name: userFullName } = profile;

  userId.value = userid;
  fullName.value = userFullName;
  oldFullName = userFullName;
  email.value = String(session.user.email);
  isSocialLogin.value = Boolean(providerToken);
});

function showWarning() {
  showDeleteModal.value = true;
}

function closeWarning() {
  showDeleteModal.value = false;
}

async function updateProfile() {
  isLoading.value = true;

  const { value: user } = useSupabaseUser();

  try {
    if (user?.email !== email.value) {
      const { error } = await useSupabaseClient().auth.updateUser({
        email: user?.email !== email.value ? email.value : undefined,
      });

      if (error) {
        throw error;
      }

      $toast.add({
        severity: 'info',
        summary: 'Email address updated',
        detail: 'Please check your email to confirm the new email address.',
        life: 3000,
      });
    }

    if (password.value.length) {
      const { error } = await useSupabaseClient().auth.updateUser({
        password: password.value,
      });

      if (error) {
        throw error;
      }
    }

    if (fullName.value.length && oldFullName !== fullName.value) {
      const { error } = await useSupabaseClient<{
        full_name: string;
      }>()
        .from('profiles')
        .update({
          full_name: fullName.value,
        })
        .eq('user_id', userId.value);

      if (error) {
        throw error;
      }
    }

    await useSupabaseClient().auth.refreshSession();

    if (
      password.value.length ||
      (fullName.value.length && oldFullName !== fullName.value)
    ) {
      $toast.add({
        severity: 'success',
        summary: 'Profile updated',
        detail: 'Profile information updated successfully',
        life: 3000,
      });
    }

    isLoading.value = false;
  } catch (error) {
    $toast.add({
      severity: 'error',
      summary: 'Oops!',
      detail: (error as Error).message,
      life: 3000,
    });

    isLoading.value = false;

    throw error;
  }
}

async function deleteAccount() {
  isLoading.value = true;
  try {
    await $api('/auth/users', {
      method: 'DELETE',
    });
    signOutManually();
    $toast.add({
      severity: 'success',
      summary: 'Account deleted',
      detail: 'Your account has been deleted successfully',
      life: 3000,
    });
    isLoading.value = false;
  } catch (err) {
    isLoading.value = false;
    throw err;
  }
}
</script>
