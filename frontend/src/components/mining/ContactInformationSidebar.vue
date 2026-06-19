<template>
  <Drawer
    v-model:visible="show"
    position="right"
    class="w-full md:w-1/2 xl:w-1/3"
    pt:header:class="flex-col-reverse"
    pt:pc-close-button:root:class="self-end"
    @hide="() => onHide()"
  >
    <template #header>
      <div class="flex items-start gap-2 w-full">
        <Image
          v-if="contact.image && !editingContact"
          :src="getImageViaProxy(contact.image)"
          image-class="size-16 md:size-20 rounded-full"
          class="flex-none"
        />
        <div class="grow truncate">
          <div class="grow truncate">
            <div
              v-if="contact.name && !editingContact"
              class="font-medium text-xl md:text-2xl truncate"
            >
              {{ contact.name }}
            </div>
            <InputText
              v-if="editingContact"
              v-model="contactEdit.name"
              :placeholder="$t('contact.name')"
              size="large"
              class="w-full"
            />
            <div class="flex gap-1 items-center">
              <div class="grow gap-2 flex items-center truncate min-w-0">
                <Badge
                  v-tooltip.top="getStatusLabel(contact.status)"
                  class="min-w-4 h-4 flex-none cursor-pointer hover:opacity-75 transition-opacity"
                  :class="{ 'cursor-default': !hasEmail }"
                  :style="!hasEmail ? 'cursor: default' : ''"
                  :severity="getStatusColor(contact.status)"
                  @click.stop="refreshStatusBadge()"
                >
                  <span v-if="refreshingStatus" class="animate-spin">
                    <i class="pi pi-spin pi-spinner" />
                  </span>
                </Badge>
                <div
                  v-tooltip.top="getContactIdentifier(contact)"
                  class="truncate"
                >
                  {{ getContactIdentifier(contact) }}
                </div>
              </div>
              <Button
                v-if="!editingContact && contact.email"
                rounded
                text
                icon="pi pi-copy"
                size="large"
                class="text-2xl flex-none -ml-2"
                :aria-label="t('copy')"
                @click="copyContact(contact.email, contact.name ?? undefined)"
              />
              <ExportContacts
                v-if="!editingContact"
                :contacts-to-treat="[contact.id]"
                :disable-export="isExportDisabled"
              />
            </div>
          </div>
          <div
            v-if="contact.same_as?.length && !editingContact"
            class="flex gap-2 grow"
          >
            <social-links-and-phones :social-links="contact.same_as" />
          </div>
          <div class="flex items-center gap-1 pt-1">
            <span class="font-medium">{{ $t('contact.tags') }}</span>
            <i
              v-tooltip.top="$t('contact.categorize_contacts')"
              class="pi pi-info-circle text-surface-400 cursor-help text-sm"
            />
          </div>
          <div
            v-if="!editingContact && allTags.length"
            class="flex flex-wrap pt-1 gap-1"
          >
            <Tag
              v-for="tag in allTags"
              :key="tag"
              :value="getTagLabel(tag)"
              :severity="getTagColor(tag)"
            />
          </div>
          <div v-else-if="editingContact" class="pt-1">
            <AutoComplete
              ref="tagAutoComplete"
              v-model="contactEditTags"
              :suggestions="filteredTagSuggestions"
              multiple
              fluid
              :placeholder="t('tags_placeholder')"
              @complete="searchTags"
              @blur="commitPendingTag"
              @input="
                (e: Event) =>
                  (pendingTagInput = (e.target as HTMLInputElement).value)
              "
            />
          </div>
        </div>
      </div>
    </template>

    <!-- Content -->
    <table
      class="p-datatable p-datatable-striped w-full"
      style="display: table"
    >
      <tbody class="p-datatable-tbody">
        <tr class="p-row-even border-t-1 border-(--p-drawer-border-color)">
          <td class="md:font-medium w-4/12">
            {{ $t('contact.given_name') }}
          </td>
          <td>
            <div v-if="!editingContact">
              {{ contact.given_name }}
            </div>
            <InputText v-else v-model="contactEdit.given_name" class="w-full" />
          </td>
        </tr>
        <tr class="p-row-odd">
          <td class="md:font-medium">{{ $t('contact.family_name') }}</td>
          <td class="w-full">
            <div v-if="!editingContact">
              {{ contact.family_name }}
            </div>
            <InputText
              v-else
              v-model="contactEdit.family_name"
              class="w-full"
            />
          </td>
        </tr>
        <tr class="p-row-even">
          <td class="md:font-medium">
            {{ $t('contact.alternate_name') }}
          </td>
          <td>
            <div v-if="!editingContact">
              {{ contact.alternate_name?.join(', ') }}
            </div>
            <Textarea
              v-else
              v-model="contactEdit.alternate_name"
              rows="3"
              class="w-full"
            />
          </td>
        </tr>

        <tr
          v-if="contact.telephone && contact.telephone.length > 0"
          class="p-row-odd"
        >
          <td class="md:font-medium">
            {{ $t('contact.telephone') }}
          </td>
          <td>
            <div v-if="!editingContact" class="flex flex-wrap gap-1">
              <Chip
                v-for="phone in contact.telephone"
                :key="phone"
                :label="phone"
                :href="`tel:${phone}`"
                icon="pi pi-phone"
                class="cursor-pointer"
                @click="callPhoneNumber(phone)"
              />
            </div>
            <Textarea
              v-else
              v-model="contactEdit.telephone"
              rows="3"
              class="w-full"
            />
          </td>
        </tr>

        <tr v-if="contact.location" class="p-row-even">
          <td class="md:font-medium">{{ $t('contact.location') }}</td>
          <td>
            <div v-if="!editingContact">
              <NormalizedLocation
                :normalized-location="contact.location_normalized"
              />
              {{ contact.location }}
            </div>
            <Textarea
              v-else
              v-model="contactEdit.location"
              rows="3"
              class="w-full"
            />
          </td>
        </tr>

        <tr class="p-row-odd">
          <td class="md:font-medium">{{ $t('contact.works_for') }}</td>
          <td>
            <div v-if="!editingContact">{{ contact.works_for }}</div>
            <InputText v-else v-model="contactEdit.works_for" class="w-full" />
          </td>
        </tr>
        <tr class="p-row-even">
          <td class="md:font-medium">{{ $t('contact.job_title') }}</td>
          <td>
            <div v-if="!editingContact">{{ contact.job_title }}</div>
            <InputText v-else v-model="contactEdit.job_title" class="w-full" />
          </td>
        </tr>
        <tr class="p-row-odd">
          <td class="md:font-medium">{{ t('consent') }}</td>
          <td>
            <div v-if="!editingContact">
              <div v-tooltip.bottom="getConsentTooltip(contact)">
                <Tag
                  class="font-normal"
                  :value="
                    getConsentLabel(
                      contact.consent_status ?? 'legitimate_interest',
                    )
                  "
                  :severity="
                    getConsentColor(
                      contact.consent_status ?? 'legitimate_interest',
                    )
                  "
                />
              </div>
            </div>
            <div v-else>
              <Select
                v-model="contactEdit.consent_status"
                :options="[
                  {
                    label: t('contact.consent.legitimate_interest'),
                    value: 'legitimate_interest',
                  },
                  { label: t('contact.consent.opt_out'), value: 'opt_out' },
                  { label: t('contact.consent.opt_in'), value: 'opt_in' },
                ]"
                option-label="label"
                option-value="value"
                :placeholder="$t('contact.undefined_consent')"
                class="w-full"
              />
            </div>
          </td>
        </tr>

        <template v-if="editingContact">
          <tr class="p-row-odd">
            <td class="md:font-medium">{{ $t('contact.same_as') }}</td>
            <td>
              <Textarea
                v-model="contactEdit.same_as"
                class="w-full"
                rows="3"
                :invalid="!isValidSameAs"
              />
            </td>
          </tr>

          <tr class="p-row-even">
            <td class="md:font-medium">{{ $t('contact.image') }}</td>
            <td>
              <InputText
                v-model="contactEdit.image"
                class="w-full"
                :invalid="!isValidAvatar"
              />
            </td>
          </tr>
        </template>
      </tbody>
    </table>

    <template #footer>
      <div class="flex flex-wrap gap-2 justify-between items-center w-full">
        <template v-if="!editingContact">
          <Button
            id="remove-contact"
            icon="pi pi-trash"
            :label="$screenStore.size.md ? $t('common.remove') : undefined"
            severity="danger"
            outlined
            @click="showRemoveConfirmationDialog = true"
          />
          <EnrichButton
            source="contact"
            :enrichment-realtime-callback="enrichmentRealtimeCallback"
            :enrichment-request-response-callback="() => {}"
            :contacts-to-enrich="[contact]"
            :enrich-all-contacts="false"
            :skip-dialog="skipDialog"
          />
          <Button
            :label="$screenStore.size.md ? $t('common.edit') : undefined"
            icon="pi pi-pencil"
            outlined
            @click="editContactInformations()"
          />
        </template>
        <template v-else>
          <Button
            :label="$t('common.cancel')"
            severity="secondary"
            @click="cancelContactInformations()"
          />
          <Button
            :label="$t('common.save')"
            @click="saveContactInformations()"
          />
        </template>
      </div>
    </template>
    <Dialog
      v-model:visible="showRemoveConfirmationDialog"
      modal
      :header="t('remove_contact_title')"
      :style="{ width: '25rem' }"
    >
      <span class="p-text-secondary block mb-5">
        {{
          t('remove_contact_detail', {
            name: contact.name || getContactIdentifier(contact) || contact.id,
          })
        }}
      </span>
      <div class="flex flex-row-reverse justify-content-start gap-2">
        <Button
          id="remove-contact-confirm"
          type="button"
          :label="$t('common.remove')"
          severity="danger"
          :loading="isRemovingContact"
          @click="removeContact"
        />
        <Button
          type="button"
          :label="$t('common.cancel')"
          severity="secondary"
          @click="showRemoveConfirmationDialog = false"
        />
      </div>
    </Dialog>
  </Drawer>
