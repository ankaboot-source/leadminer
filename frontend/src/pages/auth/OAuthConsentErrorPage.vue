<template>
  <AppLayout class="q-px-lg">
    <div class="q-gutter-md">
      <div class="q-gutter-y-xs">
        <div class="text-h4 merriweather">🔐 Authorization Required</div>
        <div class="text-body1">
          We apologize for the inconvenience. It seems like you have declined to
          grant authorization for us to access your
          <span v-if="provider === 'google'">Google</span>
          <span v-else-if="provider === 'azure'">Outlook</span>
          <span v-else>Google or Outlook</span> mailbox. Without authorization,
          we are unable to extract, clean, and enrich contacts from your
          mailbox.
        </div>
      </div>

      <q-card class="bg-green-1" flat square>
        <q-card-section horizontal class="flex-center">
          <q-card-section class="q-pr-none">
            <q-icon size="5em" name="img:icons/gdpr.png" />
          </q-card-section>

          <q-card-section>
            <div class="text-h6 font-weight-medium">
              Your data is yours only
            </div>
            <div class="text-body1 text-weight-regular merriweather">
              We assure you that we will not use your data commercially or share
              it with any third parties without your explicit permission. Please
              be assured that your data will be handled securely and used solely
              for the purposes of providing you with the best lead generation
              experience in full compliance with the GDPR.
              <a
                href="https://www.leadminer.io/data-privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Read our Data Privacy Policy for more information</a
              >.
            </div>
          </q-card-section>
        </q-card-section>
      </q-card>

      <div class="text-body1">
        For any questions or assistance, our support team is here to help at
        <a href="mailto:support@leadminer.io">support@leadminer.io</a>. Keep
        your data secure and take control of your lead generation journey!🔒💪
      </div>

      <div class="flex justify-end q-gutter-md q-mt-sm">
        <q-btn
          no-caps
          unelevated
          text-color="black"
          class="text-h6 text-weight-less-regular secondary-button"
          label="Cancel"
          @click="$router.replace('/dashboard')"
        />

        <q-btn
          no-caps
          unelevated
          color="indigo"
          class="text-h6 no-border"
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
