<template>
  <Dialog
    v-model:visible="isVisible"
    modal
    :header="t('send_contacts_by_emails')"
    :style="{ width: '52rem', maxWidth: '95vw' }"
  >
    <div class="flex flex-col gap-4">
      <div class="text-sm text-surface-600">
        {{ t('campaign_limit_note') }}
        <a
          class="underline"
          href="https://support.google.com/a/answer/166852?sjid=17095599014221307477-EU"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ t('more_info') }}
        </a>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t('sender_name') }}</label>
          <InputText v-model="form.senderName" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium">{{ t('sender_email') }}</label>
          <Select
            v-model="form.senderEmail"
            :options="availableSenderEmails"
            :loading="isLoadingSenderOptions"
          />
        </div>

        <div class="flex flex-col gap-1 md:col-span-2">
          <label class="text-sm font-medium">{{ t('reply_to') }}</label>
          <InputText :model-value="replyTo" disabled />
        </div>

        <div class="flex flex-col gap-1 md:col-span-2">
          <label class="text-sm font-medium">{{ t('subject') }}</label>
          <InputText v-model="form.subject" />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button
          size="small"
          outlined
          :label="t('insert_person_attribute')"
          icon="pi pi-tag"
          @click="toggleAttributeMenu"
        />
        <Menu ref="attributesMenu" popup :model="attributeMenuItems" />

        <Button
          v-if="!form.plainTextOnly"
          size="small"
          text
          icon="pi pi-bold"
          @click="execEditorCommand('bold')"
        />
        <Button
          v-if="!form.plainTextOnly"
          size="small"
          text
          icon="pi pi-italic"
          @click="execEditorCommand('italic')"
        />
        <Button
          v-if="!form.plainTextOnly"
          size="small"
          text
          icon="pi pi-underline"
          @click="execEditorCommand('underline')"
        />
        <Button
          v-if="!form.plainTextOnly"
          size="small"
          text
          icon="pi pi-list"
          @click="execEditorCommand('insertUnorderedList')"
        />
        <Button
          v-if="!form.plainTextOnly"
          size="small"
          text
          icon="pi pi-link"
          @click="insertLink"
        />
        <Button
          v-if="!form.plainTextOnly"
          size="small"
          text
          icon="pi pi-image"
          @click="insertImage"
        />
      </div>

      <div v-if="!form.plainTextOnly" ref="editorRef" class="campaign-editor" contenteditable @input="syncEditorHtml"></div>

      <Textarea
        v-else
        v-model="form.bodyTextTemplate"
        rows="9"
        class="w-full"
      />

      <div class="border border-surface-200 rounded-md p-3">
        <Button
          text
          size="small"
          :label="showAdvanced ? t('hide_advanced') : t('show_advanced')"
          @click="showAdvanced = !showAdvanced"
        />

        <div v-if="showAdvanced" class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">{{ t('sender_daily_limit') }}</label>
            <InputNumber v-model="form.senderDailyLimit" :min="1" :max="2000" />
          </div>

          <div class="flex items-center gap-2 mt-6">
            <Checkbox v-model="form.onlyValidContacts" binary input-id="valid-only" />
            <label for="valid-only">{{ t('only_valid_contacts') }}</label>
          </div>

          <div class="flex items-center gap-2">
            <Checkbox v-model="form.trackOpen" binary input-id="track-open" />
            <label for="track-open">{{ t('track_open') }}</label>
          </div>

          <div class="flex items-center gap-2">
            <Checkbox v-model="form.trackClick" binary input-id="track-click" />
            <label for="track-click">{{ t('track_click') }}</label>
          </div>

          <div class="flex items-center gap-2 md:col-span-2">
            <Checkbox v-model="form.plainTextOnly" binary input-id="plain-text" />
            <label for="plain-text">{{ t('plain_text_only') }}</label>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex gap-2 justify-between w-full">
        <Button
          outlined
          :label="t('send_preview')"
          :loading="isSendingPreview"
          @click="sendPreview"
        />
        <div class="flex gap-2">
          <Button outlined :label="$t('common.cancel')" @click="isVisible = false" />
          <Button :label="t('send_campaign')" :loading="isSubmitting" @click="submit" />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import type { Contact } from '@/types/contact';

const isVisible = defineModel<boolean>('visible', { required: true });

const props = defineProps<{
  selectedContacts: Contact[];
}>();

const { t } = useI18n({ useScope: 'local' });
const { $t } = useI18n({ useScope: 'global' });
const { $saasEdgeFunctions } = useNuxtApp();
const $toast = useToast();
const $user = useSupabaseUser();

const editorRef = ref<HTMLElement>();
const attributesMenu = ref();

const showAdvanced = ref(false);
const isSubmitting = ref(false);
const isSendingPreview = ref(false);
const isLoadingSenderOptions = ref(false);

const replyTo = computed(() => $user.value?.email ?? '');
const selectedEmails = computed(() => props.selectedContacts.map((item) => item.email));