</template>
<script setup lang="ts">
import NormalizedLocation from '@/components/icons/NormalizedLocation.vue';
import SocialLinksAndPhones from '@/components/icons/SocialLinksAndPhones.vue';
import type { Contact, ContactEdit } from '@/types/contact';
import { getContactIdentifier } from '@/types/contact';
import { useContactsStore } from '~/stores/contacts';

import {
  getConsentColor,
  getConsentLabel,
  getStatusColor,
  getStatusLabel,
  getTagColor,
  getTagLabel,
  isValidURL,
  removeContactsFromDatabase,
  tags as predefinedTags,
} from '@/utils/contacts';
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import parsePhoneNumber from 'libphonenumber-js';
import { toRaw } from 'vue';
import { HandledError } from '~/plugins/error-handler';
import Normalizer from '~/utils/normalizer';
import { useContactVerification } from '~/composables/useContactVerification';

const ExportContacts = defineAsyncComponent(
  () => import('./buttons/ExportContacts.vue'),
);
const EnrichButton = defineAsyncComponent(
  () => import('./enrich/EnrichButton.vue'),
);

const { t } = useI18n({
  useScope: 'local',
});
const { t: $t } = useI18n({
  useScope: 'global',
});

const $toast = useToast();
const $user = useSupabaseUser();
const $leadminerStore = useLeadminerStore();
const $contactInformationSidebar = useMiningContactInformationSidebar();
const $screenStore = useScreenStore();
const $contactsStore = useContactsStore();

