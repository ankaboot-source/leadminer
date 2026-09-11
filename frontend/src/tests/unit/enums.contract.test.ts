import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  FolderStatus,
  MiningRunMode,
  SourceBadge,
  SourceHealthState,
  TaskStatus
} from '~/types/enums';

const manifest = JSON.parse(
  readFileSync(
    resolve(process.cwd(), '../contracts/mining-enums.json'),
    'utf8'
  )
) as Record<string, Record<string, string>>;

const mirrors = {
  MiningRunMode,
  TaskStatus,
  SourceHealthState,
  FolderStatus,
  SourceBadge
};

describe('mining enum contract (frontend)', () => {
  it.each(Object.keys(mirrors))(
    '%s matches contracts/mining-enums.json',
    (name) => {
      expect(mirrors[name as keyof typeof mirrors]).toEqual(
        manifest[name]
      );
    }
  );

  it('defines every key in the manifest', () => {
    expect(Object.keys(manifest).sort()).toEqual(Object.keys(mirrors).sort());
  });
});
