<template>
  <div class="card flex flex-col space-y-2">
    <template v-if="authMode === 'sign-up'">
      <div class="grid gap-1">
        <label class="text-left" for="email">Email</label>
        <InputText
          v-model="email"
          :invalid="
            isInvalidEmailSyntax(email) ||
            validateEmailRequired ||
            invalidEmail ||
            isEmailExist
          "
          type="email"
          required
          aria-describedby="email-help"
          @input="
            () => {
              invalidEmail = false;
              isEmailExist = false;
              validateEmailRequired = !email;
            }
          "
          @focusin="emailFocus = true"
          @focusout="emailFocus = false"
          @keypress.enter="signUp"
        />
        <template v-if="invalidEmail || isInvalidEmailSyntax(email)">
          <small id="email-help" class="text-red-400 text-left pl-4">
            {{ $t('auth.valid_email') }}
          </small>
        </template>
        <template v-else-if="validateEmailRequired">
          <small id="email-help" class="text-red-400 text-left pl-4">
            {{ $t('common.email_required') }}
          </small>
        </template>
        <template v-else-if="isEmailExist">
          <small id="email-help" class="text-red-400 text-left pl-4">
            {{ $t('auth.user_exist') }}
          </small>
        </template>
      </div>
      <div class="grid gap-1">
        <label class="text-left" for="password">{{
          $t('auth.password')
        }}</label>
        <Password
          v-model="password"
          :input-style="{ width: '100%' }"
          toggle-mask
          required
          :medium-regex="STRONG_PASSWORD_REGEX"
          :strong-regex="STRONG_PASSWORD_REGEX"
          :invalid="
            invalidPassword ||
            validatePasswordRequired ||
            (password.length > 0 && isInvalidPasswordSyntax(password))
          "
          aria-describedby="password-help"
          :weak-label="$t('auth.suggestion_weak_label')"
          :strong-label="$t('auth.suggestion_strong_label')"
          @input="
            () => {
              invalidPassword = false;
              validatePasswordRequired = !password;
            }
          "
          @focusin="passwordFocus = true"
          @focusout="passwordFocus = false"
          @keypress.enter="signUp"
        >
          <template #header>
            <h6>{{ $t('auth.pick_password') }}</h6>
          </template>
          <template #footer>
            <Divider />
            <p class="mt-2">{{ $t('auth.suggestions') }}</p>
            <ul class="pl-2 ml-2 mt-0" style="line-height: 1.5">
              <li>
                <i v-if="passwordHasLowerCase" class="pi pi-check-square" />
                <i v-else class="pi pi-stop" />
                {{ $t('auth.suggestion_lowercase') }}
              </li>
              <li>
                <i v-if="passwordHasUpperCase" class="pi pi-check-square" />
                <i v-else class="pi pi-stop" />
                {{ $t('auth.suggestion_uppercase') }}
              </li>
              <li>
                <i v-if="passwordHasNumber" class="pi pi-check-square" />
                <i v-else class="pi pi-stop" />
                {{ $t('auth.suggestion_numeric') }}
              </li>
              <li>
                <i
                  v-if="passwordHasSpecialCharacter"
                  class="pi pi-check-square"
                />
                <i v-else class="pi pi-stop" />
                {{
                  $t('auth.suggestion_special_character', {
                    characters: SPECIAL_CHARACTERS,
                  })
                }}
              </li>
              <li>
                <i v-if="passwordHasMinLength" class="pi pi-check-square" />
                <i v-else class="pi pi-stop" />
                {{ $t('auth.suggestion_min_chars', PASSWORD_MIN_LENGTH) }}
              </li>
            </ul>
          </template>
        </Password>
        <template
          v-if="
            invalidPassword ||
            (password.length && isInvalidPasswordSyntax(password))
          "
        >
          <small id="password-help" class="text-red-400 text-left pl-4">
            {{ $t('auth.valid_password') }}
          </small>
        </template>
        <template v-else-if="validatePasswordRequired">
          <small id="email-help" class="text-red-400 text-left pl-4">
            {{ $t('common.password_required') }}
          </small>
        </template>
      </div>
      <div class="pt-3">
        <Button
          v-if="authMode === 'sign-up'"
          :id="`${authMode}-button`"
          :loading="isLoading"
          :label="$t('auth.sign_up')"
          size="large"
          class="w-full"
          severity="contrast"
          @click="signUp"
        />
      </div>
    </template>
    <template v-else>
      <div class="grid gap-1">
        <div class="grid gap-2">
          <div class="grid gap-1">
            <label class="text-left" for="email">Email</label>
            <InputText
              v-model="email"
              :invalid="
                isInvalidEmailSyntax(email) ||
                validateEmailRequired ||
                invalidEmail
              "
              type="email"
              required
              @input="
                () => {
                  invalidEmail = false;
                  validateEmailRequired = !email;
                }
              "
              @focusin="emailFocus = true"
              @focusout="emailFocus = false"
              @keypress.enter="loginWithEmailAndPassword"
            />
            <template v-if="invalidEmail">
              <small id="password-help" class="text-red-400 text-left pl-4">
                {{ $t('auth.invalid_login') }}
              </small>
            </template>
            <template v-else-if="isInvalidEmailSyntax(email)">
              <small id="email-help" class="text-red-400 text-left pl-4">
                {{ $t('auth.valid_email') }}
              </small>
            </template>
            <template v-else-if="validateEmailRequired">
              <small id="email-help" class="text-red-400 text-left pl-4">
                {{ $t('common.email_required') }}
              </small>
            </template>
          </div>
          <div class="grid gap-1">
            <label class="text-left" for="password">{{
              $t('auth.password')
            }}</label>
            <Password
              v-model="password"
              :input-style="{ width: '100%' }"
              :invalid="invalidPassword || validatePasswordRequired"
              toggle-mask
              required
              :feedback="false"
              @input="
                () => {
                  invalidPassword = false;
                  validatePasswordRequired = !password;
                }
              "
              @focusin="passwordFocus = true"
              @focusout="passwordFocus = false"
              @keypress.enter="loginWithEmailAndPassword"
            />

            <template v-if="invalidPassword">
              <small id="password-help" class="text-red-400 text-left pl-4">
                {{ $t('auth.invalid_login') }}
              </small>
            </template>

            <template v-else-if="validatePasswordRequired">
              <small id="password-help" class="text-red-400 text-left pl-4">
                {{ $t('common.password_required') }}
              </small>
            </template>
          </div>
        </div>
        <NuxtLink class="text-right text-indigo-500" to="/auth/forgot-password">
          {{ $t('auth.forgot_password') }}
        </NuxtLink>
      </div>
      <div class="pt-1">
        <Button
          v-if="authMode === 'sign-in'"
          :id="`${authMode}-button`"
          :loading="isLoading"
          :label="$t('auth.sign_in')"
          class="w-full"
          size="large"
          @click="loginWithEmailAndPassword"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { authModes } from '@/types/auth';
