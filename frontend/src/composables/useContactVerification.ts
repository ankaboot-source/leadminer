import { useNuxtApp } from '#imports';

interface ContactVerificationResponse {
  email: string;
  status: string;
  details?: Record<string, unknown>;
}

export const useContactVerification = () => {
  const { $api } = useNuxtApp();

  const verifyEmailStatus = async (
    email: string,
  ): Promise<ContactVerificationResponse> => {
    return await $api('/v1/contacts/verify', {
      method: 'POST',
      body: { email },
    });
  };

  return { verifyEmailStatus };
};
