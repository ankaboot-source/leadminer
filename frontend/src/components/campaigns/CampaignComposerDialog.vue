<template>
  <Dialog
    v-model:visible="isVisible"
    modal
    :header="dialogHeader"
    :maximizable="$screenStore?.size?.md"
    :pt:root:class="{ 'p-dialog-maximized': !$screenStore?.size?.md }"
    :style="{ width: '52rem', maxWidth: '95vw' }"
    @show="onDialogShow"
    @hide="onDialogHide"
  >
    <div class="flex flex-col gap-4">
      <Message
        severity="info"
        :closable="false"
        size="small"
        class="border border-blue-200 border-t border-t-blue-200 bg-blue-50"
      >
        <div class="flex items-center gap-3">
          <img
            src="/icons/gdpr.png"
            alt="GDPR"
            class="w-8 h-8 sm:w-10 sm:h-10 shrink-0"
          />
          <span>{{ t('gdpr_notice') }}</span>
        </div>
      </Message>

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
          <label class="text-sm font-medium flex items-center gap-1">
            <span>{{ t('sender_name') }} *</span>
            <i
              v-tooltip.top="t('sender_name_help')"
              class="pi pi-info-circle text-xs text-surface-500"
            />
          </label>
          <InputText
            v-model="form.senderName"
            @blur="markTouched('senderName')"
          />
          <small v-if="showFieldError('senderName')" class="text-red-500">
            {{ validationErrors.senderName }}
          </small>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium flex items-center gap-1">
            <span>{{ t('sender_email') }} *</span>
            <i
              v-tooltip.top="t('sender_email_help')"
              class="pi pi-info-circle text-xs text-surface-500"
            />
          </label>
          <Select
            v-model="form.senderEmail"
            :options="senderOptions"
            option-label="label"
            option-value="email"
            :loading="isLoadingSenderOptions"
            @update:model-value="markTouched('senderEmail')"
          />
          <small v-if="showFieldError('senderEmail')" class="text-red-500">
            {{ validationErrors.senderEmail }}
          </small>
        </div>

        <div class="flex flex-col gap-1 md:col-span-2">
          <label class="text-sm font-medium flex items-center gap-1">
            <span>{{ t('reply_to') }} *</span>
            <i
              v-tooltip.top="t('reply_to_help')"
              class="pi pi-info-circle text-xs text-surface-500"
            />
          </label>
          <InputText :model-value="replyTo" disabled />
          <small v-if="showFieldError('replyTo')" class="text-red-500">
            {{ validationErrors.replyTo }}
          </small>
        </div>

        <div class="flex flex-col gap-1 md:col-span-2">
          <label class="text-sm font-medium flex items-center gap-1">
            <span>{{ t('subject') }} *</span>
            <i
              v-tooltip.top="t('subject_help')"
              class="pi pi-info-circle text-xs text-surface-500"
            />
          </label>
          <div class="relative">
            <InputText
              ref="subjectInputRef"
              v-model="form.subject"
              class="w-full pr-10"
              :placeholder="t('subject_placeholder')"
              @click="updateSubjectSelection"
              @keyup="updateSubjectSelection"
              @select="updateSubjectSelection"
              @blur="markTouched('subject')"
            />
            <Button
              v-tooltip.top="t('insert_person_attribute_subject')"
              text
              rounded
              size="small"
              icon="pi pi-tag"
              class="!absolute right-1 top-1/2 -translate-y-1/2"
              :aria-label="t('insert_person_attribute_subject')"
              @click="toggleAttributeMenu($event, 'subject')"
            />
          </div>
          <small v-if="showFieldError('subject')" class="text-red-500">
            {{ validationErrors.subject }}
          </small>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button
          size="small"
          outlined
          :label="t('insert_person_attribute_body')"
          icon="pi pi-tag"
          @click="toggleAttributeMenu($event, 'body')"
        />
        <Menu ref="attributesMenu" popup :model="attributeMenuItems" />
      </div>

      <ClientOnly v-if="editorReady && !form.plainTextOnly">
        <Editor
          ref="editorRef"
          v-model="form.bodyHtmlTemplate"
          :modules="editorModules"
          editor-style="min-height: 220px"
          :placeholder="t('editor_placeholder')"
          @text-change="onEditorInput"
        >
          <template #toolbar>
            <div class="campaign-editor-toolbar">
              <span class="ql-formats">
                <select class="ql-font"></select>
                <select class="ql-size"></select>
              </span>
              <span class="ql-formats">
                <button class="ql-bold" :aria-label="t('bold')"></button>
                <button class="ql-italic" :aria-label="t('italic')"></button>
                <button
                  class="ql-underline"
                  :aria-label="t('underline')"
                ></button>
              </span>
              <span class="ql-formats">
                <select class="ql-color"></select>
                <select class="ql-background"></select>
              </span>
              <span class="ql-formats">
                <button class="ql-list" value="ordered"></button>
                <button class="ql-list" value="bullet"></button>
              </span>
              <span class="ql-formats">
                <button class="ql-link" :aria-label="t('insert_link')"></button>
                <button
                  class="ql-image"
                  :aria-label="t('insert_image')"
                ></button>
                <button
                  class="ql-clean"
                  :aria-label="t('clear_formatting')"
                ></button>
              </span>
            </div>
          </template>
        </Editor>
      </ClientOnly>

      <Textarea
        v-else
        v-model="form.bodyTextTemplate"
        rows="9"
        class="w-full"
        @blur="markTouched('body')"
      />
      <small class="text-surface-500">{{ t('message_help') }}</small>
      <small v-if="showFieldError('body')" class="text-red-500">
        {{ validationErrors.body }}
      </small>

      <div class="border border-surface-200 rounded-md p-3">
        <Button
          text
          size="small"
          :label="showAdvanced ? t('hide_advanced') : t('show_advanced')"
          @click="showAdvanced = !showAdvanced"
        />

        <div
          v-if="showAdvanced"
          class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2"
        >
          <div class="flex flex-col gap-1 md:col-span-2">
            <label class="text-sm font-medium flex items-center gap-1">
              <span>{{ t('sender_daily_limit') }}</span>
              <i
                v-tooltip.top="t('sender_daily_limit_help')"
                class="pi pi-info-circle text-xs text-surface-500"
              />
            </label>
            <InputNumber v-model="form.senderDailyLimit" :min="1" :max="2000" />
          </div>

          <div class="flex items-center gap-2 md:col-span-2">
            <Checkbox
              v-model="form.onlyValidContacts"
              binary
              input-id="valid-only"
            />
            <label for="valid-only">{{ t('only_valid_contacts') }}</label>
            <i
              v-tooltip.top="t('only_valid_contacts_help')"
              class="pi pi-info-circle text-xs text-surface-500"
            />
          </div>

          <div class="flex items-center gap-2">
            <Checkbox
              v-model="form.trackOpen"
              binary
              input-id="track-open"
              :disabled="form.plainTextOnly"
            />
            <label
              for="track-open"
              :class="{ 'opacity-50': form.plainTextOnly }"
              >{{ t('track_open') }}</label
            >
            <i
              v-tooltip.top="
                form.plainTextOnly
                  ? t('track_disabled_plain_text')
                  : t('track_open_help')
              "
              class="pi pi-info-circle text-xs text-surface-500"
            />
          </div>

          <div class="flex items-center gap-2">
            <Checkbox
              v-model="form.trackClick"
              binary
              input-id="track-click"
              :disabled="form.plainTextOnly"
            />
            <label
              for="track-click"
              :class="{ 'opacity-50': form.plainTextOnly }"
              >{{ t('track_click') }}</label
            >
            <i
              v-tooltip.top="
                form.plainTextOnly
                  ? t('track_disabled_plain_text')
                  : t('track_click_help')
              "
              class="pi pi-info-circle text-xs text-surface-500"
            />
          </div>

          <div class="flex items-center gap-2 md:col-span-2">
            <Checkbox
              v-model="form.plainTextOnly"
              binary
              input-id="plain-text"
            />
            <label for="plain-text">{{ t('plain_text_only') }}</label>
            <i
              v-tooltip.top="t('plain_text_only_help')"
              class="pi pi-info-circle text-xs text-surface-500"
            />
          </div>

          <div class="flex flex-col gap-1 md:col-span-2">
            <label class="text-sm font-medium flex items-center gap-1">
              <span>{{ t('footer_template') }}</span>
              <i
                v-tooltip.top="t('footer_template_help')"
                class="pi pi-info-circle text-xs text-surface-500"
              />
            </label>
            <Textarea
              v-model="form.footerTextTemplate"
              rows="4"
              class="w-full"
            />
            <small class="text-surface-500">{{
              t('footer_template_notice')
            }}</small>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div
        class="flex flex-col-reverse sm:flex-row gap-2 justify-between w-full"
      >
        <Button
          class="w-full sm:w-auto"
          :label="t('send_preview')"
          :loading="isSendingPreview"
          :disabled="isActionDisabled"
          @click="sendPreview"
        />
        <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            outlined
            class="w-full sm:w-auto"
            :label="globalT('common.cancel')"
            @click="isVisible = false"
          />
          <Button
            class="w-full sm:w-auto"
            :label="t('send_campaign')"
            :loading="isSubmitting"
            :disabled="isActionDisabled"
            @click="submit(false)"
          />
        </div>
      </div>
    </template>
  </Dialog>

  <GenericComplianceDialog
    ref="genericComplianceDialogRef"
    @action="handleComplianceAction"
  />
