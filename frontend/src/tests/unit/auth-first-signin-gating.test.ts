import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

/**
 * Behavioural coverage for the sb-user-listeners auth-state callback.
 *
 * Nuxt auto-imports are resolved to real module paths at transform time, so the
 * plugin is loaded with those modules mocked, then its registered
 * onAuthStateChange callback is driven directly with each event. We assert which
 * side effects fire — not what the source text says.
 */

type AuthEvent =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'SIGNED_OUT';

interface TestSession {
  provider_token?: string | null;
  provider_refresh_token?: string | null;
}

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  saasEdgeFunctions: vi.fn(),
  ensureMiningSourcesLoaded: vi.fn(),
  storeSources: [] as Array<{ email: string; type: string }>,
  authStateCallback: undefined as
    | ((event: string, session: unknown) => void)
    | undefined,
  pluginSetup: undefined as (() => void) | undefined,
}));

// defineNuxtPlugin / useNuxtApp are auto-imported from #app/nuxt.
vi.mock('#app/nuxt', () => ({
  defineNuxtPlugin: (config: { setup: () => void }) => {
    mocks.pluginSetup = config.setup;
    return config;
  },
  useNuxtApp: () => ({ $saasEdgeFunctions: mocks.saasEdgeFunctions }),
}));

vi.mock('~/composables/useSupabaseUserProfile', () => ({
  useSupabaseUserProfile: () => ({ value: null }),
}));

vi.mock('~/stores/leadminer', () => ({
  useLeadminerStore: () => ({
    ensureMiningSourcesLoaded: mocks.ensureMiningSourcesLoaded,
    get miningSources() {
      return mocks.storeSources;
    },
    getMiningSourceByEmail: (email: string) =>
      mocks.storeSources.find(
        (s) => s.email.toLowerCase() === email.toLowerCase(),
      ),
  }),
}));

// @nuxtjs/supabase composables are auto-imported and resolve to these runtime
// files under the test transform.
vi.mock(
  '/node_modules/@nuxtjs/supabase/dist/runtime/composables/useSupabaseUser.js',
  () => ({ useSupabaseUser: () => ({ value: { id: 'user-1' } }) }),
);

vi.mock(
  '/node_modules/@nuxtjs/supabase/dist/runtime/composables/useSupabaseClient.js',
  () => ({
    useSupabaseClient: () => ({
      auth: {
        onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
          mocks.authStateCallback = cb;
        },
        getUser: mocks.getUser,
        updateUser: mocks.updateUser,
      },
      // The plugin's authenticated watcher fetches the profile and subscribes
      // a realtime channel on every signed-in event; keep those inert.
      schema: () => ({
        from: () => ({
          select: () => ({
            single: () => ({ data: { id: 'user-1' }, error: null }),
          }),
        }),
      }),
      channel: () => ({ on: () => ({ subscribe: () => undefined }) }),
      removeChannel: () => undefined,
    }),
  }),
);

// If the callback still read the composable, provider tokens would come from
// here. It throws so any use of it fails the test loudly.
vi.mock(
  '/node_modules/@nuxtjs/supabase/dist/runtime/composables/useSupabaseSession.js',
  () => ({
    useSupabaseSession: () => {
      throw new Error(
        'useSupabaseSession() must not be used by the auth listener path',
      );
    },
  }),
);

vi.stubGlobal('ref', ref);
// The plugin registers a profile-realtime watcher behind import.meta.client;
// a no-op keeps it from touching the partial client mock.
vi.stubGlobal('watch', () => undefined);

// Mirror every mocked module as a global too: depending on the transform pass,
// Nuxt auto-imports either resolve to injected imports (covered by the
// vi.mock calls above) or stay bare identifiers (covered here). Both modes
// then behave identically.
vi.stubGlobal('useSupabaseUser', () => ({ value: { id: 'user-1' } }));
vi.stubGlobal('useSupabaseClient', () => ({
  auth: {
    onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
      mocks.authStateCallback = cb;
    },
    getUser: mocks.getUser,
    updateUser: mocks.updateUser,
  },
  schema: () => ({
    from: () => ({
      select: () => ({
        single: () => ({ data: { id: 'user-1' }, error: null }),
      }),
    }),
  }),
  channel: () => ({ on: () => ({ subscribe: () => undefined }) }),
  removeChannel: () => undefined,
}));
vi.stubGlobal('useSupabaseSession', () => {
  throw new Error(
    'useSupabaseSession() must not be used by the auth listener path',
  );
});
vi.stubGlobal('useNuxtApp', () => ({
  $saasEdgeFunctions: mocks.saasEdgeFunctions,
}));
vi.stubGlobal('defineNuxtPlugin', (config: { setup: () => void }) => {
  mocks.pluginSetup = config.setup;
  return config;
});

// Mocks must be registered before the plugin module is evaluated.
await import('~/plugins/sb-user-listeners');

