import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readPluginSource() {
  return fs.readFileSync(
    path.resolve(__dirname, '../../..', 'src/plugins/sb-user-listeners.ts'),
    'utf-8',
  );
}

describe('sb-user-listeners first-sign-in gating', () => {
  it('runs handleFirstTimeSignIn only for a genuine SIGNED_IN event', () => {
    const source = readPluginSource();

    // The auth-state callback must inspect the event name (not discard it).
    expect(source).toMatch(/onAuthStateChange\(\(event, session\)/);
    expect(source).toContain("event === 'SIGNED_IN'");

    // Exactly one runtime call site: the SIGNED_IN branch. A second call
    // (e.g. from the authenticated watcher) would re-run auth.getUser()
    // and its writes on every page load via INITIAL_SESSION.
    const callSites = source.split('handleFirstTimeSignIn()').length - 1;
    // Definition `async function handleFirstTimeSignIn() {` + single call.
    expect(callSites).toBe(2);
    expect(source).not.toContain('await handleFirstTimeSignIn()');
  });

  it('still fetches the profile and subscribes the realtime channel on every load', () => {
    const source = readPluginSource();

    expect(source).toContain('getCurrentUserProfile($supabaseClient)');
    expect(source).toContain('createUserProfileRealtimeChannel(userId)');
    expect(source).toContain('channel.subscribe()');
  });
});
