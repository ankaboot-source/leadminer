import type { H3Event } from 'h3';

export function buildEmailCampaignEdgeUrl(
  event: H3Event,
  path: string,
): string {
  const config = useRuntimeConfig(event);
  const baseUrl =
    config.public?.SAAS_SUPABASE_PROJECT_URL ||
    process.env.SAAS_SUPABASE_PROJECT_URL;

  if (!baseUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing SAAS_SUPABASE_PROJECT_URL',
    });
  }

  const normalizedBase = String(baseUrl).replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}/functions/v1/email-campaigns${normalizedPath}`;
}
