<template>
  <Drawer
    v-model:visible="show"
    position="right"
    class="w-full md:w-1/2 xl:w-1/3"
    @hide="() => onHide()"
  >
    <template #header><span class="grow" /> </template>
    <div class="px-4">
      <div class="flex items-center gap-2 w-full">
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
            <div class="flex gap-1">
              <div class="max-lg:grow gap-2 flex items-center truncate">
                <Badge
                  v-tooltip.top="getStatusLabel(contact.status)"
                  class="min-w-4 h-4 flex-none"
                  :severity="getStatusColor(contact.status)"
                />
                <div class="truncate">
                  {{ contact.email }}
                </div>
              </div>
              <Button
                v-if="!editingContact"
                rounded
                text
                icon="pi pi-copy"
                size="large"
                class="text-2xl flex-none -ml-2"
                :aria-label="t('copy')"
                @click="copyContact(contact.email, contact.name ?? undefined)"
              />
            </div>
          </div>
          <div
            v-if="contact.same_as?.length && !editingContact"
            class="flex gap-2 grow"
          >
            <social-link :social-links="contact.same_as" :small="false" />
          </div>
          <div v-if="contact.tags?.length" class="flex pt-1 space-x-2">
            <Tag
              v-for="(tag, index) in contact.tags"
              :key="index"
              :value="getTagLabel(tag)"
              :severity="getTagColor(tag)"
            />
          </div>
        </div>
      </div>
    </div>
    <table
      class="p-datatable p-datatable-striped w-full"
      style="display: table"
    >
      <tbody class="p-datatable-tbody">
        <tr class="p-row-even">
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
            {{ $t('contact.alternate_names') }}
          </td>
          <td>
            <div v-if="!editingContact">
              {{ contact.alternate_names?.join(', ') }}
            </div>
            <Textarea
              v-else
              v-model="contactEdit.alternate_names"
              rows="3"
              class="w-full"
            />
          </td>
        </tr>

        <tr class="p-row-odd">
          <td class="md:font-medium">{{ $t('contact.location') }}</td>
          <td>
            <div v-if="!editingContact">
              {{ contact.location?.join(', ') }}
            </div>
            <Textarea
              v-else
              v-model="contactEdit.location"
              rows="3"
              class="w-full"
            />
          </td>
        </tr>

        <tr class="p-row-even">
          <td class="md:font-medium">{{ $t('contact.works_for') }}</td>
          <td>
            <div v-if="!editingContact">{{ contact.works_for }}</div>
            <InputText v-else v-model="contactEdit.works_for" class="w-full" />
          </td>
        </tr>
        <tr class="p-row-odd">
          <td class="md:font-medium">{{ $t('contact.job_title') }}</td>
          <td>
            <div v-if="!editingContact">{{ contact.job_title }}</div>
            <InputText v-else v-model="contactEdit.job_title" class="w-full" />
          </td>
        </tr>

        <template v-if="editingContact">
          <tr class="p-row-even">
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

          <tr class="p-row-odd">
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

    <div className="grid grid-cols-2 gap-2 items-center pt-4">
      <template v-if="!editingContact">
        <EnrichButton
          source="contact"
          :enrichment-realtime-callback="enrichmentRealtimeCallback"
          :enrichment-request-response-callback="() => {}"
          :contacts-to-enrich="[contact]"
          :enrich-all-contacts="false"
          :skip-dialog="skipDialog"
        />
        <Button
          icon-pos="right"
          icon="pi pi-pen-to-square"
          :label="$t('common.edit')"
          @click="editContactInformations()"
        />
      </template>
      <template v-else>
        <Button
          :label="$t('common.cancel')"
          severity="secondary"
          @click="cancelContactInformations()"
        />
        <Button :label="$t('common.save')" @click="saveContactInformations()" />
      </template>
    </div>
  </Drawer>
</template>

<script setup lang="ts">
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  User,
} from '@supabase/supabase-js';

import SocialLink from '@/components/icons/SocialLink.vue';
import EnrichButton from '@/components/Mining/Buttons/EnrichButton.vue';
import type { Contact, ContactEdit } from '@/types/contact';
import {
  getOrganization,
  getStatusColor,
  getStatusLabel,
  getTagColor,
  getTagLabel,
} from '@/utils/contacts';

const { t } = useI18n({
  useScope: 'local',
});

