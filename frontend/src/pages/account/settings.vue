<template>
  <div class="grid gap-2">
    <Panel :header="t('profile_information')">
      <div class="grid gap-4">
        <div class="grid gap-2">
          <div>
            <label class="block mb-2">{{ t('full_name') }}</label>
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
            <label class="block mb-2" for="password">{{
              $t('auth.password')
            }}</label>
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
          :label="t('update')"
          :loading="isLoading"
          @click="updateProfile"
        />
      </div>
    </Panel>

    <!-- Delete Account Section -->
    <Panel :header="t('delete_account')">
      <div class="grid gap-2">
        <p>
          {{ t('delete_warning') }}
        </p>
        <Button
          class="w-full md:w-56 gap-4 justify-center"
          severity="danger"
          @click="showWarning"
        >
          <span class="material-icons">delete</span>
          <span>{{ t('delete_my_account') }}</span>
        </Button>
      </div>
    </Panel>

    <!-- Warning model Section -->
    <Dialog
      v-model:visible="showDeleteModal"
      modal
      :header="t('delete_account')"
      :style="{ width: '25rem' }"
    >
      <span class="p-text-secondary block mb-5">
        {{ t('delete_confirmation') }}
      </span>
      <div class="flex flex-row-reverse justify-content-start gap-2">
        <Button
          type="button"
          :label="t('delete')"
          severity="danger"
          :loading="isLoading"
          @click="deleteAccount"
        >
        </Button>
        <Button
          type="button"
          :label="$t('common.cancel')"
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

const { t } = useI18n({
  useScope: 'local',
});

const { t: $t } = useI18n({
  useScope: 'global',
});

const $toast = useToast();

const userId = ref('');
const email = ref('');
const fullName = ref('');
let oldFullName = '';
let isUpdated = false;
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
      summary: t('error'),
      detail: t('session_expired'),
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
        data: {
          Prehead: t('change_email.prehead'),
          Title: t('change_email.title'),
          Body1: t('change_email.body.p1'),
          Body2: t('change_email.body.p2'),
          Body3: t('change_email.body.p3'),
          Body4: t('change_email.body.p4'),
          Button: t('change_email.button'),
          Regards: $t('email_template.regards'),
          Footer: $t('email_template.footer'),
        },
      });

      if (error) {
        throw error;
      }

      $toast.add({
        severity: 'info',
        summary: t('email_updated'),
        detail: t('check_email_confirmation'),
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

      isUpdated = true;
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

      oldFullName = fullName.value;
      isUpdated = true;
    }

    await useSupabaseClient().auth.refreshSession();

    if (isUpdated) {
      $toast.add({
        severity: 'success',
        summary: t('profile_updated'),
        detail: t('profile_success'),
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
      summary: t('account_deleted'),
      detail: t('account_deleted_success'),
      life: 3000,
    });
    isLoading.value = false;
  } catch (err) {
    isLoading.value = false;
    throw err;
  }
}
</script>

<i18n lang="json">
{
  "en": {
    "profile_information": "Profile Information",
    "full_name": "Full Name",
    "update": "Update",
    "delete": "Delete",
    "delete_warning": "You can permanently delete your account including your mined data. You can't undo this action.",
    "delete_my_account": "Delete my account",
    "delete_confirmation": "Deleting your account is permanent. You will lose all your mining data.",
    "delete_account": "Delete account",
    "account_deleted": "Account deleted",
    "account_deleted_success": "Your account has been deleted successfully",
    "error": "Error",
    "session_expired": "Session is expired.",
    "email_updated": "Email address updated",
    "check_email_confirmation": "Please check your email to confirm the new email address.",
    "profile_updated": "Profile updated",
    "profile_success": "Profile information updated successfully",
    "change_email": {
      "prehead": "Confirm your email change",
      "title": "Confirm Your Email Change",
      "body": {
        "p1": "Welcome to ",
        "p2": "! We're happy to assist you with keeping your account information up to date. You recently requested to change the email address associated with your ",
        "p3": " account. Please click the button below to confirm your new email address and complete the update.",
        "p4": "If you didn't request this change, you can safely disregard this email. Your current email address will remain unchanged."
      },
      "button": "Confirm Email Address"
    }
  },
  "fr": {
    "profile_information": "Informations du profil",
    "full_name": "Nom et Prénom",
    "update": "Mettre à jour",
    "delete": "Supprimer",
    "delete_warning": "Vous pouvez supprimer définitivement votre compte, y compris vos données extraites. Vous ne pouvez pas annuler cette action.",
    "delete_my_account": "Supprimer mon compte",
    "delete_confirmation": "La suppression de votre compte est permanente. Vous perdrez toutes vos données déjà extraites.",
    "delete_account": "Supprimer le compte",
    "account_deleted": "Compte supprimé",
    "account_deleted_success": "Votre compte a été supprimé avec succès",
    "error": "Erreur",
    "session_expired": "La session est expirée.",
    "email_updated": "Adresse e-mail mise à jour",
    "check_email_confirmation": "Veuillez vérifier votre e-mail pour confirmer la nouvelle adresse e-mail.",
    "profile_updated": "Profil mis à jour",
    "profile_success": "Les informations du profil ont été mises à jour avec succès",
    "change_email": {
      "prehead": "Confirmez votre changement d'adresse e-mail",
      "title": "Confirmez votre changement d'adresse e-mail",
      "body": {
        "p1": "Bienvenue à ",
        "p2": "! Nous sommes heureux de vous aider à mettre à jour les informations relatives à votre compte. Vous avez récemment demandé à changer l'adresse e-mail associée à votre compte ",
        "p3": ". Veuillez cliquer sur le bouton ci-dessous pour confirmer votre nouvelle adresse e-mail et terminer la mise à jour.",
        "p4": "Si vous n'avez pas demandé ce changement, vous pouvez ignorer cet e-mail. Votre adresse e-mail actuelle restera inchangée."
      },
      "button": "Confirmez votre adresse e-mail"
    }
  }
}
</i18n>
