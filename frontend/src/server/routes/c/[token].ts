import { buildEmailCampaignEdgeUrl } from '../../utils/email-campaign-proxy';

export default defineEventHandler((event) => {
  const token = getRouterParam(event, 'token');
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Missing token' });
  }

  const targetUrl = buildEmailCampaignEdgeUrl(
    event,
    `/track/click/${encodeURIComponent(token)}`,
  );

  return proxyRequest(event, targetUrl);
});