function getCurrentUserId() {
  return $user.value?.id || ($user.value as { sub?: string } | null)?.sub;
}

const show = defineModel<boolean>('show');

const contact = computed(() => $contactInformationSidebar.contact as Contact);
const hasEmail = computed(() => Boolean(contact.value?.email));
const refreshingStatus = ref(false);

async function refreshStatusBadge() {
  if (refreshingStatus.value || !contact.value.email) return;

  refreshingStatus.value = true;
  try {
    const { verifyEmailStatus } = useContactVerification();
    const result = await verifyEmailStatus(contact.value.email);
    contact.value.status = result.status as unknown as Contact['status'];
  } catch {
    $toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to refresh status',
    });
  } finally {
    refreshingStatus.value = false;
  }
}

const editingContact = ref(false);
const contactEditTags = ref<string[]>([]);
const filteredTagSuggestions = ref<string[]>([]);
const showRemoveConfirmationDialog = ref(false);
const tagAutoComplete = ref();
const pendingTagInput = ref('');

const allTags = computed(() => {
  if (!contact.value) return [];
  const autoTags = contact.value.tags ?? [];
  const userTags = contact.value.user_tags ?? [];
  return [...new Set([...autoTags, ...userTags])];
});

function searchTags(event: { query: string }) {
  const query = event.query.toLowerCase().trim();
  if (!query) {
    filteredTagSuggestions.value = [];
    return;
  }
  const matches = predefinedTags()
    .map((tag) => tag.label)
    .filter((label) => label.toLowerCase().includes(query));
  const exactMatch = matches.some((l) => l.toLowerCase() === query);
  filteredTagSuggestions.value = exactMatch
    ? matches
    : [event.query.trim(), ...matches];
}

