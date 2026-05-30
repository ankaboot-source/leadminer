import type {
  SmtpSender,
  SmtpSenderCreatePayload,
  SmtpSenderUpdatePayload,
  SmtpAutodetectResult,
  SmtpTestResult,
} from '@/types/smtp-senders';

export const useSmtpSendersStore = defineStore('smtp-senders', () => {
  const { $api } = useNuxtApp();

  const senders = ref<SmtpSender[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchSenders() {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $api<{ senders: SmtpSender[] }>('/smtp-senders', {
        method: 'GET',
      });

      if (!response?.senders || !Array.isArray(response.senders)) {
        throw new Error('Failed to fetch senders');
      }

      senders.value = response.senders;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to fetch senders';
      console.error('Error fetching SMTP senders:', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function createSender(
    payload: SmtpSenderCreatePayload,
  ): Promise<SmtpSender | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $api<{ sender: SmtpSender }>('/smtp-senders', {
        method: 'POST',
        body: payload,
      });

      if (!response?.sender?.id) {
        throw new Error('Failed to create sender');
      }

      senders.value.unshift(response.sender);
      return response.sender;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to create sender';
      console.error('Error creating SMTP sender:', err);
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateSender(
    senderId: string,
    updates: SmtpSenderUpdatePayload,
  ): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $api<{ sender: SmtpSender }>(
        `/smtp-senders/${senderId}`,
        { method: 'PUT', body: updates },
      );

      if (!response?.sender) {
        throw new Error('Failed to update sender');
      }

      const index = senders.value.findIndex((s) => s.id === senderId);
      if (index !== -1) {
        senders.value[index] = response.sender;
      }

      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to update sender';
      console.error('Error updating SMTP sender:', err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteSender(senderId: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await $api<{ success: boolean }>(
        `/smtp-senders/${senderId}`,
        { method: 'DELETE' },
      );

      if (!response?.success) {
        throw new Error('Failed to delete sender');
      }

      senders.value = senders.value.filter((s) => s.id !== senderId);
      return true;
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to delete sender';
      console.error('Error deleting SMTP sender:', err);
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function testSender(senderId: string): Promise<SmtpTestResult> {
    try {
      const result = await $api<SmtpTestResult>(
        `/smtp-senders/${senderId}/test`,
        { method: 'POST' },
      );
      return result;
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      };
    }
  }

  async function autodetect(
    email: string,
  ): Promise<SmtpAutodetectResult | null> {
    try {
      const result = await $api<SmtpAutodetectResult | null>(
        '/smtp-senders/autodetect',
        { method: 'POST', body: { email } },
      );
      return result;
    } catch (err) {
      console.error('Error autodetecting SMTP settings:', err);
      return null;
    }
  }

  const activeSenders = computed(() => senders.value.filter((s) => s.active));

  function $reset() {
    senders.value = [];
    isLoading.value = false;
    error.value = null;
  }

  return {
    senders,
    isLoading,
    error,
    activeSenders,
    fetchSenders,
    createSender,
    updateSender,
    deleteSender,
    testSender,
    autodetect,
    $reset,
  };
});
