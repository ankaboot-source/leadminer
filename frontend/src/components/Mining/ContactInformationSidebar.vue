<template>
  <Sidebar
    v-model:visible="show"
    position="right"
    pt:root:class="md:w-1/2 xl:w-1/3 w-full"
    @hide="() => onHide()"
  >
    <template #header><span class="grow" /> </template>
    <div class="p-sidebar-header px-4 pt-0">
      <div class="flex items-center gap-2 grow w-full">
        <img
          v-if="contact.image && !editingContact"
          :src="contact.image"
          class="size-20 rounded-full"
        />
        <span class="w-full">
          <div
            v-if="contact.name && !editingContact"
            class="font-medium text-2xl"
          >
            {{ contact.name }}
          </div>
          <InputText
            v-if="editingContact"
            v-model="contactEdit.name"
            :placeholder="$t('contactI18n.name')"
            class="w-full grow mb-2"
            size="large"
          />
          <div
            :class="{
              'font-medium': editingContact,
              'font-medium text-2xl': !contact.name && !editingContact,
            }"
          >
            {{ contact.email }}
          </div>
          <div
            v-if="contact.same_as?.length && !editingContact"
            class="flex gap-2 grow pt-1"
          >
            <NuxtLink
              v-for="(same_as, index) in contact.same_as"
              :key="index"
              target="_blank"
              rel="noopener"
            >
              <i
                :class="`pi pi-${$contactInformationSidebar.getSameAsIcon(
                  same_as
                )}`"
                class="text-xl"
              />
            </NuxtLink>
          </div>
        </span>
      </div>
      <span class="grow" />
      <Button
        v-if="!editingContact"
        rounded
        text
        icon="pi pi-copy"
        size="large"
        class="text-2xl"
        :aria-label="t('copy')"
        @click="copyContact(contact.email, contact.name)"
      />
    </div>
    <table
      class="p-datatable p-datatable-striped w-full"
      style="display: table"
    >
      <tbody class="p-datatable-tbody">
        <tr class="p-row-even">
          <td class="font-medium w-4/12">
            {{ $t('contactI18n.given_name') }}
          </td>
          <td>
            <div v-if="!editingContact">
              {{ contact.given_name }}
            </div>
            <InputText v-else v-model="contactEdit.given_name" class="w-full" />
          </td>
        </tr>
        <tr class="p-row-odd">
          <td class="font-medium">{{ $t('contactI18n.family_name') }}</td>
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
          <td class="font-medium">
            {{ $t('contactI18n.alternate_names') }}
          </td>
          <td>
            <div v-if="!editingContact">
              {{ contact.alternate_names?.join(', ') }}
            </div>
            <Textarea
              v-else
              v-model="(contactEdit.alternate_names as string)"
              rows="3"
              class="w-full"
            />
          </td>
        </tr>

        <tr class="p-row-odd">
          <td class="font-medium">{{ $t('contactI18n.address') }}</td>
          <td>
            <div v-if="!editingContact">{{ contact.address }}</div>
            <InputText v-else v-model="contactEdit.address" class="w-full" />
          </td>
        </tr>

        <tr class="p-row-even">
          <td class="font-medium">{{ $t('contactI18n.works_for') }}</td>
          <td>
            <div v-if="!editingContact">{{ contact.works_for }}</div>
            <InputText v-else v-model="contactEdit.works_for" class="w-full" />
          </td>
        </tr>
        <tr class="p-row-odd">
          <td class="font-medium">{{ $t('contactI18n.job_title') }}</td>
          <td>
            <div v-if="!editingContact">{{ contact.job_title }}</div>
            <InputText v-else v-model="contactEdit.job_title" class="w-full" />
          </td>
        </tr>

        <template v-if="editingContact">
          <tr class="p-row-even">
            <td class="font-medium">{{ $t('contactI18n.same_as') }}</td>
            <td>
              <Textarea
                v-model="(contactEdit.same_as as string)"
                class="w-full"
                rows="3"
                :invalid="!isValidSameAs"
              />
            </td>
          </tr>

          <tr class="p-row-odd">
            <td class="font-medium">{{ $t('contactI18n.image') }}</td>
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
        <Button
          label="Enrich"
          severity="contrast"
          icon-pos="right"
          :loading="loadButtonEnrich"
          @click="enrichContact(contact.email)"
        >
          <template #icon
            ><span class="p-button-icon p-button-icon-right">💎</span>
          </template>
        </Button>
        <Button
          icon-pos="right"
          icon="pi pi-pen-to-square"
          :label="t('Edit')"
          @click="editContactInformations()"
        />
      </template>
      <template v-else>
        <Button
          label="Cancel"
          severity="secondary"
          @click="cancelContactInformations()"
        />
        <Button label="Save" @click="saveContactInformations()" />
      </template>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import type { RealtimeChannel, User } from '@supabase/supabase-js';

import type { Contact, ContactEdit } from '@/types/contact';
import { useContactsStore } from '~/stores/contacts';

const $toast = useToast();
const { $api } = useNuxtApp();
const $contactInformationSidebar = useMiningContactInformationSidebar();

const { t } = useI18n({
  useScope: 'local',
});

let subscription: RealtimeChannel;
const $contactStore = useContactsStore();

const show = defineModel<boolean>('show');
const contact = computed(() => $contactInformationSidebar.contact as Contact);
const contactEdit = ref<ContactEdit>(contact.value);
const editingContact = ref(false);

const $user = useSupabaseUser();

const loadButtonEnrich = ref(false);
function isValidURL(url: string) {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
    return true;
  } catch (_) {
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

async function saveContactInformations() {
  const user = $user.value as User;

  if (!isValidSameAs.value || !isValidAvatar.value) {
    $toast.add({
      severity: 'error',
      summary: t('url_invalid_summary'),
      detail: t('url_invalid_detail'),
      life: 3000,
    });
    return;
  }

  const contactCleaned = {
    email: contactEdit.value.email,
    given_name: contactEdit.value.given_name || undefined,
    family_name: contactEdit.value.family_name || undefined,
    alternate_names: contactEdit.value.alternate_names
      ? (contactEdit.value?.alternate_names as string)
          ?.split('\n')
          .filter((item) => item.length)
      : undefined,
    address: contactEdit.value.address || undefined,
    works_for: contactEdit.value.works_for || undefined,
    job_title: contactEdit.value.job_title || undefined,
    same_as: contactEdit.value.same_as
      ? (contactEdit.value.same_as as string)
          ?.split('\n')
          .filter((item) => item.length)
      : undefined,
    image: contactEdit.value.image || undefined,
  };

  await updateContact(user.id, contactCleaned);
  editingContact.value = false;
  $toast.add({
    severity: 'success',
    summary: t('contact_saved'),
    life: 3000,
  });
}

function editContactInformations() {
  contactEdit.value = JSON.parse(JSON.stringify(contact.value));
  contactEdit.value.alternate_names =
    contact.value?.alternate_names?.join('\n');
  contactEdit.value.same_as = contact.value?.same_as?.join('\n');
  editingContact.value = true;
}

function cancelContactInformations() {
  editingContact.value = false;
}

function copyContact(email: string, name?: string) {
  $toast.add({
    severity: 'success',
    summary: t('contact_copied'),
    detail: t('contact_email_copied'),
    life: 3000,
  });
  navigator.clipboard.writeText(
    name && name !== '' ? `${name} <${email}>` : `<${email}>`
  );
}

function onHide() {
  editingContact.value = false;
  $contactInformationSidebar.$reset();
}

async function enrichContact(email: string) {
  loadButtonEnrich.value = true;
  $contactStore.subscribeRealtime($user.value!);
  setTimeout(() => {
    $contactStore.unsubscribeRealtime();
  }, 10000);

  const response = await $api<{
    taskId: string;
    userId?: string;
    webhookSecretToken?: string;
    total?: string;
    alreadyEnriched?: boolean;
  }>('/enrichement/enrichAsync', {
    method: 'POST',
    body: {
      emails: [email],
    },
  });

  if (response.alreadyEnriched) {
    loadButtonEnrich.value = false;
    $toast.add({
      severity: 'success',
      summary: t('enrich_contact'),
      detail: t('contact_already_exists'),
      life: 3000,
    });
  } else {
    $toast.add({
      severity: 'success',
      summary: t('enrich_contact'),
      detail: t('contact_enriched'),
      life: 3000,
    });
    // subscription = useSupabaseClient()
    //   .channel('enrichement-tracker')
    //   .on(
    //     'postgres_changes',
    //     {
    //       event: '*',
    //       schema: 'public',
    //       table: 'tasks',
    //       filter: `id=eq.${response.taskId}`,
    //     },
    //     (payload: RealtimePostgresChangesPayload<any>) => {
    //       loadButtonEnrich.value = false
    //       $toast.add({
    //         severity: 'success',
    //         summary: t('enrich_contact'),
    //         detail: t('contact_enriched'),
    //         life: 3000,
    //       });
    //       subscription.unsubscribe()
    //     }
    //   );
    // subscription.subscribe()
  }
}

onUnmounted(() => {
  loadButtonEnrich.value = false;
  subscription.unsubscribe();
});
</script>

<i18n lang="json">
{
  "en": {
    "enrich_contact": "Enrich contact",
    "contact_enriched": "You're contact is succufully enriched.",
    "contact_already_exists": "This contact is already enriched.",
    "copy": "Copy",
    "contact_copied": "Contact copied",
    "contact_email_copied": "This contact email address has been copied to your clipboard",
    "contact_saved": "Contact's informations saved",
    "url_invalid_summary": "Invalid URL",
    "url_invalid_detail": "Please enter a valid URL"
  },
  "fr": {
    "enrich_contact": "Enrichir le contact",
    "contact_enriched": "Votre contact a été enrichi avec succès.",
    "contact_already_exists": "La fiche contact est déjà enrichie",
    "copy": "Copier",
    "contact_copied": "Contact copié",
    "contact_email_copied": "L'adresse e-mail de ce contact a été copiée dans votre presse-papiers",
    "contact_saved": "Informations du contact enregistrées",
    "url_invalid_summary": "URL invalide",
    "url_invalid_detail": "Veuillez saisir une URL valide"
  }
}
</i18n>
