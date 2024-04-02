export default defineNuxtRouteMiddleware((to) => {
  const $router = useRouter();
  switch (to.path) {
    case '/oauth-consent-error':
      return $router.push({
        path: '/dashboard',
        query: {
          error: 'oauth-consent',
          ...to.query,
        },
      });
    default:
      return true;
  }
});