const availableSenderEmails = ref<string[]>([]);
const fallbackSenderEmail = ref('try@leadminer.io');

const form = reactive({
  senderName: '',
  senderEmail: '',
  subject: '',
  bodyHtmlTemplate: '<p></p>',
  bodyTextTemplate: '',
  senderDailyLimit: 1000,
  trackOpen: true,
  trackClick: true,
  plainTextOnly: false,
  onlyValidContacts: false,
});

const attributeOptions = [
  'name',
  'given_name',
  'family_name',
  'email',
  'location',
  'works_for',
  'job_title',
];

type EdgeResponseError = {
  data?: {
    code?: string;
    error?: string;
  };
};

const attributeMenuItems = computed(() =>
  attributeOptions.map((key) => ({
    label: `{{${key}}}`,
    command: () => insertVariable(key),
  })),
);

function toggleAttributeMenu(event: Event) {
  attributesMenu.value.toggle(event);
}

function syncEditorHtml() {
  form.bodyHtmlTemplate = editorRef.value?.innerHTML || '';
}

function execEditorCommand(command: string, value?: string) {
  editorRef.value?.focus();
  document.execCommand(command, false, value);
  syncEditorHtml();
}

function insertVariable(attribute: string) {
  if (form.plainTextOnly) {
    form.bodyTextTemplate += ` {{${attribute}}}`;
    return;
  }
  execEditorCommand('insertText', `{{${attribute}}}`);
}

function insertLink() {
  const url = window.prompt('URL');
  if (!url) return;
  execEditorCommand('createLink', url);
}

function insertImage() {
  const url = window.prompt('Image URL');
  if (!url) return;
  execEditorCommand('insertImage', url);
}

function startCampaignCompletionWatcher(campaignId: string) {
  const timer = setInterval(async () => {
    try {
      const data = await $saasEdgeFunctions(`mail/campaigns/${campaignId}/status`, {
        method: 'GET',
      });
      if (data?.status !== 'completed') return;

      clearInterval(timer);
      $toast.add({
        group: 'has-links',
        severity: 'success',
        summary: t('campaign_sent'),
        detail: {
          message: t('campaign_sent_detail'),
          button: {
            text: t('see_results'),
            action: () => navigateTo('/campaigns'),
          },
        },
        life: 12000,
      });
    } catch {
      clearInterval(timer);
    }
  }, 60000);
}

function normalizeBodyText() {
  if (form.plainTextOnly) {
    return form.bodyTextTemplate;
  }
  return form.bodyTextTemplate || form.bodyHtmlTemplate.replace(/<[^>]*>/g, ' ');
}

async function loadSenderOptions() {
  isLoadingSenderOptions.value = true;
  try {
    const data = await $saasEdgeFunctions('mail/campaigns/sender-options', {
      method: 'POST',
    });

    fallbackSenderEmail.value = data.fallbackSenderEmail;
    form.senderDailyLimit = Number(data.defaultDailyLimit || 1000);
    availableSenderEmails.value = (data.options || [])
      .filter((option: { available: boolean }) => option.available)
      .map((option: { email: string }) => option.email);

    if (!availableSenderEmails.value.length) {
      availableSenderEmails.value = [fallbackSenderEmail.value];
    }

    if (!availableSenderEmails.value.includes(form.senderEmail)) {
      form.senderEmail = availableSenderEmails.value[0];
    }
  } finally {
    isLoadingSenderOptions.value = false;
  }
}

async function sendPreview() {
  if (!selectedEmails.value.length) {
    return;
  }

  isSendingPreview.value = true;
  try {
    await $saasEdgeFunctions('mail/campaigns/preview', {
      method: 'POST',
      body: {
        selectedEmails: selectedEmails.value,
        senderName: form.senderName,
        senderEmail: form.senderEmail,
        replyTo: replyTo.value,
        subject: form.subject,
        bodyHtmlTemplate: form.bodyHtmlTemplate,
        bodyTextTemplate: normalizeBodyText(),
        plainTextOnly: form.plainTextOnly,
        onlyValidContacts: form.onlyValidContacts,
      },
    });

    $toast.add({
      severity: 'success',
      summary: t('preview_sent'),
      detail: t('preview_sent_detail'),
      life: 3500,
    });
  } catch (error: unknown) {
    const parsedError = error as EdgeResponseError;
    const code = parsedError?.data?.code;
    if (code === 'SENDER_SMTP_FAILED') {
      form.senderEmail = fallbackSenderEmail.value;
    }

    $toast.add({
      severity: 'error',
      summary: t('preview_failed'),
      detail: parsedError?.data?.error || t('request_failed'),
      life: 4500,
    });
  } finally {
    isSendingPreview.value = false;
  }
}