function commitPendingTag() {
  const tag = pendingTagInput.value.trim();
  if (tag && !contactEditTags.value.includes(tag)) {
    contactEditTags.value = [...contactEditTags.value, tag];
  }
  pendingTagInput.value = '';
}

const isRemovingContact = ref(false);
const contactEdit = ref<ContactEdit>({
  email: '',
  name: null,
  given_name: null,
  family_name: null,
  alternate_name: '',
  telephone: '',
  same_as: '',
  location: '',
  works_for: null,
  job_title: null,
  image: null,
  tags: null,
});

watch(contact, (newContact) => {
  if (newContact) {
    contactEdit.value = {
      email: newContact.email,
      name: newContact.name,
      given_name: newContact.given_name,
      family_name: newContact.family_name,
      alternate_name: newContact.alternate_name?.join('\n') ?? null,
      telephone: newContact.telephone?.join('\n') ?? null,
      same_as: newContact.same_as?.join('\n') ?? null,
      location: newContact.location ?? null,
      works_for: newContact.works_for,
      job_title: newContact.job_title,
      image: newContact.image,
      tags: newContact.tags ?? null,
      consent_status: newContact.consent_status ?? 'legitimate_interest',
    };
    contactEditTags.value = newContact.user_tags
      ? [...newContact.user_tags]
      : [];
  }
});

const isExportDisabled = computed(() => $leadminerStore.loadingStatusDns);

const skipDialog = computed(
  () =>
    !contact.value ||
    !!(
      contact.value.given_name ||
      contact.value.family_name ||
      contact.value.alternate_name?.length ||
      contact.value.telephone?.length ||
      contact.value.location ||
      contact.value.works_for ||
      contact.value.job_title ||
      contact.value.same_as?.length ||
      contact.value.image
    ),
);

const isValidSameAs = computed(() => {
  if (!contactEdit.value?.same_as) return true;
  return (contactEdit.value?.same_as as string)
    ?.split('\n')
    .filter((item) => item.length)
    .every(isValidURL);
});

const isValidAvatar = computed(() => {
  if (!contactEdit.value?.image) return true;
  return isValidURL(contactEdit.value?.image as string);
});

let personsSubscription: RealtimeChannel;

// skipcq: JS-0321
const enrichmentRealtimeCallback = () => {};

function showNotification(
  severity: 'info' | 'warn' | 'error' | 'success' | 'secondary' | 'contrast',
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

function startRealtimePersons(userId: string, personId: string) {
  if (personsSubscription) {
    personsSubscription.unsubscribe();
  }
  personsSubscription = useSupabaseClient()
    .channel('persons-tracker')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'private',
        table: 'persons',
        filter: `user_id=eq.${userId}`,
      },
      async (payload: RealtimePostgresChangesPayload<Contact>) => {
        const updatedContact = payload.new as Contact;

        if (updatedContact.id !== personId) {
          return;
        }
        if (updatedContact.works_for) {
          updatedContact.works_for = await getOrganizationName(
            updatedContact.works_for,
          );
        }
        $contactInformationSidebar.contact = {
          ...$contactInformationSidebar.contact,
          ...updatedContact,
        };
      },
    );
  personsSubscription.subscribe();
}

