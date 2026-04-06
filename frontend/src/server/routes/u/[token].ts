import {
  buildEmailCampaignEdgeUrl,
  buildSmsCampaignEdgeUrl,
} from '../../utils/email-campaign-proxy';

export default defineEventHandler((event) => {
  const token = getRouterParam(event, 'token');
  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Missing token' });
  }

  const targetUrl = token.startsWith('s_')
    ? buildSmsCampaignEdgeUrl(
        event,
        `/unsubscribe/${encodeURIComponent(token)}`,
      )
    : buildEmailCampaignEdgeUrl(
        event,
        `/unsubscribe/${encodeURIComponent(token)}`,
      );

  return proxyRequest(event, targetUrl);
});
