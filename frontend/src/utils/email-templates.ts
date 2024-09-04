import type { $Fetch } from 'nitropack';

type EmailTemplate = {
  Prehead: string;
  Title: string;
  Body1: string;
  Body2: string;
  Body3?: string;
  Body4?: string;
  Button: string;
  Regards: string;
  Footer: string;
};

type EmailTemplatesI18n = {
  Invite: EmailTemplate;
  Confirmation: EmailTemplate;
  Recovery: EmailTemplate;
  EmailChange: EmailTemplate;
};

/**
 * Updates the user's metadata email-template based on the provided language.
 *
 * @param language - The language code (e.g., 'en', 'fr') for the email templates.
 * @returns A promise that resolves once the email templates are updated.
 */
export async function updateUserEmailTemplateI18n(language: string) {
  const { $saasEdgeFunctions } = useNuxtApp();
  try {
    await ($saasEdgeFunctions as $Fetch)('email-templates', {
      method: 'POST',
      body: {
        language,
      },
    });
  } catch (error) {
    console.error('Failed to update email template:', error);
  }
}

/**
 * Fetches the email template for the specified language.
 *
 * @param language - The language code (e.g., 'en', 'fr') to fetch the corresponding email template.
 * @returns A promise that resolves to the email template data.
 * @throws Error if the fetch operation fails.
 */
export async function getEmailTemplate(language: string) {
  const { $saasEdgeFunctions } = useNuxtApp();
  try {
    const data = await ($saasEdgeFunctions as $Fetch)<EmailTemplatesI18n>(
      'email-templates',
      {
        method: 'GET',
        params: {
          language,
        },
      },
    );
    return data;
  } catch (error) {
    console.error('Failed to fetch email template:', error);
  }
}