import { isInvalidEmail as isInvalidEmailSyntax } from '@/utils/email';
import {
  hasLowerCase,
  hasNumber,
  hasUpperCase,
  isInvalidPassword as isInvalidPasswordSyntax,
} from '@/utils/password';
import { AuthApiError, AuthWeakPasswordError } from '@supabase/supabase-js';
import type { ToastMessageOptions } from 'primevue/toast';
import { useI18n } from 'vue-i18n';

const { getBrowserLocale } = useI18n({
  useScope: 'local',
});

const { t: $t } = useI18n({
  useScope: 'global',
});

const { authMode = 'sign-in' } = defineProps<{
  authMode: authModes;
}>();

const $toast = useToast();

const $supabase = useSupabaseClient();

const $router = useRouter();

const email = ref('');
const emailFocus = ref(false);

const password = ref('');
const passwordFocus = ref(false);

const validateEmailRequired = ref(false);
const validatePasswordRequired = ref(false);
const isEmailExist = ref(false);
const invalidEmail = ref(false);
const invalidPassword = ref(false);

const passwordHasNumber = computed(() => hasNumber(password.value));
const passwordHasLowerCase = computed(() => hasLowerCase(password.value));
const passwordHasUpperCase = computed(() => hasUpperCase(password.value));
const passwordHasSpecialCharacter = computed(() =>
  hasSpecialChar(password.value),
);
const passwordHasMinLength = computed(
  () => password.value.length >= PASSWORD_MIN_LENGTH,
);