</template>

<script setup lang="ts">
import type { Contact } from '@/types/contact';
import { extractUnavailableSenderEmails } from '@/utils/senderOptions';
import { updateMiningSourcesValidityFromUnavailable } from '@/utils/sources';
import Editor from 'primevue/editor';
import GenericComplianceDialog, {
  type ModalData,
} from '@/components/GenericComplianceDialog.vue';

const isVisible = defineModel<boolean>('visible', { required: true });

const props = defineProps<{
  selectedContacts: Contact[];
}>();

const { t } = useI18n({ useScope: 'local' });
const { t: globalT } = useI18n({ useScope: 'global' });
const { $saasEdgeFunctions } = useNuxtApp();
const $screenStore = useScreenStore();
const $leadminer = useLeadminerStore();
const $toast = useToast();
const $user = useSupabaseUser();

const editorRef = ref<{
  quill?: {
    focus: () => void;
    getSelection: () => { index: number } | null;
    insertText: (index: number, text: string) => void;
    setSelection: (index: number, length: number) => void;
  };
}>();
const subjectInputRef = ref<
  { $el?: HTMLInputElement } | HTMLInputElement | null
>(null);
const attributesMenu = ref();

const showAdvanced = ref(false);
const isSubmitting = ref(false);
const isSendingPreview = ref(false);
const isLoadingSenderOptions = ref(false);
const editorReady = ref(false);
const imageResizeAvailable = ref(false);

const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;
const QUILL_IMAGE_RESIZE_REGISTERED_KEY =
  '__leadminer_quill_image_resize_registered__';

const replyTo = computed(() => $user.value?.email ?? '');
const selectedEmails = computed(() =>
  props.selectedContacts.map((item) => item.email),
);
const dialogHeader = computed(() =>
  t('send_email_campaign_with_count', { count: selectedEmails.value.length }),
);

type SenderOptionItem = {
  email: string;
  label: string;
};

const senderOptions = ref<SenderOptionItem[]>([]);
const fallbackSenderEmail = ref('');
const runtimeConfig = useRuntimeConfig();
const genericComplianceDialogRef = ref<InstanceType<
  typeof GenericComplianceDialog
> | null>(null);

