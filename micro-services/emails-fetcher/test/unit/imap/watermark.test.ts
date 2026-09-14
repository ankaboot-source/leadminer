import { describe, it, expect } from '@jest/globals';
import type { WatermarkPolicy } from '../../../src/services/imap/folderPlan';
import { buildWatermarkCursor } from '../../../src/services/imap/watermark';

const AT = '2026-09-11T00:00:00.000Z';

function input(overrides: {
  validities?: [string, string][];
  maxUids?: [string, number][];
  policies?: [string, WatermarkPolicy][];
  resumeFrom?: { folders: Record<string, { uidvalidity: string; last_uid: number }> };
}) {
  return {
    uidValidityPerFolder: new Map(overrides.validities ?? []),
    maxUidPerFolder: new Map(overrides.maxUids ?? []),
    watermarkPolicyPerFolder: new Map(overrides.policies ?? []),
    resumeFrom: overrides.resumeFrom,
    updatedAt: AT
  };
}

describe('buildWatermarkCursor', () => {
  it('advances a full scan to the highest observed UID', () => {
    const wm = buildWatermarkCursor(
      input({
        validities: [['INBOX', '42']],
        maxUids: [['INBOX', 100]],
        policies: [['INBOX', 'advance']]
      })
    );
    expect(wm).toEqual({
      folders: { INBOX: { uidvalidity: '42', last_uid: 100, updated_at: AT } }
    });
  });

  it('preserves a matching resume cursor when nothing new was fetched', () => {
    const wm = buildWatermarkCursor(
      input({
        validities: [['INBOX', '42']],
        policies: [['INBOX', 'advance']],
        resumeFrom: { folders: { INBOX: { uidvalidity: '42', last_uid: 90 } } }
      })
    );
    expect(wm?.folders.INBOX.last_uid).toBe(90);
  });

  it('records last_uid 0 for an empty, previously-unmined folder', () => {
    const wm = buildWatermarkCursor(
      input({
        validities: [['INBOX', '42']],
        policies: [['INBOX', 'advance']]
      })
    );
    expect(wm?.folders.INBOX).toMatchObject({ uidvalidity: '42', last_uid: 0 });
  });

  it('does NOT advance on a since scan with no prior cursor (omits the folder)', () => {
    const wm = buildWatermarkCursor(
      input({
        validities: [['INBOX', '42']],
        maxUids: [['INBOX', 100]],
        policies: [['INBOX', 'preserve-or-omit']]
      })
    );
    expect(wm).toBeUndefined();
  });

  it('does NOT advance on a since scan but keeps a matching prior cursor', () => {
    const wm = buildWatermarkCursor(
      input({
        validities: [['INBOX', '42']],
        maxUids: [['INBOX', 100]],
        policies: [['INBOX', 'preserve-or-omit']],
        resumeFrom: { folders: { INBOX: { uidvalidity: '42', last_uid: 90 } } }
      })
    );
    expect(wm?.folders.INBOX.last_uid).toBe(90);
  });

  it('omits a since folder whose prior cursor is a stale namespace', () => {
    const wm = buildWatermarkCursor(
      input({
        validities: [['INBOX', '42']],
        maxUids: [['INBOX', 100]],
        policies: [['INBOX', 'preserve-or-omit']],
        resumeFrom: { folders: { INBOX: { uidvalidity: '999', last_uid: 90 } } }
      })
    );
    expect(wm).toBeUndefined();
  });

  it('keeps independent folders independent', () => {
    const wm = buildWatermarkCursor(
      input({
        validities: [
          ['INBOX', '42'],
          ['Archive', '43']
        ],
        maxUids: [
          ['INBOX', 100],
          ['Archive', 7]
        ],
        policies: [
          ['INBOX', 'advance'],
          ['Archive', 'preserve-or-omit']
        ]
      })
    );
    expect(wm?.folders).toEqual({
      INBOX: { uidvalidity: '42', last_uid: 100, updated_at: AT }
    });
  });

  it('never moves backwards within the same namespace', () => {
    const wm = buildWatermarkCursor(
      input({
        validities: [['INBOX', '42']],
        maxUids: [['INBOX', 10]],
        policies: [['INBOX', 'advance']],
        resumeFrom: { folders: { INBOX: { uidvalidity: '42', last_uid: 90 } } }
      })
    );
    expect(wm?.folders.INBOX.last_uid).toBe(90);
  });

  it('rebuilds from zero after a uidvalidity change', () => {
    const wm = buildWatermarkCursor(
      input({
        validities: [['INBOX', '43']],
        maxUids: [['INBOX', 5]],
        policies: [['INBOX', 'advance']],
        resumeFrom: { folders: { INBOX: { uidvalidity: '42', last_uid: 90 } } }
      })
    );
    expect(wm?.folders.INBOX.last_uid).toBe(5);
  });
});
