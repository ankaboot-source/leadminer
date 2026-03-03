export default function generateOAuthConfig(
  clientId: string,
  clientSecret: string,
  tokenHost: string,
  authorizePath: string,
  tokenPath: string
) {
  return {
    client: {
      id: clientId,
      secret: clientSecret
    },
    auth: {
      tokenHost,
      authorizePath,
      tokenPath
    }
  };
}
