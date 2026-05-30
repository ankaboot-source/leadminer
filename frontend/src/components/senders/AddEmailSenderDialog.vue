<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'primevue/usetoast';
import { useSmtpSendersStore } from '~/stores/smtp-senders';
import type { SmtpEncryption } from '@/types/smtp-senders';

const props = defineProps<{
  editingSender?: {
    id: string;
    name: string;
    email: string;
    smtp_host: string;
    smtp_port: number;
    smtp_encryption: SmtpEncryption;
    smtp_user: string;
  } | null;
}>();

const emit = defineEmits<{
  senderSaved: [];
}>();

const visible = defineModel<boolean>('visible', { default: false });

const { t } = useI18n({ useScope: 'local' });
const { t: globalT } = useI18n({ useScope: 'global' });
const $toast = useToast();
const $store = useSmtpSendersStore();

const senderName = ref('');
const senderEmail = ref('');
const senderPassword = ref('');
const smtpHost = ref('');
const smtpPort = ref(587);
const smtpEncryption = ref<SmtpEncryption>('starttls');
const smtpUser = ref('');
const showAdvanced = ref(false);
const isConnecting = ref(false);

const isEditing = computed(() => !!props.editingSender);

const isFormValid = computed(() => {
  if (isEditing.value) {
    return senderName.value.trim().length > 0;
  }
  return (
    senderName.value.trim().length > 0 &&
    senderEmail.value.trim().length > 0 &&
    senderPassword.value.length > 0 &&
    smtpHost.value.trim().length > 0 &&
    smtpPort.value > 0
  );
});

const encryptionOptions = [
  { label: 'STARTTLS', value: 'starttls' as SmtpEncryption },
  { label: 'SSL/TLS', value: 'ssl' as SmtpEncryption },
  { label: 'None', value: 'none' as SmtpEncryption },
];

function resetForm() {
  senderName.value = '';
  senderEmail.value = '';
  senderPassword.value = '';
  smtpHost.value = '';
  smtpPort.value = 587;
  smtpEncryption.value = 'starttls';
  smtpUser.value = '';
  showAdvanced.value = false;
  isConnecting.value = false;
}

watch(
  () => props.editingSender,
  (sender) => {
    if (sender) {
      senderName.value = sender.name;
      senderEmail.value = sender.email;
      smtpHost.value = sender.smtp_host;
      smtpPort.value = sender.smtp_port;
      smtpEncryption.value = sender.smtp_encryption;
      smtpUser.value = sender.smtp_user;
      senderPassword.value = '';
      showAdvanced.value = false;
    }
  },
  { immediate: true },
);

async function handleConnect() {
  if (isEditing.value) {
    await handleSave();
    return;
  }

  if (showAdvanced.value) {
    await handleSave();
    return;
  }

  isConnecting.value = true;
  try {
    const result = await $store.autodetect(senderEmail.value);

    if (result) {
      if (result.authType === 'oauth') {
        $toast.add({
          severity: 'warn',
          summary: t('oauth_not_supported'),
          life: 5000,
        });
        showAdvanced.value = true;
        return;
      }

      smtpHost.value = result.smtpHost;
      smtpPort.value = result.smtpPort;
      smtpEncryption.value = result.smtpEncryption;
      smtpUser.value = senderEmail.value;
    } else {
      $toast.add({
        severity: 'warn',
        summary: t('autodetect_failed'),
        life: 3000,
      });
      showAdvanced.value = true;
      return;
    }

    await handleSave();
  } catch (err) {
    $toast.add({
      severity: 'error',
      summary: t('connection_failed'),
      detail: err instanceof Error ? err.message : '',
      life: 5000,
    });
    showAdvanced.value = true;
  } finally {
    isConnecting.value = false;
  }
}

