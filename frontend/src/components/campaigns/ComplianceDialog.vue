<template>
  <Dialog v-model:visible="showModal" modal :header="t('consent_required')">
    <p class="m-0">
      {{ t('consent_message', { available, total }) }}
    </p>
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button
          :label="t('privacy_policy')"
          link
          @click="openPrivacyPolicy"
        />
        <Button
          :label="t('cancel')"
          severity="secondary"
          @click="closeModal"
        />
        <Button
          :label="t('continue_with_available', { count: available })"
          severity="contrast"
          @click="confirmPartial"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
const { t } = useI18n({
  useScope: "local",
});

const emit = defineEmits<{
  "confirm-partial": [];
}>();

const showModal = ref(false);
const total = ref(0);
const available = ref(0);

const openModal = (totalCount: number, availableCount: number) => {
  total.value = totalCount;
  available.value = availableCount;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
};

const openPrivacyPolicy = () => {
  window.open("/privacy-policy", "_blank");
};

const confirmPartial = () => {
  emit("confirm-partial");
  closeModal();
};

defineExpose({
  openModal,
  closeModal,
});
</script>

<i18n lang="json">
{
  "en": {
    "consent_required": "Consent Required",
    "consent_message": "Only {available} of {total} contacts have given consent to be contacted.",
    "privacy_policy": "Privacy Policy",
    "cancel": "Cancel",
    "continue_with_available": "Continue with {count} contacts"
  },
  "fr": {
    "consent_required": "Consentement Requis",
    "consent_message": "Seulement {available} sur {total} contacts ont donné leur consentement.",
    "privacy_policy": "Politique de Confidentialité",
    "cancel": "Annuler",
    "continue_with_available": "Continuer avec {count} contacts"
  }
}
</i18n>
