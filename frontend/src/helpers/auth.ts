import { LocalStorage } from "quasar";
import { RouteLocationNormalized } from "vue-router";

interface UserAuthCredentials {
  accessToken: string;
  expiresAt: number;
}

/**
 * Checks if the user is authenticated or logs out if the access token has expired.
 * @param to - The current route location object.
 * @param redirect - The redirect path if the user is not authenticated.
 * @returns The redirect path or a Boolean(true)
 */
export function isAuthenticatedUserOrLogout(
  to: RouteLocationNormalized,
  redirect: string
) {
  if (to.hash) {
    return true;
  }

  const user = LocalStorage.getItem("user") as UserAuthCredentials;
  const isAuthenticated =
    user?.accessToken && user.expiresAt > Math.floor(Date.now() / 1000);

  if (!isAuthenticated) {
    LocalStorage.clear();
    return redirect;
  }

  return true;
}

/**
 * Checks if the user is anonymous or redirects to the specified path.
 * @param redirect The redirect path if the user is not anonymous.
 * @returns A boolean(True) or a redirect path.
 */
export function isAnonymousUserOrRedirect(redirect: string): boolean | string {
  const isUserAnonymous = !LocalStorage.has("user");

  return isUserAnonymous || redirect;
}
