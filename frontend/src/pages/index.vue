<script setup lang="ts">
const $supabase = useSupabaseClient();
const { session } = (await $supabase.auth.getSession()).data;
const $contactsStore = useContactsStore();
if (session) await $contactsStore.loadContacts();
const homePath = $contactsStore.contactCount ? '/contacts' : '/mine';
navigateTo(homePath);
</script>
