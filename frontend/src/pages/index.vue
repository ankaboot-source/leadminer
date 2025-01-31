<script setup lang="ts">
const $contactsStore = useContactsStore();
const homePath = $contactsStore.contactCount ? '/contacts' : '/mine';
navigateTo(homePath);
</script>
