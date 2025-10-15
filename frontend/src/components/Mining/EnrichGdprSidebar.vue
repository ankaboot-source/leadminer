<template>
  <Drawer
    ref="drawer"
    v-model:visible="visible"
    class="h-auto"
    :position="$screenStore.size.sm ? 'top' : 'full'"
    :dismissable="false"
    :show-close-icon="false"
    :block-scroll="true"
    :header="t('acknowledge')"
    pt:title:class="font-bold"
    pt:footer:class="pt-0 flex justify-end gap-2"
    pt:content:class="grid gap-4 px-8 text-base"
  >
    <ul>
      <li class="mb-3">
        <div>
          {{ t('purposeOfEnrichment') }}
          {{ t('thirdPartyTools') }}
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
    <template #footer>
      <Button
        severity="secondary"
        :label="$t('common.cancel')"
        @click="closeModal"
      />
      <component :is="PrivacyPolicyButton" />
      <Button
        class="border-solid border-2 border-black"
        :label="t(`${$screenStore.size.sm ? '' : 'mobile.'}enrichButton`)"
        severity="contrast"
        @click="confirm"
      />
    </template>
  </Drawer>
</template>

<script setup lang="ts">
import { PrivacyPolicyButton } from '~/utils/extras';

const { t } = useI18n({
  useScope: 'local',
});
const $screenStore = useScreenStore();
const $profile = useSupabaseUserProfile();

const drawer = ref();
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
    "acknowledge": "By clicking \"Enrich My Contacts\", you agree that:",
    "purposeOfEnrichment": "This service is intended to enrich information about your existing contacts.",
    "thirdPartyTools": "The enrichment process uses TheDig, EnrichLayer, and VoilaNorbert. Results are cached securely for 90 days to improve efficiency and ensure data integrity.",
    "yourResponsibilities": {
      "title": "Your Responsibilities",
      "content_1": "You must have a legitimate interest or have obtained explicit consent from your contacts to perform this enrichment for specific and legal purposes.",
      "content_2": "You must inform your contacts about the use of this service and any data you enrich on their behalf.",
      "content_3": "Your contacts hold their full rights including the rights to access and delete any information about them."
    },
    "enrichButton": "Enrich My Contacts",
    "mobile": {
      "enrichButton": "Enrich"
    }
  },
  "fr": {
    "acknowledge": "En cliquant sur \"Enrichir mes contacts\", vous acceptez que :",
    "purposeOfEnrichment": "Ce service est destiné à enrichir les informations sur vos contacts existants.",
    "thirdPartyTools": "Le processus d'enrichissement utilise TheDig, EnrichLayer et VoilaNorbert. Les résultats sont mis en cache en toute sécurité pendant 90 jours pour améliorer l'efficacité et garantir l'intégrité des données.",
    "yourResponsibilities": {
      "title": "Vos responsabilités",
      "content_1": "Vous devez avoir un intérêt légitime ou avoir obtenu le consentement explicite de vos contacts pour effectuer cet enrichissement à des fins spécifiques et légales.",
      "content_2": "Vous devez informer vos contacts de l'utilisation de ce service et de toute donnée que vous enrichissez en leur nom.",
      "content_3": "Vos contacts conservent tous leurs droits, y compris les droits d'accès et de suppression de toute information les concernant."
    },
    "enrichButton": "Enrichir mes contacts",
    "mobile": {
      "enrichButton": "Enrichir"
    }
  }
}
</i18n>