const DEFAULT_PROJECT_URL = 'https://example.com/project';
const DEFAULT_PROJECT_IMAGE_SRC =
  'https://placehold.co/360x560?text=Project+photo';

const DEFAULT_BODY_HTML = () => {
  const greeting = t('default_body_greeting', {
    givenNameToken: '{{fullName}}',
  });
  return [
    `<p>${greeting}</p>`,
    `<p>${t('default_body_intro')}</p>`,
    `<p><a href="${DEFAULT_PROJECT_URL}" target="_blank" rel="noopener noreferrer"><img src="${DEFAULT_PROJECT_IMAGE_SRC}" alt="${t('default_body_photo_alt')}" /></a></p>`,
    `<p><a href="${DEFAULT_PROJECT_URL}" target="_blank" rel="noopener noreferrer">${t('default_body_cta')}</a></p>`,
    `<p>${t('default_body_closing')}</p>`,
  ].join('');
};

const DEFAULT_BODY_TEXT = () => {
  const greeting = t('default_body_greeting', {
    givenNameToken: '{{fullName}}',
  });
  return [
    greeting,
    t('default_body_intro'),
    `${t('default_body_photo_label')}: ${DEFAULT_PROJECT_URL}`,
    `${t('default_body_cta_text')}: ${DEFAULT_PROJECT_URL}`,
    t('default_body_closing'),
  ].join('\n\n');
};

const DEFAULT_FOOTER_TEXT = () =>
  String(runtimeConfig.public.CAMPAIGN_COMPLIANCE_FOOTER || '').trim() ||
  t('default_footer_template', {
    ownerEmailToken: '{{ownerEmail}}',
    unsubscribeToken: '{{unsubscribeUrl}}',
  });

const DEFAULT_SENDER_DAILY_LIMIT_UI = 500;

const form = reactive({
  senderName: '',
  senderEmail: '',
  subject: '',
  bodyHtmlTemplate: DEFAULT_BODY_HTML(),
  bodyTextTemplate: DEFAULT_BODY_TEXT(),
  footerTextTemplate: DEFAULT_FOOTER_TEXT(),
  senderDailyLimit: DEFAULT_SENDER_DAILY_LIMIT_UI,
  trackOpen: true,
  trackClick: true,
  plainTextOnly: false,
  onlyValidContacts: true,
});

const attributeOptions = [
  'name',
  'fullName',
  'givenName',
  'familyName',
  'email',
  'emailDomain',
  'location',
  'worksFor',
  'jobTitle',
  'alternateName',
  'telephone',
  'seniority',
  'recency',
  'occurrence',
  'conversations',
  'repliedConversations',
  'sender',
  'recipient',
];

type EdgeResponseError = {
  statusCode?: number;
  data?: {
    code?: string;
    error?: string;
    fallbackSenderEmail?: string;
  };
};

type FormField = 'senderName' | 'senderEmail' | 'replyTo' | 'subject' | 'body';

const touched = reactive<Record<FormField, boolean>>({
  senderName: false,
  senderEmail: false,
  replyTo: false,
  subject: false,
  body: false,
});

const validationErrors = computed<Record<FormField, string>>(() => {
  const htmlText = form.bodyHtmlTemplate
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();
  const hasBody = form.plainTextOnly
    ? form.bodyTextTemplate.trim().length > 0
    : htmlText.length > 0 || form.bodyTextTemplate.trim().length > 0;

  return {
    senderName: form.senderName.trim().length ? '' : t('sender_name_required'),
    senderEmail: form.senderEmail.trim().length
      ? ''
      : t('sender_email_required'),
    replyTo: replyTo.value.trim().length ? '' : t('reply_to_required'),
    subject: form.subject.trim().length ? '' : t('subject_required'),
    body: hasBody ? '' : t('body_required'),
  };
});

const isFormValid = computed(() =>
  Object.values(validationErrors.value).every((value) => !value),
);
const isActionDisabled = computed(
  () =>
    !selectedEmails.value.length ||
    isLoadingSenderOptions.value ||
    isSendingPreview.value ||
    isSubmitting.value ||
    !isFormValid.value,
);

const editorModules = computed(() => ({
  uploader: {
    mimetypes: ['image/png', 'image/jpeg'],
    handler(
      this: {
        quill?: {
          scroll?: { query: (name: string) => unknown };
          getSelection: (
            focus?: boolean,
          ) => { index: number; length: number } | null;
          getLength: () => number;
          deleteText: (index: number, length: number, source?: string) => void;
          insertEmbed: (
            index: number,
            type: string,
            value: string,
            source?: string,
          ) => void;
          setSelection: (
            index: number,
            length: number,
            source?: string,
          ) => void;
        };
      },
      range: { index: number; length: number },
      files: FileList,
    ) {
      const { quill } = this;
      if (!quill?.scroll?.query('image')) {
        return;
      }

      const images = Array.from(files || []).filter((file) =>
        ['image/png', 'image/jpeg'].includes(file.type),
      );

      if (!images.length) {
        return;
      }

      const oversized = images.filter(
        (file) => file.size > MAX_IMAGE_SIZE_BYTES,
      );
      if (oversized.length) {
        $toast.add({
          severity: 'error',
          summary: t('image_too_large_title'),
          detail: t('image_too_large_detail', { maxSizeMb: 4 }),
          life: 4500,
        });
      }

      const validImages = images.filter(
        (file) => file.size <= MAX_IMAGE_SIZE_BYTES,
      );
      if (!validImages.length) {
        return;
      }

      Promise.all(
        validImages.map(
          (file) =>
            new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ''));
              reader.readAsDataURL(file);
            }),
        ),
      ).then((encodedImages) => {
        const selection = range ??
          quill.getSelection(true) ?? { index: quill.getLength(), length: 0 };
        const { index: selectionIndex, length: selectionLength } = selection;
        let index = selectionIndex;
        quill.deleteText(selectionIndex, selectionLength, 'user');

        encodedImages.forEach((encoded) => {
          quill.insertEmbed(index, 'image', encoded, 'user');
          index += 1;
        });

        quill.setSelection(index, 0, 'silent');
      });
    },
  },
  ...(imageResizeAvailable.value
    ? {
        imageResize: {
          modules: ['Resize', 'DisplaySize', 'Toolbar'],
        },
      }
    : {}),
}));

