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
        <Badge
          v-tooltip.top="getStatusLabel(contact.status)"
          class="min-w-5 h-5 mt-1"
          :severity="getStatusColor(contact.status)"
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
            :placeholder="$t('contact.name')"
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
              :to="same_as"
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
          <td class="font-medium">{{ $t('contact.family_name') }}</td>
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
            {{ $t('contact.alternate_names') }}
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
          <td class="font-medium">{{ $t('contact.address') }}</td>
          <td>
            <div v-if="!editingContact">{{ contact.address }}</div>
            <InputText v-else v-model="contactEdit.address" class="w-full" />
          </td>
        </tr>

        <tr class="p-row-even">
          <td class="font-medium">{{ $t('contact.works_for') }}</td>
          <td>
            <div v-if="!editingContact">{{ contact.works_for }}</div>
            <InputText v-else v-model="contactEdit.works_for" class="w-full" />
          </td>
        </tr>
        <tr class="p-row-odd">
          <td class="font-medium">{{ $t('contact.job_title') }}</td>
          <td>
            <div v-if="!editingContact">{{ contact.job_title }}</div>
            <InputText v-else v-model="contactEdit.job_title" class="w-full" />
          </td>
        </tr>

        <template v-if="editingContact">
          <tr class="p-row-even">
            <td class="font-medium">{{ $t('contact.same_as') }}</td>
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
            <td class="font-medium">{{ $t('contact.image') }}</td>
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
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  User,
} from '@supabase/supabase-js';

import type { Contact, ContactEdit } from '@/types/contact';

const { t } = useI18n({
  useScope: 'local',
});

type EnrichContactResponse = {
  taskId: string;
  userId?: string;
  webhookSecretToken?: string;
  total?: string;
  alreadyEnriched?: boolean;
};

const $toast = useToast();
const { $api } = useNuxtApp();
const $user = useSupabaseUser() as Ref<User>;

const $contactInformationSidebar = useMiningContactInformationSidebar();

const show = defineModel<boolean>('show');
const contact = computed(() => $contactInformationSidebar.contact as Contact);
const contactEdit = ref<ContactEdit>(contact.value);
const editingContact = ref(false);
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

let subscription: RealtimeChannel;

function showNotification(
  severity: 'info' | 'warn' | 'error' | 'success' | 'secondary' | 'contrast',
  summary: string,
  detail: string
) {
  $toast.add({
    severity,
    summary,
    detail,
    life: 3000,
  });
}

watch(show, (value) => {
  if (value) return;
  if (subscription) {
    subscription.unsubscribe();
  }
  loadButtonEnrich.value = false;
});

function startRealtimeEnrichementTask(userId: string, email: string) {
  if (subscription) {
    subscription.unsubscribe();
  }
  subscription = useSupabaseClient()
    .channel('enrichement-tracker')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'tasks',
        filter: `category=eq.${'enriching'}`,
      },
      (
        payload: RealtimePostgresChangesPayload<{
          status: 'running' | 'done' | 'canceled';
        }>
      ) => {
        const task = payload.new as { status: 'done' | 'canceled' };
        switch (task.status) {
          case 'done':
            loadButtonEnrich.value = false;
            showNotification(
              'success',
              t('notification.summary'),
              t('notification.enrichment_completed')
            );
            break;
          case 'canceled':
            loadButtonEnrich.value = false;
            showNotification(
              'error',
              t('notification.summary'),
              t('notification.enrichment_canceled')
            );
            break;
          default:
            break;
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'persons',
        filter: `user_id=eq.${userId}`,
      },
      (payload: RealtimePostgresChangesPayload<Contact>) => {
        const updatedContact = payload.new as Contact;
        if (updatedContact.email !== email) {
          return;
        }
        $contactInformationSidebar.contact = updatedContact;
      }
    );
  subscription.subscribe();
}

async function enrichContact(email: string) {
  loadButtonEnrich.value = true;
  try {
    startRealtimeEnrichementTask($user.value.id, email);
    const { alreadyEnriched } = await $api<EnrichContactResponse>(
      '/enrichement/enrichAsync',
      {
        method: 'POST',
        body: {
          emails: [email],
        },
      }
    );

    if (alreadyEnriched) {
      loadButtonEnrich.value = false;
      showNotification(
        'info',
        t('notification.summary'),
        t('notification.already_enriched')
      );
    }
  } catch (err) {
    loadButtonEnrich.value = false;
    throw err;
  }
}

function onHide() {
  editingContact.value = false;
  $contactInformationSidebar.$reset();
}

function editContactInformations() {
  contactEdit.value = JSON.parse(JSON.stringify(contact.value));
  contactEdit.value.alternate_names =
    contact.value?.alternate_names?.join('\n');
  contactEdit.value.same_as = contact.value?.same_as?.join('\n');
  editingContact.value = true;
}

async function saveContactInformations() {
  const user = $user.value as User;

  if (!isValidSameAs.value || !isValidAvatar.value) {
    showNotification(
      'error',
      t('url_invalid_summary'),
      t('url_invalid_detail')
    );
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
  showNotification('success', t('contact_saved'), '');
}

function cancelContactInformations() {
  editingContact.value = false;
}

function copyContact(email: string, name?: string) {
  showNotification('success', t('contact_copied'), t('contact_email_copied'));
  navigator.clipboard.writeText(
    name && name !== '' ? `${name} <${email}>` : `<${email}>`
  );
}
</script>
<i18n lang="json">
{
  "en": {
    "notification": {
      "summary": "Enrich Contact",
      "enrichment_completed": "Your contact has been successfully enriched.",
      "enrichment_canceled": "Your contact enrichment has been canceled.",
      "already_enriched": "This contact is already enriched."
    },
    "contact": {
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
    },
    "copy": "Copy",
    "contact_copied": "Contact copied",
    "contact_email_copied": "This contact email address has been copied to your clipboard",
    "contact_saved": "Contact's informations saved",
    "url_invalid_summary": "Invalid URL",
    "url_invalid_detail": "Please enter a valid URL"
  },
  "fr": {
    "notification": {
      "summary": "Enrichir le Contact",
      "enrichment_completed": "Votre contact a été enrichi avec succès.",
      "enrichment_canceled": "L'enrichissement de votre contact a été annulé.",
      "already_enriched": "Ce contact est déjà enrichi."
    },
    "contact": {
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
    },
    "copy": "Copier",
    "contact_copied": "Contact copié",
    "contact_email_copied": "L'adresse e-mail de ce contact a été copiée dans votre presse-papiers",
    "contact_saved": "Informations du contact enregistrées",
    "url_invalid_summary": "URL invalide",
    "url_invalid_detail": "Veuillez saisir une URL valide"
  }
}
</i18n>