async function handleSave() {
  let success = false;

  if (isEditing.value && props.editingSender) {
    const updates: Record<string, unknown> = {
      name: senderName.value,
    };
    if (smtpHost.value) updates.smtp_host = smtpHost.value;
    if (smtpPort.value) updates.smtp_port = smtpPort.value;
    if (smtpEncryption.value) updates.smtp_encryption = smtpEncryption.value;
    if (smtpUser.value) updates.smtp_user = smtpUser.value;
    if (senderPassword.value) updates.smtp_password = senderPassword.value;

    success = await $store.updateSender(props.editingSender.id, updates as any);
    if (success) {
      $toast.add({
        severity: 'success',
        summary: t('sender_updated'),
        life: 3000,
      });
    }
  } else {
    const result = await $store.createSender({
      name: senderName.value,
      email: senderEmail.value,
      smtp_host: smtpHost.value,
      smtp_port: smtpPort.value,
      smtp_encryption: smtpEncryption.value,
      smtp_user: smtpUser.value || senderEmail.value,
      smtp_password: senderPassword.value,
    });
    success = !!result;
    if (success) {
      $toast.add({
        severity: 'success',
        summary: t('sender_created'),
        life: 3000,
      });
    }
  }

  if (success) {
    visible.value = false;
    emit('senderSaved');
    resetForm();
  } else {
    $toast.add({
      severity: 'error',
      summary: t('save_failed'),
      detail: $store.error || '',
      life: 5000,
    });
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="isEditing ? t('edit_sender') : t('add_email_sender')"
    :style="{ width: '32rem', maxWidth: '95vw' }"
    @hide="resetForm"
  >
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium">{{ t('sender_name') }}</label>
        <InputText
          v-model="senderName"
          :placeholder="t('sender_name_placeholder')"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium">{{ t('email') }}</label>
        <InputText
          v-model="senderEmail"
          type="email"
          :placeholder="t('email_placeholder')"
          :disabled="isEditing"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-sm font-medium">{{ t('password') }}</label>
        <InputText
          v-model="senderPassword"
          type="password"
          :placeholder="
            isEditing
              ? t('password_placeholder_edit')
              : t('password_placeholder')
          "
        />
      </div>

      <div
        v-if="showAdvanced"
        class="flex flex-col gap-4 border-t border-surface-200 pt-4"
      >
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t('smtp_host') }}</label>
          <InputText v-model="smtpHost" placeholder="smtp.example.com" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t('smtp_port') }}</label>
            <InputNumber
              v-model="smtpPort"
              :min="1"
              :max="65535"
              show-buttons
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t('encryption') }}</label>
            <Dropdown
              v-model="smtpEncryption"
              :options="encryptionOptions"
              option-label="label"
              option-value="value"
            />
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t('smtp_user') }}</label>
          <InputText
            v-model="smtpUser"
            :placeholder="t('smtp_user_placeholder')"
          />
        </div>
      </div>

      <button
        type="button"
        class="text-sm text-primary underline self-start"
        @click="showAdvanced = !showAdvanced"
      >
        {{
          showAdvanced ? t('configure_automatically') : t('configure_manually')
        }}
      </button>
    </div>

    <template #footer>
      <Button
        outlined
        :label="globalT('common.cancel')"
        @click="visible = false"
      />
      <Button
        :label="isEditing ? t('save_changes') : t('connect')"
        :loading="isConnecting || $store.isLoading"
        :disabled="!isFormValid"
        @click="handleConnect"
      />
    </template>
  </Dialog>
</template>

<i18n lang="json">
{
  "en": {
    "add_email_sender": "Add Email Sender",
    "edit_sender": "Edit Email Sender",
    "sender_name": "Sender Name",
    "sender_name_placeholder": "e.g., Work Email",
    "email": "Email",
    "email_placeholder": "you@example.com",
    "password": "Password",
    "password_placeholder": "Your email password or app password",
    "password_placeholder_edit": "Leave blank to keep current",
    "smtp_host": "SMTP Host",
    "smtp_port": "SMTP Port",
    "encryption": "Encryption",
    "smtp_user": "SMTP Username",
    "smtp_user_placeholder": "Usually your email",
    "configure_manually": "Configure manually",
    "configure_automatically": "Configure automatically",
    "connect": "Connect",
    "save_changes": "Save Changes",
    "sender_created": "Email sender added",
    "sender_updated": "Email sender updated",
    "save_failed": "Failed to save sender",
    "autodetect_failed": "Could not detect SMTP settings. Please enter them manually.",
    "oauth_not_supported": "OAuth senders are not yet supported. Please use password authentication.",
    "connection_failed": "Connection failed"
  },
  "fr": {
    "add_email_sender": "Ajouter un expéditeur email",
    "edit_sender": "Modifier l'expéditeur email",
    "sender_name": "Nom de l'expéditeur",
    "sender_name_placeholder": "ex: Email professionnel",
    "email": "Email",
    "email_placeholder": "vous@exemple.com",
    "password": "Mot de passe",
    "password_placeholder": "Votre mot de passe email ou mot de passe d'application",
    "password_placeholder_edit": "Laisser vide pour conserver l'actuel",
    "smtp_host": "Hôte SMTP",
    "smtp_port": "Port SMTP",
    "encryption": "Chiffrement",
    "smtp_user": "Nom d'utilisateur SMTP",
    "smtp_user_placeholder": "Généralement votre email",
    "configure_manually": "Configurer manuellement",
    "configure_automatically": "Configurer automatiquement",
    "connect": "Connecter",
    "save_changes": "Enregistrer les modifications",
    "sender_created": "Expéditeur email ajouté",
    "sender_updated": "Expéditeur email mis à jour",
    "save_failed": "Échec de l'enregistrement",
    "autodetect_failed": "Impossible de détecter les paramètres SMTP. Veuillez les saisir manuellement.",
    "oauth_not_supported": "Les expéditeurs OAuth ne sont pas encore supportés. Veuillez utiliser l'authentification par mot de passe.",
    "connection_failed": "Échec de la connexion"
  }
}
</i18n>