async function submit() {
  if (!selectedEmails.value.length) {
    return;
  }

  isSubmitting.value = true;
  try {
    const data = await $saasEdgeFunctions('mail/campaigns/create', {
      method: 'POST',
      body: {
        selectedEmails: selectedEmails.value,
        senderName: form.senderName,
        senderEmail: form.senderEmail,
        replyTo: replyTo.value,
        subject: form.subject,
        bodyHtmlTemplate: form.bodyHtmlTemplate,
        bodyTextTemplate: normalizeBodyText(),
        senderDailyLimit: form.senderDailyLimit,
        trackOpen: form.trackOpen,
        trackClick: form.trackClick,
        plainTextOnly: form.plainTextOnly,
        onlyValidContacts: form.onlyValidContacts,
      },
    });

    $toast.add({
      severity: 'success',
      summary: t('campaign_started'),
      detail: t('campaign_started_detail'),
      life: 4000,
    });

    if (data?.campaignId) {
      startCampaignCompletionWatcher(data.campaignId);
    }

    isVisible.value = false;
  } catch (error: unknown) {
    const parsedError = error as EdgeResponseError;
    const code = parsedError?.data?.code;
    if (code === 'SENDER_SMTP_FAILED') {
      form.senderEmail = fallbackSenderEmail.value;
    }

    $toast.add({
      severity: 'error',
      summary: t('campaign_start_failed'),
      detail: parsedError?.data?.error || t('request_failed'),
      life: 5000,
    });
  } finally {
    isSubmitting.value = false;
  }
}

watch(
  isVisible,
  async (visible) => {
    if (!visible) return;
    if (!form.senderName) {
      form.senderName = ($user.value?.email || '').split('@')[0] || 'Leadminer user';
    }

    if (editorRef.value && !form.plainTextOnly) {
      editorRef.value.innerHTML = form.bodyHtmlTemplate;
    }

    await loadSenderOptions();
  },
  { immediate: true },
);

watch(
  () => form.plainTextOnly,
  () => {
    if (!form.plainTextOnly && editorRef.value) {
      editorRef.value.innerHTML = form.bodyHtmlTemplate;
    }
  },
);
</script>

<style scoped>
.campaign-editor {
  min-height: 220px;
  border: 1px solid var(--p-surface-300);
  border-radius: 8px;
  padding: 12px;
  overflow: auto;
}
</style>

<i18n lang="json">
{
  "en": {
    "send_contacts_by_emails": "Send contacts by emails",
    "campaign_limit_note": "Default sender limit is 1000 emails/day. In advanced options, you can set up to 2000/day per sender.",
    "more_info": "More information",
    "sender_name": "Sender name",
    "sender_email": "Sender email",
    "reply_to": "Reply-to",
    "subject": "Subject",
    "insert_person_attribute": "Insert Person Attribute",
    "show_advanced": "Show advanced options",
    "hide_advanced": "Hide advanced options",
    "sender_daily_limit": "Sender daily limit",
    "only_valid_contacts": "Only send to Valid contacts",
    "track_open": "Track opening",
    "track_click": "Track clicking",
    "plain_text_only": "Send pure text (no HTML)",
    "send_preview": "Send me a preview message",
    "send_campaign": "Send campaign",
    "preview_sent": "Preview sent",
    "preview_sent_detail": "A preview was sent to your email.",
    "preview_failed": "Preview failed",
    "request_failed": "Request failed",
    "campaign_started": "Campaign sending started successfully",
    "campaign_started_detail": "Campaign was queued and will be processed in batches.",
    "campaign_start_failed": "Campaign failed to start",
    "campaign_sent": "Campaign sent",
    "campaign_sent_detail": "Your campaign has been fully sent.",
    "see_results": "See results"
  },
  "fr": {
    "send_contacts_by_emails": "Envoyer les contacts par email",
    "campaign_limit_note": "La limite par defaut est de 1000 emails/jour. Dans les options avancees, vous pouvez monter jusqu'a 2000/jour par expediteur.",
    "more_info": "Plus d'informations",
    "sender_name": "Nom expediteur",
    "sender_email": "Email expediteur",
    "reply_to": "Repondre a",
    "subject": "Sujet",
    "insert_person_attribute": "Inserer un attribut contact",
    "show_advanced": "Afficher les options avancees",
    "hide_advanced": "Masquer les options avancees",
    "sender_daily_limit": "Limite quotidienne expediteur",
    "only_valid_contacts": "Envoyer uniquement aux contacts valides",
    "track_open": "Suivre les ouvertures",
    "track_click": "Suivre les clics",
    "plain_text_only": "Envoyer en texte brut (sans HTML)",
    "send_preview": "M'envoyer un apercu",
    "send_campaign": "Envoyer la campagne",
    "preview_sent": "Apercu envoye",
    "preview_sent_detail": "Un apercu a ete envoye a votre email.",
    "preview_failed": "Echec de l'apercu",
    "request_failed": "Echec de la requete",
    "campaign_started": "Envoi de campagne demarre avec succes",
    "campaign_started_detail": "La campagne est en file et sera traitee par lots.",
    "campaign_start_failed": "La campagne n'a pas pu demarrer",
    "campaign_sent": "Campagne envoyee",
    "campaign_sent_detail": "Votre campagne a ete entierement envoyee.",
    "see_results": "Voir les resultats"
  }
}
</i18n>
