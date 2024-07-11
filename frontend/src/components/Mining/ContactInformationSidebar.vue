<template>
  <Sidebar v-model:visible="show" position="right" pt:root:class="w-1/3">
    <template #header><span class="grow" /> </template>
    <div class="p-sidebar-header px-4 pt-0">
      <div class="flex items-center gap-2 grow w-full">
        <img
          v-if="contact.image && !editingContact"
          :src="contact.image"
          class="size-20"
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
            class="w-full grow"
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
    <table class="p-datatable p-datatable-striped table">
      <tbody class="p-datatable-tbody">
        <tr class="p-row-even">
          <td class="font-medium w-3/12">{{ t('contactI18n.given_name') }}</td>
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
          <td class="font-medium">{{ t('contactI18n.alternate_names') }}</td>
          <td>
            <div v-if="!editingContact">
              {{ contact.alternate_names?.join(', ') }}
            </div>
            <Textarea
              v-else
              v-model="contactEdit.alternate_names as string"
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
                v-model="contactEdit.same_as as string"
                class="w-full"
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
        <Button label="Enrich" severity="contrast" icon-pos="right">
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
import type { Contact, ContactEdit } from '@/types/contact';

const $contactInformationSidebar = useMiningContactInformationSidebar();

const { t } = useI18n({
  useScope: 'local',
});

const $toast = useToast();

const show = defineModel<boolean>('show');
const contact = computed(() => $contactInformationSidebar.contact as Contact);
const contactEdit = ref<ContactEdit>(contact.value);
const editingContact = ref(false);

function saveContactInformations() {
  console.log(contactEdit);
  editingContact.value = false;
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
  console.log({
    contact: contact.value,
  });
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
</script>