watch(show, async (value) => {
  if (!contact.value) return;
  contact.value.works_for = await getOrganizationName(contact.value.works_for);
  const userId = getCurrentUserId();

  if (value && userId) {
    startRealtimePersons(userId, contact.value.id);
    return;
  }
  if (personsSubscription) {
    personsSubscription.unsubscribe();
  }
});

function onHide() {
  editingContact.value = false;
  $contactInformationSidebar.$reset();
}

function editContactInformations() {
  contactEditTags.value = contact.value.user_tags
    ? [...contact.value.user_tags]
    : [];
  editingContact.value = true;
}

function transformStringToArray(string: string | null): string[] | null {
  const array = string?.split('\n').filter((item) => item.length);
  return array?.length ? array : null;
}
function transformPhones() {
  return (
    transformStringToArray(contactEdit.value.telephone)?.map((phoneNumber) => {
      const parsedPhone = parsePhoneNumber(phoneNumber);
      if (!parsedPhone?.isValid()) {
        showNotification(
          'error',
          t('phone_invalid_summary'),
          t('phone_invalid_detail', { phoneNumber }),
        );
        throw new HandledError(`Invalid phone number: ${phoneNumber}`);
      }
      return parsedPhone.number;
    }) || null
  );
}

async function saveContactInformations() {
  if (!isValidSameAs.value || !isValidAvatar.value) {
    showNotification(
      'error',
      t('phone_invalid_summary'),
      t('phone_invalid_detail', { phoneNumber: '' }),
    );
    return;
  }
  commitPendingTag();

  const telephones = transformPhones();

  const originalContactCopy = contact.value;
  const editedContactCopy = {
    ...contact.value,
    ...contactEdit.value,
    same_as: transformStringToArray(contactEdit.value.same_as),
    alternate_name: transformStringToArray(contactEdit.value.alternate_name),
    telephone: telephones,
    location: contactEdit.value.location,
    consent_status: contactEdit.value.consent_status ?? undefined,
  } as Contact;

  const newLocation =
    originalContactCopy.location !== editedContactCopy.location
      ? editedContactCopy.location || null
      : undefined;

  let locationNormalized = originalContactCopy.location_normalized;
  if (newLocation) {
    locationNormalized = await Normalizer.normalizeLocation(newLocation);
  }

  const contactToUpdate: Partial<Contact> = {
    id: contact.value.id,
    email: editedContactCopy.email,
    alternate_name:
      JSON.stringify(originalContactCopy.alternate_name) !==
      JSON.stringify(editedContactCopy.alternate_name)
        ? editedContactCopy.alternate_name || null
        : undefined,
    telephone:
      JSON.stringify(originalContactCopy.telephone) !==
      JSON.stringify(editedContactCopy.telephone)
        ? editedContactCopy.telephone || null
        : undefined,
    same_as:
      JSON.stringify(originalContactCopy.same_as) !==
      JSON.stringify(editedContactCopy.same_as)
        ? editedContactCopy.same_as || null
        : undefined,
    name:
      originalContactCopy.name !== editedContactCopy.name
        ? editedContactCopy.name || null
        : undefined,
    given_name:
      originalContactCopy.given_name !== editedContactCopy.given_name
        ? editedContactCopy.given_name || null
        : undefined,
    family_name:
      originalContactCopy.family_name !== editedContactCopy.family_name
        ? editedContactCopy.family_name || null
        : undefined,
    location: newLocation,
    location_normalized: locationNormalized,
    works_for:
      originalContactCopy.works_for !== editedContactCopy.works_for
        ? editedContactCopy.works_for || null
        : undefined,
    job_title:
      originalContactCopy.job_title !== editedContactCopy.job_title
        ? editedContactCopy.job_title || null
        : undefined,
    image:
      originalContactCopy.image !== editedContactCopy.image
        ? editedContactCopy.image || null
        : undefined,
    user_tags:
      JSON.stringify(originalContactCopy.user_tags ?? []) !==
      JSON.stringify(contactEditTags.value)
        ? contactEditTags.value.length > 0
          ? contactEditTags.value
          : []
        : undefined,
    consent_status:
      originalContactCopy.consent_status !== contactEdit.value.consent_status
        ? (contactEdit.value.consent_status ?? 'legitimate_interest')
        : undefined,
  };
  const userId = getCurrentUserId();
  if (!userId) return;

  try {
    await updateContact(userId, contactToUpdate);
    if (contactToUpdate.user_tags !== undefined) {
      contact.value.user_tags = contactToUpdate.user_tags;
    }
    await $contactsStore.updateContactsCache(toRaw(contact.value), true);
    editingContact.value = false;
    showNotification('success', t('contact_saved'), '');
  } catch (error) {
    showNotification(
      'error',
      t('error_saving_contact'),
      (error as { message?: string }).message || t('unknown_error'),
    );
  }
}