const isLoading = ref(false);

function setInvalidInputs(invalid: boolean) {
  invalidEmail.value = invalid;
  invalidPassword.value = invalid;
}

function checkRequiredFields(): boolean {
  if (!email.value) {
    validateEmailRequired.value = false;
  }

  if (!password.value) {
    validatePasswordRequired.value = true;
  }

  if (!email.value || !password.value) {
    isLoading.value = false;
  }

  return !email.value || !password.value;
}

async function loginWithEmailAndPassword() {
  isLoading.value = true;

  setInvalidInputs(false);

  if (checkRequiredFields()) {
    return;
  }

  try {
    const { error } = await $supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    });
    if (error) {
      throw error;
    }
    await navigateTo({ path: '/mine' });
  } catch (error) {
    if (error instanceof Error) {
      setInvalidInputs(true);

      $toast.add({
        severity: 'error',
        summary: $t('auth.sign_in_failed'),
        detail: $t('auth.invalid_login'),
        life: 3000,
      });
    }
  } finally {
    isLoading.value = false;
  }
}

function showToast(
  severity: ToastMessageOptions['severity'],
  summary: string,
  detail: string,
) {
  $toast.add({
    severity,
    summary,
    detail,
    life: 3000,
  });
}

function handleSuccess() {
  showToast(
    'success',
    $t('auth.sign_up_success'),
    $t('auth.confirmation_email', { email: email.value }),
  );
  $router.push({
    path: '/auth/success',
    query: { email: email.value },
  });
}

function handleAuthError(error: unknown) {
  const errorMap: Record<string, () => void> = {
    weak_password: () => {
      invalidPassword.value = true;
      showToast('error', $t('auth.sign_up_failed'), $t('auth.weak_password'));
    },
    user_already_exists: () => {
      isEmailExist.value = true;
      showToast('error', $t('auth.sign_up_failed'), $t('auth.user_exist'));
    },
    validation_failed: () => {
      invalidEmail.value = true;
      showToast('error', $t('auth.sign_up_failed'), $t('auth.valid_email'));
    },
  };

  if (error instanceof AuthApiError || error instanceof AuthWeakPasswordError) {
    errorMap[error.code ?? '']?.();
  } else {
    throw error;
  }
}

async function signUp() {
  isLoading.value = true;
  isEmailExist.value = false;
  setInvalidInputs(false);

  if (checkRequiredFields()) return;

  try {
    const { error } = await $supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        emailRedirectTo: `${window.location.origin}/callback?navigate_to=/mine`,
        data: {
          EmailTemplate: await getEmailTemplate(getBrowserLocale() || 'en'),
        },
      },
    });

    if (error) throw error;

    handleSuccess();
  } catch (error) {
    handleAuthError(error);
  } finally {
    isLoading.value = false;
  }
}
</script>

<i18n lang="json">
{
  "en": {
    "prehead": "Confirm your signup to leadminer",
    "title": "Confirm Your Email Address",
    "body": {
      "p1": "Welcome to ",
      "p2": "! We're happy that you've selected us to help you generate clean and enriched contacts from your mailbox. Click the button below to confirm your email address and activate your account.",
      "p3": "If you didn't sign up with ",
      "p4": ", you can safely disregard this email."
    },
    "button": "Confirm your email"
  },
  "fr": {
    "prehead": "Confirmez votre inscription à leadminer",
    "title": "Confirmez votre adresse e-mail",
    "body": {
      "p1": "Bienvenue à ",
      "p2": "! Nous sommes heureux que vous nous ayez choisis pour vous aider à générer des contacts propres et enrichis à partir de votre boîte aux lettres. Cliquez sur le bouton ci-dessous pour confirmer votre adresse e-mail et activer votre compte.",
      "p3": "Si vous ne vous êtes pas inscrit auprès de ",
      "p4": ", vous pouvez ignorer cet e-mail en toute sécurité."
    },
    "button": "Confirmez votre e-mail"
  }
}
</i18n>
