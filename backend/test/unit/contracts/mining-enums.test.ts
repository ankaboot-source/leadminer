import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from '@jest/globals';
import {
  FolderStatus,
  MiningRunMode,
  SourceHealthState,
  TaskStatus
} from '../../../src/db/types';

const manifest = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../contracts/mining-enums.json'),
    'utf8'
  )
) as Record<string, Record<string, string>>;

const mirrors = {
  MiningRunMode,
  TaskStatus,
  SourceHealthState,
  FolderStatus
};

describe('mining enum contract (backend)', () => {
  it.each(Object.keys(mirrors))(
    '%s matches contracts/mining-enums.json',
    (name) => {
      expect(mirrors[name as keyof typeof mirrors]).toEqual(manifest[name]);
    }
  );
});
