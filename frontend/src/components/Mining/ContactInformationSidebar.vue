<template>
  <Sidebar
    v-model:visible="show"
    position="right"
    pt:root:class="md:w-1/2 xl:w-1/3 w-full"
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
            {{ t('contactI18n.given_name') }}
          </td>
          <td>
            <div v-if="!editingContact">
              {{ contact.given_name }}
            </div>
            <InputText v-else v-model="contactEdit.given_name" class="w-full" />
          </td>
        </tr>
        <tr class="p-row-odd">
          <td class="font-medium">{{ t('contactI18n.family_name') }}</td>
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
            {{ t('contactI18n.alternate_names') }}
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
          <td class="font-medium">{{ t('contactI18n.address') }}</td>
          <td>
            <div v-if="!editingContact">{{ contact.address }}</div>
            <InputText v-else v-model="contactEdit.address" class="w-full" />
          </td>
        </tr>

        <tr class="p-row-even">
          <td class="font-medium">{{ t('contactI18n.works_for') }}</td>
          <td>
            <div v-if="!editingContact">{{ contact.works_for }}</div>
            <InputText v-else v-model="contactEdit.works_for" class="w-full" />
          </td>
        </tr>
        <tr class="p-row-odd">
          <td class="font-medium">{{ t('contactI18n.job_title') }}</td>
          <td>
            <div v-if="!editingContact">{{ contact.job_title }}</div>
            <InputText v-else v-model="contactEdit.job_title" class="w-full" />
          </td>
        </tr>

        <template v-if="editingContact">
          <tr class="p-row-even">
            <td class="font-medium">{{ t('contactI18n.same_as') }}</td>
            <td>
              <Textarea
                v-model="(contactEdit.same_as as string)"
                class="w-full"
                rows="3"
              />
            </td>
          </tr>

          <tr class="p-row-odd">
            <td class="font-medium">{{ t('contactI18n.image') }}</td>
            <td>
              <InputText v-model="contactEdit.image" class="w-full" />
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
import { updateContact } from '~/utils/contacts';

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

async function saveContactInformations() {
  editingContact.value = false;
  const user = $user.value as User;

  await updateContact(user.id, contactEdit.value);
  $toast.add({
    severity: 'success',
    summary: "Contact's informations saved",
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
    "contactI18n": {
      "name": "Full name",
      "given_name": "Given Name",
      "family_name": "Family Name",
      "alternate_names": "Alternate Names",
      "address": "Location",
      "works_for": "Works For",
      "job_title": "Job Title",
      "same_as": "Same As",
      "image": "Avatar URL",
      "given_name_definition": "The given name of this contact",
      "family_name_definition": "The family name of this contact",
      "alternate_names_definition": "Other names this contact goes by",
      "address_definition": "The location of this contact",
      "works_for_definition": "Organization this contact works for",
      "job_title_definition": "The job title of this contact"
    }
  },
  "fr": {
    "enrich_contact": "Enrichir le contact",
    "contact_enriched": "Votre contact a été enrichi avec succès.",
    "contact_already_exists": "La fiche contact est déjà enrichie",
    "contactI18n": {
      "name": "Nom complet",
      "given_name": "Prénom",
      "family_name": "Nom de famille",
      "alternate_names": "Autres noms",
      "address": "Adresse",
      "works_for": "Travaille pour",
      "job_title": "Titre du poste",
      "same_as": "Même que",
      "image": "URL de l'avatar",
      "given_name_definition": "Le prénom de ce contact",
      "family_name_definition": "Le nom de famille de ce contact",
      "alternate_names_definition": "Autres noms par lesquels ce contact est connu",
      "address_definition": "L'emplacement de ce contact",
      "works_for_definition": "Organisation pour laquelle ce contact travaille",
      "job_title_definition": "Le titre du poste de ce contact"
    }
  }
}
</i18n>
