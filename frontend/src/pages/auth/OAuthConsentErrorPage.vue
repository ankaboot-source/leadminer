<template>
  <AppLayout class="q-px-lg">
    <div class="q-mt-s">
      <h1 class="text-h3 merriweather">Authorization Required 🔒</h1>

      <p class="text-h5 text-weight-regular">
        We apologize for the inconvenience. It seems like you have declined to
        grant authorization for us to access your
        <span v-if="provider === 'google'">Google</span>
        <span v-else-if="provider === 'azure'">Outlook</span>
        <span v-else>Google or Outlook</span> mailbox. Without authorization, we
        are unable to extract, clean, and enrich contacts from your mailbox.
      </p>

      <q-card class="bg-green-1" flat square>
        <q-card-section horizontal class="flex-center">
          <q-card-section class="q-pr-none">
            <q-icon size="5em" name="img:icons/gdpr.png" />
          </q-card-section>

          <q-card-section>
            <div class="text-h6 font-weight-medium">
              Your data is yours only
            </div>
            <div class="text-weight-regular merriweather">
              We assure you that we will not use your data commercially or share
              it with any third parties without your explicit permission. Please
              be assured that your data will be handled securely and used solely
              for the purposes of providing you with the best lead generation
              experience in full compliance with the GDPR.
            </div>
          </q-card-section>
        </q-card-section>
      </q-card>

      <div class="q-mt-md">
        <a
          href="https://www.leadminer.io/data-privacy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Read our Data Privacy Policy for more information</a
        >. For any questions or assistance, our support team is here to help at
        <a href="mailto:support@leadminer.io">support@leadminer.io</a>.
      </div>
      <div>
        Keep your data secure and take control of your lead generation journey!
        🔒💪
      </div>
      <div class="flex justify-end q-gutter-md q-mt-sm">
        <q-btn
          no-caps
          unelevated
          text-color="black"
          color="grey-3"
          class="no-border no-border-radius no-box-shadow"
          label="Cancel"
          @click="$router.replace('/dashboard')"
        />

        <q-btn
          no-caps
          unelevated
          color="indigo"
          class="no-border no-border-radius no-box-shadow"
          label="Try again"
          @click="
            provider === 'azure' || provider === 'google'
              ? addOAuthAccount(provider)
              : $router.replace('/dashboard')
          "
        />
      </div>
    </div>
  </AppLayout>
</template>
<script setup lang="ts">
import { addOAuthAccount } from "src/helpers/oauth";
import AppLayout from "src/layouts/AppLayout.vue";
import { useRouter } from "vue-router";

const $router = useRouter();

const provider = $router.currentRoute.value.query?.provider;
</script>
