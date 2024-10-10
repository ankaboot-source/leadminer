<template>
  <div class="grid gap-2">
    <Panel :header="t('profile_information')">
      <div class="grid gap-4">
        <div class="grid gap-2">
          <div>
            <label class="block mb-2">{{ t('full_name') }}</label>
            <InputText
              v-model="fullnameInput"
              class="w-full md:w-30rem"
              type="text"
            />
          </div>
          <div>
            <label class="block mb-2" for="email">Email</label>
            <InputText
              v-model="emailInput"
              :disabled="isSocialLogin"
              class="w-full"
              :invalid="isInvalidEmail(emailInput ?? '')"
              type="email"
              aria-describedby="email-help"
            />
          </div>
          <div>
            <label class="block mb-2" for="password">{{
              $t('auth.password')
            }}</label>
            <Password
              v-model="passwordInput"
              class="w-full"
              :input-style="{ width: '100%' }"
              toggle-mask
              :invalid="isInvalidPassword(passwordInput)"
              :input-props="{ autocomplete: 'new-password' }"
              :weak-label="$t('auth.suggestion_weak_label')"
              :medium-label="$t('auth.suggestion_medium_label')"
              :strong-label="$t('auth.suggestion_strong_label')"
            >
              <template #header>
                <h6>{{ $t('auth.pick_password') }}</h6>
              </template>
              <template #footer>
                <Divider />
                <p class="mt-2">{{ $t('auth.suggestions') }}</p>
                <ul class="pl-2 ml-2 mt-0" style="line-height: 1.5">
                  <li>
                    <i
                      v-if="passwordHasLowerCase"
                      class="pi pi-check-square"
                    ></i>
                    <i v-else class="pi pi-stop"></i>
                    {{ $t('auth.suggestion_lowercase') }}
                  </li>
                  <li>
                    <i
                      v-if="passwordHasUpperCase"
                      class="pi pi-check-square"
                    ></i>
                    <i v-else class="pi pi-stop"></i>
                    {{ $t('auth.suggestion_uppercase') }}
                  </li>
                  <li>
                    <i v-if="passwordHasNumber" class="pi pi-check-square"></i>
                    <i v-else class="pi pi-stop"></i>
                    {{ $t('auth.suggestion_numeric') }}
                  </li>
                  <li>
                    <i
                      v-if="passwordInput.length >= 8"
                      class="pi pi-check-square"
                    ></i>
                    <i v-else class="pi pi-stop"></i>
                    {{ $t('auth.suggestion_min_chars') }}
                  </li>
                </ul>
              </template>
            </Password>
          </div>
        </div>

        <Button
          class="w-full md:w-60 gap-4"
          type="submit"
          :label="t('update')"
          :loading="isLoading"
          :disabled="disableUpdateButton"
          @click="updateUserDetailsButton"
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
          class="w-full md:w-60 gap-4 justify-center"
          severity="danger"
          @click="showWarning"
        >
          <MdiIcon icon="mdiDelete" size="1.5rem" />
          <span>{{ t('delete_my_account') }}</span>
        </Button>
      </div>
    </Panel>

    <!-- Legal Account Section -->
    <Panel :header="$t('auth.legal_information')">
      <LegalInformation />
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
          id="delete-account-button"
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
import type { UserAttributes } from '@supabase/supabase-js';

import { isInvalidEmail } from '@/utils/email';
import {
  hasLowerCase,
  hasNumber,
  hasUpperCase,
  isInvalidPassword,
} from '@/utils/password';
import LegalInformation from '~/components/auth/LegalInformation.vue';
import type { Profile } from '~/types/profile';

const { t } = useI18n({
  useScope: 'local',
});

const { t: $t } = useI18n({
  useScope: 'global',
});

const $toast = useToast();
const { $api } = useNuxtApp();
const $user = useSupabaseUser();
const $profile = useSupabaseUserProfile();

const isLoading = ref(false);
const showDeleteModal = ref(false);

const emailInput = ref($profile.value?.email);
const fullnameInput = ref($profile.value?.full_name);
const passwordInput = ref('');
const isSocialLogin = ref($user.value?.app_metadata.provider === 'email');

const disableUpdateButton = computed(
  () =>
    emailInput.value === $profile.value?.email &&
    fullnameInput.value === $profile.value?.full_name &&
    (passwordInput.value.length === 0 ||
      isInvalidPassword(passwordInput.value)),
);

