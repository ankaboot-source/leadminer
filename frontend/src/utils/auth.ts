import type { Provider } from '@supabase/supabase-js';
import Cookies from 'js-cookie';
import { sse } from './sse';

export async function signInWithOAuth(provider: Provider) {
  const $supabase = useSupabaseClient();
  const { error } = await $supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/callback`,
      skipBrowserRedirect: false,
      scopes:
        provider === 'azure'
          ? 'email https://outlook.office.com/IMAP.AccessAsUser.All'
          : 'https://mail.google.com/ https://www.googleapis.com/auth/contacts',

      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  if (error) {
    throw error;
  }
}

export function clearPersistedData() {
  const allCookies = Cookies.get();
  Object.keys(allCookies).forEach((cookie) => Cookies.remove(cookie));
  localStorage.clear();
}

export function signOutManually(params?: {
  resetUser?: () => void;
  resetProfile?: () => void;
  navigateToLogin?: () => void;
}) {
  sse.closeConnection();
  clearPersistedData();
  useResetStore().all?.();

  if (params?.resetUser) {
    params.resetUser();
  }
  if (params?.resetProfile) {
    params.resetProfile();
  }
  if (params?.navigateToLogin) {
    params.navigateToLogin();
  } else {
    window.location.href = '/auth/login';
  }
}

export async function signOut(params?: {
  supabase: { auth: { signOut: () => Promise<{ error: unknown }> } };
  resetUser?: () => void;
  resetProfile?: () => void;
}) {
  if (!params?.supabase) {
    throw new Error('signOut requires supabase client parameter');
  }

  const { error } = await params.supabase.auth.signOut();

  if (params.resetUser) {
    params.resetUser();
  }
  if (params.resetProfile) {
    params.resetProfile();
  }

  if (error) {
    reloadNuxtApp({ persistState: false });
  }
}