type AttributeTarget = 'subject' | 'body';
const activeAttributeTarget = ref<AttributeTarget>('body');

const attributeMenuItems = computed(() =>
  attributeOptions.map((key) => ({
    label: `{{${key}}}`,
    command: () => insertVariable(key, activeAttributeTarget.value),
  })),
);

const subjectSelectionStart = ref(0);
const subjectSelectionEnd = ref(0);

function getSubjectInputElement(): HTMLInputElement | null {
  if (subjectInputRef.value instanceof HTMLInputElement) {
    return subjectInputRef.value;
  }

  if (subjectInputRef.value?.$el instanceof HTMLInputElement) {
    return subjectInputRef.value.$el;
  }

  return null;
}

function updateSubjectSelection(event: Event) {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  subjectSelectionStart.value = target.selectionStart ?? form.subject.length;
  subjectSelectionEnd.value = target.selectionEnd ?? form.subject.length;
}

function toggleAttributeMenu(event: Event, target: AttributeTarget) {
  activeAttributeTarget.value = target;
  if (target === 'subject') {
    const input = getSubjectInputElement();
    const fallback = form.subject.length;
    subjectSelectionStart.value = input?.selectionStart ?? fallback;
    subjectSelectionEnd.value = input?.selectionEnd ?? fallback;
  }
  attributesMenu.value.toggle(event);
}

function onEditorInput() {
  form.bodyTextTemplate = '';
  touched.body = true;
}

async function onDialogShow() {
  editorReady.value = false;
  imageResizeAvailable.value = await ensureQuillImageResizeModule();
  editorReady.value = true;
}

function onDialogHide() {
  editorReady.value = false;
}

async function ensureQuillImageResizeModule() {
  if (typeof window === 'undefined') {
    return false;
  }

  const globalWindow = window as Window & {
    [QUILL_IMAGE_RESIZE_REGISTERED_KEY]?: boolean;
    Quill?: {
      imports?: Record<string, unknown>;
      register?: (path: string, module: unknown) => void;
    };
    ImageResize?: unknown;
  };
  if (globalWindow[QUILL_IMAGE_RESIZE_REGISTERED_KEY]) {
    return true;
  }

  try {
    const { default: Quill } = await import('quill');
    globalWindow.Quill = Quill as unknown as typeof globalWindow.Quill;

    if (globalWindow.Quill?.imports?.['modules/imageResize']) {
      globalWindow[QUILL_IMAGE_RESIZE_REGISTERED_KEY] = true;
      return true;
    }

    const resizeModule = await import('quill-image-resize-module');
    const ImageResize =
      (resizeModule as { ImageResize?: unknown; default?: unknown })
        .ImageResize ||
      (resizeModule as { default?: unknown }).default ||
      globalWindow.ImageResize;

    if (ImageResize && globalWindow.Quill?.register) {
      globalWindow.Quill.register('modules/imageResize', ImageResize);
    }

    if (!globalWindow.Quill?.imports?.['modules/imageResize']) {
      return false;
    }

    globalWindow[QUILL_IMAGE_RESIZE_REGISTERED_KEY] = true;
    return true;
  } catch {
    return false;
  }
}

function insertVariable(attribute: string, target: AttributeTarget = 'body') {
  if (target === 'subject') {
    const token = `{{${attribute}}}`;
    const start = Math.max(
      0,
      Math.min(subjectSelectionStart.value, form.subject.length),
    );
    const end = Math.max(
      start,
      Math.min(subjectSelectionEnd.value, form.subject.length),
    );
    form.subject = `${form.subject.slice(0, start)}${token}${form.subject.slice(end)}`;
    touched.subject = true;

    nextTick(() => {
      const input = getSubjectInputElement();
      if (!input) return;
      const cursor = start + token.length;
      input.focus();
      input.setSelectionRange(cursor, cursor);
      subjectSelectionStart.value = cursor;
      subjectSelectionEnd.value = cursor;
    });
    return;
  }

  if (form.plainTextOnly) {
    form.bodyTextTemplate += ` {{${attribute}}}`;
    touched.body = true;
    return;
  }

  const quill = editorRef.value?.quill;
  if (!quill) {
    form.bodyHtmlTemplate += ` {{${attribute}}}`;
    return;
  }

  quill.focus();
  const selection = quill.getSelection();
  const index = selection?.index ?? (form.bodyHtmlTemplate?.length || 0);
  const token = `{{${attribute}}}`;
  quill.insertText(index, token);
  quill.setSelection(index + token.length, 0);
  touched.body = true;
}

function markTouched(field: FormField) {
  touched[field] = true;
}

function resetTouched() {
  touched.senderName = false;
  touched.senderEmail = false;
  touched.replyTo = false;
  touched.subject = false;
  touched.body = false;
}

function showFieldError(field: FormField) {
  return touched[field] && Boolean(validationErrors.value[field]);
}

function ensureValidForm() {
  touched.senderName = true;
  touched.senderEmail = true;
  touched.replyTo = true;
  touched.subject = true;
  touched.body = true;

  if (isFormValid.value) return true;

  $toast.add({
    severity: 'warn',
    summary: t('required_fields_missing_title'),
    detail: t('required_fields_missing_detail'),
    life: 4500,
  });
  return false;
}

