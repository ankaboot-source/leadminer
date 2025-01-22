<template>
  <Dialog
    ref="dialog"
    v-model:visible="visible"
    modal
    :closable="false"
    :header="'Before You Proceed: Enrich My Contacts'"
    pt:content:class="grow p-3 border-y border-slate-200 font-serif"
    pt:footer:class="p-3"
    :draggable="false"
    :pt:root:class="{ 'p-dialog-maximized': !$screenStore?.size?.md }"
    :style="{ width: '40vw', height: '70vh' }"
  >
    <div>
      By clicking "Enrich My Contacts", you acknowledge and agree to the
      following:
    </div>
    <ul class="my-3">
      <li class="mb-3">
        <div class="text-lg font-semibold">Purpose of Enrichment</div>
        <div>
          This service is intended to enrich information about your existing
          contacts. You must have a legitimate interest or have gathered their
          explicit consent to perform this enrichment for a specific and lawful
          purpose.
        </div>
      </li>
      <li class="mb-3">
        <div class="text-lg font-semibold">Third-Party Tools</div>
        <div>
          The enrichment process uses TheDig, Proxycurl, and VoilaNorbert.
          Results are cached securely for 90 days to improve efficiency and
          ensure data integrity.
        </div>
      </li>
      <li>
        <div class="text-lg font-semibold">Your Responsibilities:</div>
        <ul>
          <li>
            <Checkbox v-model="checked1" binary :invalid="!checked1" disabled />
            It is your responsibility to ensure compliance with applicable laws,
            including data protection regulations.
          </li>
          <li>
            <Checkbox v-model="checked2" binary :invalid="!checked2" disabled />
            You must inform your contacts about the use of this service and any
            data you enrich on their behalf.
          </li>
          <li>
            <Checkbox v-model="checked3" binary :invalid="!checked3" disabled />
            Your contacts holds their full rights including the rights to access
            and delete any informations about them.
          </li>
        </ul>
      </li>
    </ul>
    <div>
      By proceeding, you confirm that you have a legitimate interest or proper
      consent to enrich data on the selected contacts and accept your
      responsibility for compliance.
    </div>
    <template #footer>
      <Button severity="secondary" :label="'Cancel'" @click="closeModal" />
      <Button
        severity="secondary"
        class="text-center"
        :label="'Read the data privacy policy'"
        as="a"
        href="https://www.leadminer.io/data-privacy'"
        target="_blank"
        rel="noopener"
      />

      <Button
        class="border-solid border-2 border-black"
        :label="'Enrich My Contacts'"
        severity="contrast"
        @click="confirm"
      />
    </template>
  </Dialog>
</template>
<script setup lang="ts">
// const { t } = useI18n({
//   useScope: 'local',
// });
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