function mockUser(
  overrides: {
    provider?: string;
    firstTimeSignin?: boolean;
    emailTemplateLanguage?: string;
  } = {},
) {
  const {
    provider = 'email',
    firstTimeSignin,
    emailTemplateLanguage,
  } = overrides;

  mocks.getUser.mockResolvedValue({
    data: {
      user: {
        id: 'user-1',
        email: 'user@example.com',
        app_metadata: { provider },
        user_metadata: {
          ...(firstTimeSignin === undefined
            ? {}
            : { first_time_signin: firstTimeSignin }),
          ...(emailTemplateLanguage === undefined
            ? {}
            : { EmailTemplate: { language: emailTemplateLanguage } }),
        },
      },
    },
    error: null,
  });
}

function registerListener() {
  mocks.authStateCallback = undefined;
  mocks.pluginSetup?.();
}

function emit(event: AuthEvent, session: TestSession | null = {}) {
  mocks.authStateCallback?.(event, session);
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  mocks.authStateCallback = undefined;
  mocks.storeSources = [];
  mocks.getUser.mockReset();
  mocks.updateUser.mockReset().mockResolvedValue({ error: null });
  mocks.saasEdgeFunctions
    .mockReset()
    .mockImplementation(() => Promise.resolve());
  mocks.ensureMiningSourcesLoaded
    .mockReset()
    .mockImplementation(() => Promise.resolve());
});

describe('sb-user-listeners first-sign-in side effects', () => {
  it('runs first-time work on INITIAL_SESSION (reload after password sign-in)', async () => {
    mockUser({ emailTemplateLanguage: 'en' });
    registerListener();

    emit('INITIAL_SESSION', {
      provider_token: null,
      provider_refresh_token: null,
    });

    await vi.waitFor(() =>
      expect(mocks.updateUser).toHaveBeenCalledWith({
        data: { first_time_signin: true },
      }),
    );
    expect(mocks.saasEdgeFunctions).not.toHaveBeenCalled();
  });

  it('runs first-time work on SIGNED_IN', async () => {
    mockUser({ emailTemplateLanguage: 'en' });
    registerListener();

    emit('SIGNED_IN', {
      provider_token: null,
      provider_refresh_token: null,
    });

    await vi.waitFor(() =>
      expect(mocks.updateUser).toHaveBeenCalledWith({
        data: { first_time_signin: true },
      }),
    );
  });

  it('does no work on TOKEN_REFRESHED or USER_UPDATED', async () => {
    mockUser({ emailTemplateLanguage: 'en' });
    registerListener();

    emit('TOKEN_REFRESHED');
    emit('USER_UPDATED');
    await flush();

    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.saasEdgeFunctions).not.toHaveBeenCalled();
  });

  it('is idempotent: no write when first_time_signin is already set', async () => {
    mockUser({ firstTimeSignin: true, emailTemplateLanguage: 'en' });
    registerListener();

    emit('INITIAL_SESSION');
    await flush();

    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it('creates the OAuth source once from the session provider tokens', async () => {
    mockUser({
      provider: 'google',
      firstTimeSignin: true,
      emailTemplateLanguage: 'en',
    });
    registerListener();

    emit('SIGNED_IN', {
      provider_token: 'oauth-access-fixture',
      provider_refresh_token: 'oauth-refresh-fixture',
    });

    await vi.waitFor(() =>
      expect(mocks.saasEdgeFunctions).toHaveBeenCalledWith(
        'mining-sources',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            provider: 'google',
            provider_token: 'oauth-access-fixture',
            provider_refresh_token: 'oauth-refresh-fixture',
          }),
        }),
      ),
    );
    expect(mocks.saasEdgeFunctions).toHaveBeenCalledTimes(1);
  });

  it('skips the OAuth POST when the source already exists', async () => {
    mocks.storeSources = [{ email: 'user@example.com', type: 'google' }];
    mockUser({
      provider: 'google',
      firstTimeSignin: true,
      emailTemplateLanguage: 'en',
    });
    registerListener();

    emit('SIGNED_IN', {
      provider_token: 'oauth-access-fixture',
      provider_refresh_token: 'oauth-refresh-fixture',
    });
    await flush();

    expect(mocks.saasEdgeFunctions).not.toHaveBeenCalled();
  });

  it('initialises the email-template language only when it differs', async () => {
    mockUser({ firstTimeSignin: true });
    registerListener();

    emit('INITIAL_SESSION');
    await vi.waitFor(() =>
      expect(mocks.saasEdgeFunctions).toHaveBeenCalledWith(
        'email-templates',
        expect.objectContaining({ body: { language: 'en' } }),
      ),
    );

    mocks.saasEdgeFunctions.mockClear();
    mockUser({ firstTimeSignin: true, emailTemplateLanguage: 'en' });
    registerListener();
    emit('INITIAL_SESSION');
    await flush();

    expect(mocks.saasEdgeFunctions).not.toHaveBeenCalled();
  });
});