function resolveErrorMessage(error: unknown, fallbackKey: string) {
  const parsedError = error as EdgeResponseError;
  const code = parsedError?.data?.code;

  if (code) {
    const mapped: Record<string, string> = {
      MISSING_REQUIRED_FIELDS: t('error_missing_required_fields'),
      SENDER_NOT_ALLOWED: t('error_sender_not_allowed'),
      SENDER_SMTP_FAILED: t('error_sender_smtp_failed'),
      NO_ELIGIBLE_CONTACTS: t('error_no_eligible_contacts'),
      SMTP_SENDER_NOT_CONFIGURED: t('error_smtp_not_configured'),
      CONTACTS_FETCH_FAILED: t('error_contacts_fetch_failed'),
      CAMPAIGN_CREATE_FAILED: t('error_campaign_create_failed'),
      CAMPAIGN_RECIPIENTS_CREATE_FAILED: t('error_campaign_recipients_failed'),
    };

    if (mapped[code]) {
      return mapped[code];
    }
  }

  if (parsedError?.statusCode === 401) {
    return t('error_not_authenticated');
  }
  if (parsedError?.statusCode === 403) {
    return t('error_forbidden');
  }
  if (parsedError?.statusCode === 422) {
    return t('error_invalid_payload');
  }
  if (parsedError?.statusCode && parsedError.statusCode >= 500) {
    return t('error_server_unavailable');
  }

  if (parsedError?.data?.error) {
    return parsedError.data.error;
  }

  return t(fallbackKey);
}

