<template>
  <div class="card flex flex-col space-y-2">
    <template v-if="state === 'signup'">
      <div class="grid gap-1">
        <label class="text-left" for="email">Email</label>
        <InputText
          v-model="email"
          :invalid="isInvalidEmail(email) || !validateEmailRequired"
          type="email"
          required
          aria-describedby="email-help"
          @focusin="
            emailFocus = true;
            validateEmailRequired = true;
          "
          @focusout="emailFocus = false"
          @keypress.enter="signUp"
        />
        <small
          v-if="isInvalidEmail(email)"
          id="email-help"
          class="text-red-400 text-left pl-4"
        >
          {{ $t('auth.valid_email') }}
        </small>
        <small
          v-if="!validateEmailRequired"
          id="email-help"
          class="text-red-400 text-left pl-4"
        >
          {{ $t('common.email_required') }}
        </small>
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
          :invalid="isInvalidPassword(password) || !validatePasswordRequired"
          aria-describedby="password-help"
          @focusin="
            passwordFocus = true;
            validatePasswordRequired = true;
          "
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
                <i v-if="hasLowerCase" class="pi pi-check-square"></i>
                <i v-else class="pi pi-stop"></i>
                {{ $t('auth.suggestion_lowercase') }}
              </li>
              <li>
                <i v-if="hasUpperCase" class="pi pi-check-square"></i>
                <i v-else class="pi pi-stop"></i>
                {{ $t('auth.suggestion_uppercase') }}
              </li>
              <li>
                <i v-if="hasNumber" class="pi pi-check-square"></i>
                <i v-else class="pi pi-stop"></i>
                {{ $t('auth.suggestion_numeric') }}
              </li>
              <li>
                <i v-if="password.length >= 8" class="pi pi-check-square"></i>
                <i v-else class="pi pi-stop"></i>
                {{ $t('auth.suggestion_min_chars') }}
              </li>
            </ul>
          </template>
        </Password>
        <small
          v-if="isInvalidPassword(password)"
          id="password-help"
          class="text-red-400 text-left pl-4"
        >
          {{ $t('auth.valid_password') }}
        </small>
        <small
          v-if="!validatePasswordRequired"
          id="email-help"
          class="text-red-400 text-left pl-4"
        >
          {{ $t('common.password_required') }}
        </small>
      </div>
      <div class="pt-3">
        <Button
          v-if="state === 'signup'"
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
              :invalid="isInvalidEmail(email) || !validateEmailRequired"
              type="email"
              required
              @focusin="
                emailFocus = true;
                validateEmailRequired = true;
              "
              @focusout="emailFocus = false"
              @keypress.enter="loginWithEmailAndPassword"
            />
            <small
              v-if="isInvalidEmail(email)"
              id="email-help"
              class="text-red-400 text-left pl-4"
            >
              {{ $t('auth.valid_email') }}
            </small>
            <small
              v-if="!validateEmailRequired"
              id="email-help"
              class="text-red-400 text-left pl-4"
            >
              {{ $t('common.email_required') }}
            </small>
          </div>
          <div class="grid gap-1">
            <label class="text-left" for="password">{{
              $t('auth.password')
            }}</label>
            <Password
              v-model="password"
              :input-style="{ width: '100%' }"
              :invalid="
                isInvalidPassword(password) || !validatePasswordRequired
              "
              toggle-mask
              required
              :feedback="false"
              @focusin="
                passwordFocus = true;
                validatePasswordRequired = true;
              "
              @focusout="passwordFocus = false"
              @keypress.enter="loginWithEmailAndPassword"
            />
            <small
              v-if="isInvalidPassword(password)"
              id="password-help"
              class="text-red-400 text-left pl-4"
            >
              {{ $t('auth.valid_password') }}
            </small>
            <small
              v-if="!validatePasswordRequired"
              id="email-help"
              class="text-red-400 text-left pl-4"
            >
              {{ $t('common.password_required') }}
            </small>
          </div>
        </div>
        <NuxtLink class="text-right text-indigo-500" to="/auth/forgot-password">
          {{ $t('auth.forgot_password') }}
        </NuxtLink>
      </div>
      <div class="pt-1">
        <Button
          v-if="state === 'login'"
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
import { useI18n } from 'vue-i18n';
import { isInvalidEmail } from '@/utils/email';
import { isInvalidPassword } from '@/utils/password';

const { t } = useI18n({
  useScope: 'local',
});

const { t: $t } = useI18n({
  useScope: 'global',
});

const { state } = withDefaults(
  defineProps<{
    state: 'login' | 'signup';
  }>(),
  {
    state: 'login',
  },
);

const $toast = useToast();

const $supabase = useSupabaseClient();

const $router = useRouter();

const email = ref('');
const emailFocus = ref(false);

const password = ref('');
const passwordFocus = ref(false);

const validateEmailRequired = ref(true);
const validatePasswordRequired = ref(true);

const hasLowerCase = computed(
  () => Boolean(password.value) && /.*[a-z]+.*/g.test(password.value),
);

const hasUpperCase = computed(
  () => Boolean(password.value) && /.*[A-Z]+.*/g.test(password.value),
);

const hasNumber = computed(
  () => Boolean(password.value) && /.*[0-9]+.*/g.test(password.value),
);

const isLoading = ref(false);

function checkRequiredFields(): boolean {
  if (!email.value) {
    validateEmailRequired.value = false;
  }

  if (!password.value) {
    validatePasswordRequired.value = false;
  }

  if (!email.value || !password.value) {
    isLoading.value = false;
  }

  return !email.value || !password.value;
}

async function loginWithEmailAndPassword() {
  isLoading.value = true;

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
    await navigateTo({ path: '/dashboard' });
  } catch (error) {
    if (error instanceof Error) {
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

async function signUp() {
  isLoading.value = true;

  if (checkRequiredFields()) {
    return;
  }

  try {
    if (isInvalidEmail(email.value) || isInvalidPassword(password.value)) {
      throw Error($t('auth.invalid_login'));
    }

    const { error } = await $supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          Prehead: t('prehead'),
          Title: t('title'),
          Body1: t('body.p1'),
          Body2: t('body.p2'),
          Body3: t('body.p3'),
          Body4: t('body.p4'),
          Button: t('button'),
          Regards: $t('email_template.regards'),
          Footer: $t('email_template.footer'),
        },
      },
    });
    if (error) {
      throw error;
    }

    $toast.add({
      severity: 'success',
      summary: $t('auth.sign_up_success'),
      detail: $t('auth.confirmation_email', { email: email.value }),
      life: 3000,
    });
    await $router.push({
      path: '/auth/success',
      query: { email: email.value },
    });
  } catch (error) {
    if (error instanceof Error) {
      $toast.add({
        severity: 'error',
        summary: $t('auth.sign_up_failed'),
        detail: `${error.message}`,
        life: 3000,
      });
    }
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