const passwordHasLowerCase = computed(() => hasLowerCase(passwordInput.value));
const passwordHasUpperCase = computed(() => hasUpperCase(passwordInput.value));
const passwordHasNumber = computed(() => hasNumber(passwordInput.value));

function showWarning() {
  showDeleteModal.value = true;
}

function closeWarning() {
  showDeleteModal.value = false;
}

async function updateUserAccount(userAccount: UserAttributes) {
  const { error: accountUpdateError } =
    await useSupabaseClient().auth.updateUser({ ...userAccount });

  if (accountUpdateError) {
    throw accountUpdateError;
  }

  if (userAccount.email) {
    $toast.add({
      severity: 'info',
      summary: t('email_update'),
      detail: t('email_update_detail'),
      life: 5000,
    });
  }

  if (userAccount.password) {
    $toast.add({
      severity: 'success',
      summary: t('password_updated'),
      detail: t('password_update_detail'),
      life: 3000,
    });
  }
}

async function updateUserProfile(userProfile: Partial<Profile>) {
  const { error: emailUpdateError } = await useSupabaseClient<Profile>()
    .from('profiles')
    .update({ ...userProfile })
    .eq('user_id', $profile.value?.user_id);

  if (emailUpdateError) {
    throw emailUpdateError;
  }

  $toast.add({
    severity: 'success',
    summary: t('profile_updated'),
    detail: t('profile_success'),
    life: 3000,
  });
}

async function updateUserDetailsButton() {
  try {
    isLoading.value = true;

    const userAccount: UserAttributes = {};
    const userProfile: Partial<Profile> = {};

    const { email: currentEmail, full_name: currentFullName } =
      $profile.value as Profile;

    if (emailInput.value !== currentEmail) {
      // user changed his email
      userAccount.email = emailInput.value;
      userAccount.data = {
        Prehead: t('change_email.prehead'),
        Title: t('change_email.title'),
        Body1: t('change_email.body.p1'),
        Body2: t('change_email.body.p2'),
        Body3: t('change_email.body.p3'),
        Body4: t('change_email.body.p4'),
        Button: t('change_email.button'),
        Regards: $t('email_template.regards'),
        Footer: $t('email_template.footer'),
      };
    }

    if (passwordInput.value.length) {
      if (isInvalidPassword(passwordInput.value)) throw new Error();
      userAccount.password = passwordInput.value;
    }

    if (fullnameInput.value !== currentFullName) {
      userProfile.full_name = fullnameInput.value;
    }

    if (Object.keys(userAccount).length) {
      await updateUserAccount(userAccount);
    }
    if (Object.keys(userProfile).length) {
      await updateUserProfile(userProfile);
    }
  } catch (error) {
    $toast.add({
      severity: 'error',
      summary: 'Oops!',
      detail: (error as Error).message,
      life: 3000,
    });
  } finally {
    isLoading.value = false;
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
    "delete_my_account": "Delete",
    "delete_confirmation": "Deleting your account is permanent. You will lose all your mining data.",
    "delete_account": "Delete account",
    "account_deleted": "Account deleted",
    "account_deleted_success": "Your account has been deleted successfully",
    "error": "Error",
    "session_expired": "Session is expired.",
    "email_update": "Email address update",
    "email_update_detail": "Please check your email to confirm the new email address.",
    "password_updated": "Password updated",
    "password_update_detail": "Your password has been updated successfully.",
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
    "full_name": "Nom complet",
    "update": "Mettre à jour",
    "delete": "Supprimer",
    "delete_warning": "Vous pouvez supprimer définitivement votre compte, y compris vos données extraites. Vous ne pouvez pas annuler cette action.",
    "delete_my_account": "Supprimer",
    "delete_confirmation": "La suppression de votre compte est permanente. Vous perdrez toutes vos données déjà extraites.",
    "delete_account": "Supprimer le compte",
    "account_deleted": "Compte supprimé",
    "account_deleted_success": "Votre compte a été supprimé avec succès",
    "error": "Erreur",
    "session_expired": "La session est expirée.",
    "email_update": "Adresse e-mail mise à jour",
    "email_update_detail": "Veuillez vérifier votre e-mail pour confirmer la nouvelle adresse e-mail.",
    "password_updated": "Mot de passe mis à jour",
    "password_update_detail": "Votre mot de passe a été mis à jour avec succès.",
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