function startCampaignCompletionWatcher(campaignId: string) {
  const timer = setInterval(async () => {
    try {
      const data = await $saasEdgeFunctions(
        `email-campaigns/campaigns/${campaignId}/status`,
        {
          method: 'GET',
        },
      );
      if (data?.status !== 'completed' && data?.status !== 'failed') return;

      clearInterval(timer);

      if (data.status === 'failed') {
        $toast.add({
          group: 'has-links',
          severity: 'error',
          summary: t('campaign_failed'),
          detail: {
            message: t('campaign_failed_detail'),
            button: {
              text: t('see_results'),
              action: () => navigateTo('/campaigns'),
            },
          },
          life: 12000,
        });
        return;
      }

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

function handleComplianceAction(action: string, data?: ModalData['data']) {
  if (action === 'continue_partial' && data) {
    // User wants to proceed with partial campaign
    submit(true);
  }
  // Other actions (cancel, upgrade) are handled by the dialog automatically
}

function normalizeBodyText() {
  if (form.plainTextOnly) {
    return form.bodyTextTemplate;
  }
  return (
    form.bodyTextTemplate || form.bodyHtmlTemplate.replace(/<[^>]*>/g, ' ')
  );
}

async function loadSenderOptions() {
  isLoadingSenderOptions.value = true;
  try {
    const data = await $saasEdgeFunctions(
      'email-campaigns/campaigns/sender-options',
      {
        method: 'POST',
      },
    );

    fallbackSenderEmail.value = data.fallbackSenderEmail || '';
    form.senderDailyLimit = DEFAULT_SENDER_DAILY_LIMIT_UI;
    const allOptions = (data.options || []).map(
      (option: { email: string; available: boolean }) => {
        return {
          email: option.email,
          available: option.available,
        };
      },
    );

    const unavailableEmails = extractUnavailableSenderEmails(allOptions);
    if (unavailableEmails.length) {
      $toast.add({
        severity: 'warn',
        summary: t('senders_unavailable_title'),
        detail: t('senders_unavailable_notification', {
          emails: unavailableEmails.join(', '),
        }),
        life: 6500,
      });
    }

    $leadminer.miningSources = updateMiningSourcesValidityFromUnavailable(
      $leadminer.miningSources,
      unavailableEmails,
    );

    senderOptions.value = allOptions
      .filter((option) => option.available)
      .map((option) => ({
        email: option.email,
        label: option.email,
      }));

    if (!senderOptions.value.length && fallbackSenderEmail.value) {
      senderOptions.value = [
        {
          email: fallbackSenderEmail.value,
          label: fallbackSenderEmail.value,
        },
      ];
    }

    const firstAvailable = senderOptions.value[0]?.email || '';
    const selected = senderOptions.value.find(
      (option) => option.email === form.senderEmail,
    );
    if (!selected) {
      form.senderEmail = firstAvailable;
    }
  } catch (error: unknown) {
    if (fallbackSenderEmail.value) {
      senderOptions.value = [
        {
          email: fallbackSenderEmail.value,
          label: fallbackSenderEmail.value,
        },
      ];
      form.senderEmail = fallbackSenderEmail.value;
    }
    $toast.add({
      severity: 'error',
      summary: t('sender_options_load_failed'),
      detail: resolveErrorMessage(error, 'error_sender_options_load_failed'),
      life: 4500,
    });
  } finally {
    isLoadingSenderOptions.value = false;
  }
}

async function sendPreview() {
  if (!ensureValidForm()) {
    return;
  }

  if (!selectedEmails.value.length) {
    return;
  }

  isSendingPreview.value = true;
  try {
    const data = await $saasEdgeFunctions('email-campaigns/campaigns/preview', {
      method: 'POST',
      body: {
        selectedEmails: selectedEmails.value,
        senderName: form.senderName,
        senderEmail: form.senderEmail,
        replyTo: replyTo.value,
        subject: form.subject,
        bodyHtmlTemplate: form.bodyHtmlTemplate,
        bodyTextTemplate: normalizeBodyText(),
        footerTextTemplate: form.footerTextTemplate,
        plainTextOnly: form.plainTextOnly,
        onlyValidContacts: form.onlyValidContacts,
      },
    });

    $toast.add({
      severity: 'success',
      summary: t('preview_sent'),
      detail: t('preview_sent_detail', {
        selectedContactEmail: data?.selectedContactEmail || '-',
        sentToEmail: data?.sentToEmail || '-',
      }),
      life: 3500,
    });
  } catch (error: unknown) {
    const parsedError = error as EdgeResponseError;
    const code = parsedError?.data?.code;
    if (code === 'SENDER_SMTP_FAILED' && fallbackSenderEmail.value) {
      form.senderEmail =
        parsedError?.data?.fallbackSenderEmail || fallbackSenderEmail.value;
    }

    $toast.add({
      severity: 'error',
      summary: t('preview_failed'),
      detail: resolveErrorMessage(error, 'error_preview_failed'),
      life: 4500,
    });
  } finally {
    isSendingPreview.value = false;
  }
}

async function submit(partialCampaign = false) {
  if (!ensureValidForm()) {
    return;
  }

  if (!selectedEmails.value.length) {
    return;
  }

  isSubmitting.value = true;
  let shouldCloseDialog = true;
  let showErrorToast = true;

  try {
    const data = await $saasEdgeFunctions('email-campaigns/campaigns/create', {
      method: 'POST',
      body: {
        selectedEmails: selectedEmails.value,
        senderName: form.senderName,
        senderEmail: form.senderEmail,
        replyTo: replyTo.value,
        subject: form.subject,
        bodyHtmlTemplate: form.bodyHtmlTemplate,
        bodyTextTemplate: normalizeBodyText(),
        footerTextTemplate: form.footerTextTemplate,
        senderDailyLimit: form.senderDailyLimit,
        trackOpen: form.trackOpen,
        trackClick: form.trackClick,
        plainTextOnly: form.plainTextOnly,
        onlyValidContacts: form.onlyValidContacts,
        partialCampaign,
      },
      onResponse: ({ response }) => {
        // Handle modal responses (402 and 266)
        if (response.status === 402 || response.status === 266) {
          const modalData = response._data as ModalData;

          if (modalData?.type === 'modal') {
            genericComplianceDialogRef.value?.openModal(modalData);
            shouldCloseDialog = false;
            showErrorToast = false;
            return;
          }
        }

        if (response.status === 200) {
          return;
        }

        throw new Error(response._data?.error || 'Campaign creation failed');
      },
    });

    if (shouldCloseDialog) {
      $toast.add({
        group: 'has-links',
        severity: 'success',
        summary: t('campaign_started'),
        detail: {
          message: t('campaign_started_detail'),
          button: {
            text: t('see_campaigns'),
            action: () => navigateTo('/campaigns'),
          },
        },
        life: 6000,
      });

      if (data?.campaignId) {
        startCampaignCompletionWatcher(data.campaignId);
      }

      isVisible.value = false;
    }
  } catch (error: unknown) {
    if (showErrorToast) {
      const parsedError = error as EdgeResponseError;
      const code = parsedError?.data?.code;
      if (code === 'SENDER_SMTP_FAILED' && fallbackSenderEmail.value) {
        form.senderEmail =
          parsedError?.data?.fallbackSenderEmail || fallbackSenderEmail.value;
      }

      $toast.add({
        severity: 'error',
        summary: t('campaign_start_failed'),
        detail: resolveErrorMessage(error, 'error_campaign_start_failed'),
        life: 5000,
      });
    }
  } finally {
    isSubmitting.value = false;
  }
}

watch(
  isVisible,
  async (visible) => {
    if (!visible) return;
    resetTouched();

    if (!form.senderName) {
      form.senderName =
        ($user.value?.email || '').split('@')[0] || 'Leadminer user';
    }
    if (!form.bodyHtmlTemplate) {
      form.bodyHtmlTemplate = DEFAULT_BODY_HTML();
    }
    if (!form.bodyTextTemplate) {
      form.bodyTextTemplate = DEFAULT_BODY_TEXT();
    }
    if (!form.footerTextTemplate) {
      form.footerTextTemplate = DEFAULT_FOOTER_TEXT();
    }

    await loadSenderOptions();
  },
  { immediate: true },
);

watch(
  () => form.plainTextOnly,
  (isPlainTextOnly) => {
    if (isPlainTextOnly) {
      form.bodyTextTemplate = normalizeBodyText();
      form.trackClick = false;
      form.trackOpen = false;
    }
  },
);
</script>

<style scoped>
:deep(.p-editor-container) {
  border: 1px solid var(--p-surface-300);
  border-radius: 8px;
}

:deep(.p-editor-toolbar) {
  border: 0;
  border-bottom: 1px solid var(--p-surface-300);
}

.campaign-editor-toolbar {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  white-space: nowrap;
  gap: 0.25rem;
  padding-bottom: 0.125rem;
}

:deep(.p-editor-content .ql-container) {
  min-height: 220px;
  border: 0;
}

:deep(.ql-editor.ql-blank::before) {
  color: var(--p-surface-500);
  font-style: normal;
}
</style>

<i18n lang="json">
{
  "en": {
    "send_email_campaign": "Send email campaign",
    "send_email_campaign_with_count": "Send email campaign ({count} contacts)",
    "gdpr_notice": "You may send campaigns only when you have a valid legal basis (legitimate interest or consent). For legitimate interest, target contacts with prior exchanges for a similar purpose, provide clear information, and always include an unsubscribe link.",
    "campaign_limit_note": "To help protect your campaign deliverability, 1000 emails are sent per day by default. To learn more about this limit,",
    "more_info": "click here.",
    "sender_name": "Sender name",
    "sender_name_help": "The sender name displayed in your recipient inbox.",
    "sender_email": "Sender email",
    "sender_email_help": "The email address used to send this campaign.",
    "senders_unavailable_title": "Some sender addresses are unavailable",
    "senders_unavailable_notification": "The following addresses are no longer available: {emails}. Please reconnect them in Sources.",
    "reply_to": "Reply-to",
    "reply_to_help": "Replies from recipients will be sent to this email address.",
    "subject": "Subject",
    "subject_placeholder": "💡 A collaboration idea to explore",
    "subject_help": "Keep it clear and specific to improve open rate.",
    "insert_person_attribute_subject": "Insert contact attribute in subject",
    "insert_person_attribute_body": "Insert contact attribute in email body",
    "editor_placeholder": "Write your campaign message here...",
    "default_body_greeting": "Hi {givenNameToken},",
    "default_body_intro": "I'm reaching out because I have a project I'd love to share with you.",
    "default_body_photo_alt": "Project photo",
    "default_body_photo_label": "Project photo",
    "default_body_cta": "Click here to learn more.",
    "default_body_cta_text": "Click here to learn more",
    "default_body_closing": "Best regards,",
    "message_help": "Use contact attributes to personalize each message.",
    "show_advanced": "Show advanced options",
    "hide_advanced": "Hide advanced options",
    "sender_daily_limit": "Sender daily limit",
    "sender_daily_limit_help": "Daily number of emails sent from this sender.",
    "only_valid_contacts": "Only send to Valid contacts",
    "only_valid_contacts_help": "Only contacts with VALID deliverability will receive this campaign.",
    "track_open": "Track opening",
    "track_open_help": "Adds a tracking pixel to measure opens.",
    "track_click": "Track clicking",
    "track_click_help": "Converts links into tracked links for click analytics.",
    "track_disabled_plain_text": "Disabled for plain text emails",
    "plain_text_only": "Send pure text (no HTML)",
    "plain_text_only_help": "Disables rich formatting and sends a plain text email.",
    "footer_template": "Compliance footer",
    "footer_template_help": "You can edit this text. The unsubscribe link remains mandatory.",
    "footer_template_notice": "The unsubscribe link is mandatory and added automatically.",
    "default_footer_template": "---\n\nYou received this email because {ownerEmailToken} used leadminer.io to extract contacts from their mailbox. Try https://leadminer.io yourself.\n\nClick here to unsubscribe: {unsubscribeToken}",
    "send_preview": "Send me a preview message",
    "send_campaign": "Send campaign",
    "sender_name_required": "Sender name is required.",
    "sender_email_required": "Sender email is required.",
    "reply_to_required": "Reply-to email is required.",
    "subject_required": "Subject is required.",
    "body_required": "Message content is required.",
    "required_fields_missing_title": "Required fields are missing",
    "required_fields_missing_detail": "Please complete all required fields before sending.",
    "bold": "Bold",
    "italic": "Italic",
    "underline": "Underline",
    "bullet_list": "Bullet list",
    "insert_link": "Insert link",
    "insert_image": "Insert image",
    "image_too_large_title": "Image too large",
    "image_too_large_detail": "Please upload an image up to {maxSizeMb} MB.",
    "clear_formatting": "Clear formatting",
    "prompt_link_url": "Link URL",
    "prompt_image_url": "Image URL",
    "preview_sent": "Preview sent",
    "preview_sent_detail": "Preview sent to {sentToEmail} using contact {selectedContactEmail}.",
    "preview_failed": "Preview failed",
    "sender_options_load_failed": "Unable to load sender options",
    "error_missing_required_fields": "Please complete all required fields before sending.",
    "error_sender_not_allowed": "The selected sender address is not available for your account.",
    "error_sender_smtp_failed": "Unable to send with this address. Please verify SMTP/OAuth configuration.",
    "error_no_eligible_contacts": "No eligible contact is available for this campaign.",
    "error_smtp_not_configured": "Email sending is not configured. Please contact support.",
    "error_contacts_fetch_failed": "Unable to load contacts for this campaign.",
    "error_campaign_create_failed": "The campaign could not be created. Please try again.",
    "error_campaign_recipients_failed": "Recipients could not be queued. Please try again.",
    "error_not_authenticated": "Your session has expired. Please sign in again.",
    "error_forbidden": "You are not authorized to perform this action.",
    "error_invalid_payload": "Some campaign fields are invalid. Please review the form.",
    "error_server_unavailable": "The sending service is temporarily unavailable. Please try again later.",
    "error_sender_options_load_failed": "Unable to load sender settings. Please try again.",
    "error_preview_failed": "The preview could not be sent.",
    "error_campaign_start_failed": "The campaign could not be started.",
    "campaign_started": "Campaign sending started successfully",
    "campaign_started_detail": "Campaign was queued and will be processed in batches.",
    "campaign_start_failed": "Campaign failed to start",
    "campaign_sent": "Campaign sent",
    "campaign_sent_detail": "Your campaign has been fully sent.",
    "campaign_failed": "Campaign failed",
    "campaign_failed_detail": "The campaign could not deliver any email. Please review your sender configuration and try again.",
    "see_results": "See results",
    "see_campaigns": "See campaigns"
  },
  "fr": {
    "send_email_campaign": "Envoyer une campagne email",
    "send_email_campaign_with_count": "Envoyer une campagne email ({count} contacts)",
    "gdpr_notice": "Vous pouvez envoyer une campagne si vous disposez d'une base légale valide (intérêt légitime ou consentement). En intérêt légitime, ciblez des contacts avec lesquels vous avez déjà échangé pour une finalité comparable, informez-les clairement et incluez toujours un lien de désinscription.",
    "campaign_limit_note": "Afin de garantir la déliverabilité de votre campagne email, par défaut 1000 emails sont envoyés par jour. Pour en savoir plus sur cette limite,",
    "more_info": "cliquez ici.",
    "sender_name": "Nom de l'expéditeur",
    "sender_name_help": "Nom affiché dans la boîte de réception de vos destinataires.",
    "sender_email": "Adresse d'expédition",
    "sender_email_help": "Adresse email utilisée pour envoyer cette campagne.",
    "senders_unavailable_title": "Certaines adresses d'expédition sont indisponibles",
    "senders_unavailable_notification": "Les adresses suivantes ne sont plus disponibles : {emails}. Veuillez les reconnecter dans les sources.",
    "reply_to": "Répondre à",
    "reply_to_help": "Les réponses de vos destinataires seront envoyées à cette adresse.",
    "subject": "Sujet",
    "subject_placeholder": "💡 Une idée de collaboration à explorer",
    "subject_help": "Soyez précis et explicite pour améliorer le taux d'ouverture.",
    "insert_person_attribute_subject": "Insérer un attribut contact dans le sujet",
    "insert_person_attribute_body": "Insérer un attribut contact dans le corps de l'email",
    "editor_placeholder": "Rédigez le contenu de votre campagne ici...",
    "default_body_greeting": "Bonjour {givenNameToken},",
    "default_body_intro": "Je vous contacte car j'ai un projet que j'aimerais vous présenter.",
    "default_body_photo_alt": "Photo du projet",
    "default_body_photo_label": "Photo du projet",
    "default_body_cta": "Cliquez ici pour en savoir plus.",
    "default_body_cta_text": "Cliquez ici pour en savoir plus",
    "default_body_closing": "Bien cordialement,",
    "message_help": "Utilisez des attributs contact pour personnaliser chaque message.",
    "show_advanced": "Afficher les options avancées",
    "hide_advanced": "Masquer les options avancées",
    "sender_daily_limit": "Limite quotidienne de l'expéditeur",
    "sender_daily_limit_help": "Nombre d'emails envoyés chaque jour depuis cet expéditeur.",
    "only_valid_contacts": "Envoyer uniquement aux contacts valides",
    "only_valid_contacts_help": "Seuls les contacts avec une délivrabilité VALIDE recevront la campagne.",
    "track_open": "Suivre les ouvertures",
    "track_open_help": "Ajoute un pixel de suivi pour mesurer les ouvertures.",
    "track_click": "Suivre les clics",
    "track_click_help": "Transforme les liens pour mesurer les clics.",
    "track_disabled_plain_text": "Désactivé pour les emails texte brut",
    "plain_text_only": "Envoyer en texte brut (sans HTML)",
    "plain_text_only_help": "Désactive la mise en forme riche et envoie un email texte uniquement.",
    "footer_template": "Pied de page conformité",
    "footer_template_help": "Vous pouvez modifier ce texte. Le lien de désinscription reste obligatoire.",
    "footer_template_notice": "Le lien de désinscription est obligatoire et ajouté automatiquement.",
    "default_footer_template": "---\n\nVous recevez cet email parce que {ownerEmailToken} a utilisé leadminer.io pour extraire ses contacts email. Essayez https://leadminer.io vous aussi.\n\nCliquez ici pour vous désinscrire : {unsubscribeToken}",
    "send_preview": "M'envoyer un aperçu",
    "send_campaign": "Envoyer la campagne",
    "sender_name_required": "Le nom de l'expéditeur est obligatoire.",
    "sender_email_required": "L'adresse d'expédition est obligatoire.",
    "reply_to_required": "L'adresse de réponse est obligatoire.",
    "subject_required": "Le sujet est obligatoire.",
    "body_required": "Le contenu du message est obligatoire.",
    "required_fields_missing_title": "Des champs obligatoires sont manquants",
    "required_fields_missing_detail": "Complétez les champs obligatoires avant l'envoi.",
    "bold": "Gras",
    "italic": "Italique",
    "underline": "Souligné",
    "bullet_list": "Liste à puces",
    "insert_link": "Insérer un lien",
    "insert_image": "Insérer une image",
    "image_too_large_title": "Image trop volumineuse",
    "image_too_large_detail": "Veuillez importer une image de {maxSizeMb} Mo maximum.",
    "clear_formatting": "Effacer la mise en forme",
    "prompt_link_url": "URL du lien",
    "prompt_image_url": "URL de l'image",
    "preview_sent": "Aperçu envoyé",
    "preview_sent_detail": "Aperçu envoyé à {sentToEmail} avec le contact {selectedContactEmail}.",
    "preview_failed": "Échec de l'aperçu",
    "sender_options_load_failed": "Impossible de charger les expéditeurs",
    "error_missing_required_fields": "Complétez les champs obligatoires avant l'envoi.",
    "error_sender_not_allowed": "L'adresse d'expédition sélectionnée n'est pas autorisée pour ce compte.",
    "error_sender_smtp_failed": "Impossible d'envoyer avec cette adresse. Vérifiez la configuration SMTP/OAuth.",
    "error_no_eligible_contacts": "Aucun contact éligible n'est disponible pour cette campagne.",
    "error_smtp_not_configured": "L'envoi d'emails n'est pas configuré. Contactez le support.",
    "error_contacts_fetch_failed": "Impossible de charger les contacts pour cette campagne.",
    "error_campaign_create_failed": "La campagne n'a pas pu être créée. Réessayez.",
    "error_campaign_recipients_failed": "Les destinataires n'ont pas pu être mis en file. Réessayez.",
    "error_not_authenticated": "Votre session a expiré. Veuillez vous reconnecter.",
    "error_forbidden": "Vous n'êtes pas autorisé à effectuer cette action.",
    "error_invalid_payload": "Certains champs de la campagne sont invalides. Vérifiez le formulaire.",
    "error_server_unavailable": "Le service d'envoi est temporairement indisponible. Réessayez plus tard.",
    "error_sender_options_load_failed": "Impossible de charger les paramètres d'expédition. Réessayez.",
    "error_preview_failed": "Impossible d'envoyer l'aperçu.",
    "error_campaign_start_failed": "Impossible de démarrer la campagne.",
    "campaign_started": "Envoi de la campagne démarré avec succès",
    "campaign_started_detail": "La campagne est en file d'attente et sera traitée par lots.",
    "campaign_start_failed": "La campagne n'a pas pu démarrer",
    "campaign_sent": "Campagne envoyée",
    "campaign_sent_detail": "Votre campagne a été envoyée en totalité.",
    "campaign_failed": "Campagne échouée",
    "campaign_failed_detail": "La campagne n'a pu envoyer aucun email. Vérifiez la configuration d'expédition puis réessayez.",
    "see_results": "Voir les résultats",
    "see_campaigns": "Voir les campagnes"
  }
}
</i18n>