function cancelContactInformations() {
  editingContact.value = false;
}

function copyContact(email: string, name?: string) {
  showNotification(
    'success',
    $t('contact.contact_copied'),
    $t('contact.contact_email_copied'),
  );
  navigator.clipboard.writeText(
    name && name !== '' ? `${name} <${email}>` : `<${email}>`,
  );
}

function getConsentTooltip(data: Contact) {
  if (!data.consent_changed_at) return undefined;

  const date = data.consent_changed_at.toLocaleString();

  if (data.consent_status === 'opt_out') {
    return t('consent_tooltip_opt_out', { date });
  }

  return t('consent_tooltip_default', { date });
}

async function removeContact() {
  isRemovingContact.value = true;
  try {
    await removeContactsFromDatabase([contact.value.id]);
    showRemoveConfirmationDialog.value = false;
    $contactInformationSidebar.$reset();
    showNotification('success', t('contact_removed'), '');
  } catch {
    showNotification('error', t('remove_contact_error'), '');
  } finally {
    isRemovingContact.value = false;
  }
}
</script>
<i18n lang="json">
{
  "en": {
    "copy": "Copy",
    "contact_copied": "Contact copied",
    "contact_email_copied": "This contact email address has been copied to your clipboard",
    "contact_saved": "Contact's informations saved",
    "url_invalid_summary": "Invalid URL",
    "url_invalid_detail": "Please enter a valid URL",
    "phone_invalid_summary": "Invalid phone number",
    "phone_invalid_detail": "Invalid phone number: {phoneNumber}",
    "consent": "Consent",
    "consent_tooltip_default": "Updated on {date}",
    "consent_tooltip_opt_out": "Opted out on {date}",
    "tags_placeholder": "Enter tags separated by commas",
    "remove_contact_title": "Remove Contact",
    "remove_contact_detail": "Are you sure you want to remove {name}?",
    "contact_removed": "Contact removed",
    "remove_contact_error": "Failed to remove contact",
    "error_saving_contact": "Error saving contact",
    "unknown_error": "An unknown error occurred"
  },
  "fr": {
    "copy": "Copier",
    "contact_copied": "Contact copié",
    "contact_email_copied": "L'adresse e-mail de ce contact a été copiée dans votre presse-papiers",
    "contact_saved": "Informations du contact enregistrées",
    "url_invalid_summary": "URL invalide",
    "url_invalid_detail": "Veuillez saisir une URL valide",
    "phone_invalid_summary": "Numéro de téléphone invalide",
    "phone_invalid_detail": "Numéro de téléphone invalide : {phoneNumber}",
    "consent": "Consentement",
    "consent_tooltip_default": "Mis à jour le {date}",
    "consent_tooltip_opt_out": "Désinscrit le {date}",
    "tags_placeholder": "Entrez des étiquettes séparées par des virgules",
    "remove_contact_title": "Supprimer le contact",
    "remove_contact_detail": "Êtes-vous sûr de vouloir supprimer {name} ?",
    "contact_removed": "Contact supprimé",
    "remove_contact_error": "Échec de la suppression du contact",
    "error_saving_contact": "Erreur lors de l'enregistrement du contact",
    "unknown_error": "Une erreur inconnue est survenue"
  }
}
</i18n>
