import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const PASSIVE_DIALOG = resolve(
  __dirname,
  '../../components/mining/PassiveMiningFolderDialog.vue',
);
const ADVANCED_DIALOG = resolve(
  __dirname,
  '../../components/mining/stepper-panels/mine/MiningSettingsDialog.vue',
);

/**
 * The passive mining dialog and the advanced mining settings dialog expose the
 * same three toggles. They used to carry separate copy, so the same setting was
 * described two different ways depending on where you opened it. Both now read
 * the shared `mining.*` strings; this pins that so they cannot drift again.
 */
const SHARED_TOGGLE_KEYS = [
  'mining.sync_google_contacts',
  'mining.sync_google_contacts_sub',
  'mining.cleaning_enabled_option',
  'mining.cleaning_enabled_sub',
  'mining.extract_signatures_option',
  'mining.extract_signatures_sub',
];

const read = (path: string) => readFileSync(path, 'utf8');

describe('passive mining dialog copy', () => {
  it.each(SHARED_TOGGLE_KEYS)('uses the shared %s string', (key) => {
    expect(read(PASSIVE_DIALOG)).toContain(key);
  });

  it.each(SHARED_TOGGLE_KEYS)(
    'resolves %s from the global catalogue',
    (key) => {
      const leaf = key.replace('mining.', '');
      const messages = read(resolve(__dirname, '../../i18n/messages.json'));

      expect(messages).toContain(`"${leaf}"`);
    },
  );

  it('no longer declares its own toggle copy', () => {
    const passive = read(PASSIVE_DIALOG);

    expect(passive).not.toContain('"clean_contacts"');
    expect(passive).not.toContain('"extract_signatures"');
    expect(passive).not.toContain('"sync_google_contacts"');
  });

  it('does not shadow the shared google strings in the advanced dialog', () => {
    expect(read(ADVANCED_DIALOG)).not.toContain('"sync_google_contacts"');
  });
});
