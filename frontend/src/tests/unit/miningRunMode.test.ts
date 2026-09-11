import { describe, it, expect, beforeEach } from 'vitest';
import {
  forceFullMiningKey,
  readForceFullMining,
  writeForceFullMining,
  resolveMiningRunMode,
  type StorageLike
} from '~/utils/miningRunMode';

function makeStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    }
  };
}

describe('miningRunMode', () => {
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(() => {
    storage = makeStorage();
  });

  it('keys preferences per source email, case-insensitively', () => {
    expect(forceFullMiningKey('Playtest@Example.com')).toBe(
      forceFullMiningKey('playtest@example.com')
    );
  });

  it('defaults to resume (no opt-out stored)', () => {
    expect(readForceFullMining('a@b.com', storage)).toBe(false);
  });

  it('reads back an explicit opt-out', () => {
    writeForceFullMining('a@b.com', true, storage);
    expect(readForceFullMining('a@b.com', storage)).toBe(true);
  });

  it('does not leak one source preference into another', () => {
    writeForceFullMining('a@b.com', true, storage);
    expect(readForceFullMining('other@b.com', storage)).toBe(false);
  });

  it('treats a missing storage as no opt-out and never throws on write', () => {
    expect(readForceFullMining('a@b.com', undefined)).toBe(false);
    expect(() => writeForceFullMining('a@b.com', true, undefined)).not.toThrow();
  });

  it('swallows storage errors (private mode)', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      }
    };
    expect(readForceFullMining('a@b.com', throwing)).toBe(false);
    expect(() => writeForceFullMining('a@b.com', true, throwing)).not.toThrow();
  });

  it('resumes by default and only forces full on opt-out', () => {
    expect(resolveMiningRunMode(false)).toBe('incremental');
    expect(resolveMiningRunMode(true)).toBe('full');
  });
});
