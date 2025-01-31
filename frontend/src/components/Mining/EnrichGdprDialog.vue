<template>
  <Dialog
    ref="dialog"
    v-model:visible="visible"
    modal
    :closable="false"
    :header="t('beforeYouProceed')"
    pt:content:class="grow p-3 border-y border-slate-200 font-serif"
    pt:footer:class="p-3"
    :draggable="false"
    :pt:root:class="{ 'p-dialog-maximized': !$screenStore?.size?.md }"
    class="h-[70vh] 2xl:w-[40vw] w-[70vw]"
  >
    <div>
      {{ t('acknowledge') }}
    </div>
    <ul class="my-3">
      <li class="mb-3">
        <div class="text-lg font-semibold">
          {{ t('purposeOfEnrichment.title') }}
        </div>
        <div>
          {{ t('purposeOfEnrichment.content') }}
        </div>
      </li>
      <li class="mb-3">
        <div class="text-lg font-semibold">
          {{ t('thirdPartyTools.title') }}
        </div>
        <div>
          {{ t('thirdPartyTools.content') }}
        </div>
      </li>
      <li>
        <div class="text-lg font-semibold">
          {{ t('yourResponsibilities.title') }}
        </div>
        <ul>
          <li>
            <Checkbox v-model="checked1" binary :invalid="!checked1" disabled />
            {{ t('yourResponsibilities.content_1') }}
          </li>
          <li>
            <Checkbox v-model="checked2" binary :invalid="!checked2" disabled />
            {{ t('yourResponsibilities.content_2') }}
          </li>
          <li>
            <Checkbox v-model="checked3" binary :invalid="!checked3" disabled />
            {{ t('yourResponsibilities.content_3') }}
          </li>
        </ul>
      </li>
    </ul>
    <div>
      {{ t('proceedConfirmation') }}
    </div>
    <template #footer>
      <Button
        severity="secondary"
        :label="$t('common.cancel')"
        @click="closeModal"
      />
      <component :is="PrivacyPolicyButton" />
      <Button
        class="border-solid border-2 border-black"
        :label="t('enrichButton')"
        severity="contrast"
        @click="confirm"
      />
    </template>
  </Dialog>
</template>
<script setup lang="ts">
import { PrivacyPolicyButton } from '~/utils/extras';

const { t } = useI18n({
  useScope: 'local',
});
const $screenStore = useScreenStore();
const $profile = useSupabaseUserProfile();

const dialog = ref();
const visible = ref(false);
function openModal() {
  visible.value = true;
}
const emit = defineEmits(['hasGivenConsent']);

const checked1 = ref(true);
const checked2 = ref(true);
const checked3 = ref(true);

async function acceptEnriching() {
  const { error } = await useSupabaseClient()
    // @ts-expect-error: Issue with nuxt/supabase
    .schema('private')
    .from('profiles')
    .update({ gdpr_details: { hasAcceptedEnriching: true } })
    .eq('user_id', $profile.value?.user_id);

  if (error) {
    throw error;
  }
}

function closeModal() {
  visible.value = false;
}

async function confirm() {
  closeModal();
  await acceptEnriching();
  emit('hasGivenConsent');
}

defineExpose({ openModal });
</script>
<i18n lang="json">
{
  "en": {
    "beforeYouProceed": "Before You Proceed: Enrich My Contacts",
    "acknowledge": "By clicking \"Enrich My Contacts\", you acknowledge and agree to the following:",
    "purposeOfEnrichment": {
      "title": "Purpose of Enrichment",
      "content": "This service is intended to enrich information about your existing contacts. You must have a legitimate interest or have gathered their explicit consent to perform this enrichment for a specific and lawful purpose."
    },
    "thirdPartyTools": {
      "title": "Third-Party Tools",
      "content": "The enrichment process uses TheDig, Proxycurl, and VoilaNorbert. Results are cached securely for 90 days to improve efficiency and ensure data integrity."
    },
    "yourResponsibilities": {
      "title": "Your Responsibilities",
      "content_1": "It is your responsibility to ensure compliance with applicable laws, including data protection regulations.",
      "content_2": "You must inform your contacts about the use of this service and any data you enrich on their behalf.",
      "content_3": "Your contacts hold their full rights including the rights to access and delete any information about them."
    },
    "proceedConfirmation": "By proceeding, you confirm that you have a legitimate interest or proper consent to enrich data on the selected contacts and accept your responsibility for compliance.",
    "privacyPolicyButton": "Read the data privacy policy",
    "enrichButton": "Enrich My Contacts"
  },
  "fr": {
    "beforeYouProceed": "Avant de continuer : Enrichir mes contacts",
    "acknowledge": "En cliquant sur \"Enrichir mes contacts\", vous reconnaissez et acceptez les éléments suivants :",
    "purposeOfEnrichment": {
      "title": "Objectif de l'enrichissement",
      "content": "Ce service est destiné à enrichir les informations sur vos contacts existants. Vous devez avoir un intérêt légitime ou avoir obtenu leur consentement explicite pour effectuer cet enrichissement à des fins spécifiques et légales."
    },
    "thirdPartyTools": {
      "title": "Outils tiers",
      "content": "Le processus d'enrichissement utilise TheDig, Proxycurl et VoilaNorbert. Les résultats sont mis en cache en toute sécurité pendant 90 jours pour améliorer l'efficacité et garantir l'intégrité des données."
    },
    "yourResponsibilities": {
      "title": "Vos responsabilités",
      "content_1": "Il est de votre responsabilité de vous conformer aux lois applicables, y compris les réglementations sur la protection des données.",
      "content_2": "Vous devez informer vos contacts de l'utilisation de ce service et de toute donnée que vous enrichissez en leur nom.",
      "content_3": "Vos contacts conservent tous leurs droits, y compris les droits d'accès et de suppression de toute information les concernant."
    },
    "proceedConfirmation": "En continuant, vous confirmez que vous avez un intérêt légitime ou un consentement approprié pour enrichir les données des contacts sélectionnés et acceptez votre responsabilité en matière de conformité.",
    "privacyPolicyButton": "Lire la politique de confidentialité des données",
    "enrichButton": "Enrichir mes contacts"
  }
}
</i18n>