const $toast = useToast();
const $user = useSupabaseUser() as Ref<User>;
const $contactInformationSidebar = useMiningContactInformationSidebar();

const show = defineModel<boolean>('show');

const contact = computed(() => $contactInformationSidebar.contact as Contact);
const editingContact = ref(false);
const contactEdit = ref<ContactEdit>({
  ...contact.value,
  alternate_names: contact.value?.alternate_names?.join('\n') ?? null,
  same_as: contact.value?.same_as?.join('\n') ?? null,
  location: contact.value?.location?.join('\n') ?? null,
});

watch(contact, (newContact) => {
  contactEdit.value = {
    ...newContact,
    alternate_names: newContact?.alternate_names?.join('\n') ?? null,
    same_as: newContact?.same_as?.join('\n') ?? null,
    location: newContact?.location?.join('\n') ?? null,
  };
});

const skipDialog = computed(
  () =>
    !(
      contact.value.given_name ||
      contact.value.family_name ||
      contact.value.alternate_names ||
      contact.value.location ||
      contact.value.works_for ||
      contact.value.job_title ||
      contact.value.same_as ||
      contact.value.image
    ),
);

function isValidURL(url: string) {
  try {
    // skipcq: JS-R1002 - instantiating unused object as the url validity checker
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
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

function startRealtimePersons(userId: string, email: string) {
  if (personsSubscription) {
    personsSubscription.unsubscribe();
  }
  personsSubscription = useSupabaseClient()
    .channel('persons-tracker')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'persons',
        filter: `user_id=eq.${userId}`,
      },
      async (payload: RealtimePostgresChangesPayload<Contact>) => {
        const updatedContact = payload.new as Contact;

        if (updatedContact.email !== email) {
          return;
        }
        if (updatedContact.works_for) {
          const org = await getOrganization({ id: updatedContact.works_for }, [
            'name',
          ]);
          updatedContact.works_for = org ? org.name : updatedContact.works_for;
        }
        $contactInformationSidebar.contact = {
          ...$contactInformationSidebar.contact,
          ...updatedContact,
        };
      },
    );
  personsSubscription.subscribe();
}

watch(show, (value) => {
  if (value) {
    startRealtimePersons($user.value.id, contact.value.email);
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
  editingContact.value = true;
}

async function saveContactInformations() {
  if (!isValidSameAs.value || !isValidAvatar.value) {
    showNotification(
      'error',
      t('url_invalid_summary'),
      t('url_invalid_detail'),
    );
    return;
  }

  function transformStringToArray(string: string | null): string[] | null {
    const array = string?.split('\n').filter((item) => item.length);
    return array?.length ? array : null;
  }

  const originalContactCopy = contact.value;
  const editedContactCopy: Contact = {
    ...contact.value,
    ...contactEdit.value,
    same_as: transformStringToArray(contactEdit.value.same_as),
    alternate_names: transformStringToArray(contactEdit.value.alternate_names),
    location: transformStringToArray(contactEdit.value.location),
  };

  const contactToUpdate: Partial<Contact> = {
    email: editedContactCopy.email,
    alternate_names:
      JSON.stringify(originalContactCopy.alternate_names) !==
      JSON.stringify(editedContactCopy.alternate_names)
        ? editedContactCopy.alternate_names || null
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
    location:
      JSON.stringify(originalContactCopy.location) !==
      JSON.stringify(editedContactCopy.location)
        ? editedContactCopy.location || null
        : undefined,
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
  };
  await updateContact($user.value.id, contactToUpdate);
  editingContact.value = false;
  showNotification('success', t('contact_saved'), '');
}

function cancelContactInformations() {
  editingContact.value = false;
}

function copyContact(email: string, name?: string) {
  showNotification('success', t('contact_copied'), t('contact_email_copied'));
  navigator.clipboard.writeText(
    name && name !== '' ? `${name} <${email}>` : `<${email}>`,
  );
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
    "url_invalid_detail": "Please enter a valid URL"
  },
  "fr": {
    "copy": "Copier",
    "contact_copied": "Contact copié",
    "contact_email_copied": "L'adresse e-mail de ce contact a été copiée dans votre presse-papiers",
    "contact_saved": "Informations du contact enregistrées",
    "url_invalid_summary": "URL invalide",
    "url_invalid_detail": "Veuillez saisir une URL valide"
  }
}
</i18n>
