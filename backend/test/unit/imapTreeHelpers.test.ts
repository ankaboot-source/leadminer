import { ListResponse } from 'imapflow';
import { describe, it, expect } from '@jest/globals';
import {
  buildFolderStatus,
  createFlatTreeFromImap,
  buildFinalTree,
  extractFolderWatermarks
} from '../../src/utils/helpers/imapTreeHelpers';
import { FlatTree } from '../../src/services/imap/types';
import { FolderStatus } from '../../src/db/types';

const CURSOR = {
  uidvalidity: '12',
  uidnext: 20,
  high_water_uid: 19
};

describe('buildFolderStatus', () => {
  it('is unmined without a watermark', () => {
    expect(buildFolderStatus({ cursor: CURSOR })).toEqual({
      status: FolderStatus.Unmined,
      hasNewMessages: false,
      requiresFullScan: false
    });
  });

  it('is up_to_date when the high-water UID equals the watermark', () => {
    expect(
      buildFolderStatus({
        cursor: CURSOR,
        watermark: { uidvalidity: '12', last_uid: 19 }
      }).status
    ).toBe(FolderStatus.UpToDate);
  });

  it('is new_messages when the high-water UID is above the watermark', () => {
    const result = buildFolderStatus({
      cursor: CURSOR,
      watermark: { uidvalidity: '12', last_uid: 10 }
    });
    expect(result.status).toBe(FolderStatus.NewMessages);
    expect(result.hasNewMessages).toBe(true);
  });

  it('is uidvalidity_changed when the namespace differs', () => {
    const result = buildFolderStatus({
      cursor: CURSOR,
      watermark: { uidvalidity: '99', last_uid: 19 }
    });
    expect(result.status).toBe(FolderStatus.UidvalidityChanged);
    expect(result.requiresFullScan).toBe(true);
  });

  it('is uidvalidity_changed when the watermark is malformed', () => {
    expect(
      buildFolderStatus({
        cursor: CURSOR,
        watermark: { uidvalidity: '', last_uid: -1 }
      }).status
    ).toBe(FolderStatus.UidvalidityChanged);
  });

  it('is metadata_unavailable when the cursor is missing', () => {
    expect(
      buildFolderStatus({
        watermark: { uidvalidity: '12', last_uid: 1 }
      }).status
    ).toBe(FolderStatus.MetadataUnavailable);
  });
});

describe('extractFolderWatermarks', () => {
  it('reads the V1 mining.last.folders map', () => {
    expect(
      extractFolderWatermarks({
        mining: {
          last: {
            folders: {
              INBOX: { uidvalidity: '42', last_uid: 100, updated_at: 'x' }
            }
          }
        }
      })
    ).toEqual({ INBOX: { uidvalidity: '42', last_uid: 100 } });
  });

  it('ignores missing or malformed entries', () => {
    expect(extractFolderWatermarks(null)).toEqual({});
    expect(
      extractFolderWatermarks({
        mining: { last: { folders: { INBOX: { last_uid: 'nope' } } } }
      })
    ).toEqual({});
  });
});

describe('IMAP Tree Utilities', () => {
  const mockBoxes: ListResponse[] = [
    {
      path: 'INBOX',
      name: 'INBOX',
      flags: new Set(['HasChildren']),
      delimiter: '/',
      status: { messages: 5, uidValidity: 12n, uidNext: 20 }
    } as ListResponse,
    {
      path: 'INBOX/Work',
      name: 'Work',
      flags: new Set(['HasNoChildren']),
      delimiter: '/',
      parentPath: 'INBOX',
      status: { messages: 10, uidValidity: 12n, uidNext: 30 }
    } as ListResponse,
    {
      path: 'INBOX/Spam',
      name: 'Spam',
      flags: new Set(['Junk', 'HasNoChildren']),
      delimiter: '/',
      parentPath: 'INBOX',
      status: { messages: 2, uidValidity: 12n, uidNext: 8 }
    } as ListResponse,
    {
      path: 'Drafts',
      name: 'Drafts',
      flags: new Set(['Drafts', 'HasNoChildren']),
      delimiter: '/',
      status: { messages: 1, uidValidity: 15n, uidNext: 4 }
    } as ListResponse
  ];

  const expectedParent = {
    attribs: ['HasChildren'],
    cumulativeTotal: 5,
    cursor: CURSOR,
    key: 'INBOX',
    label: 'INBOX',
    total: 5,
    status: FolderStatus.Unmined,
    has_new_messages: false,
    latest_uid: 19
  };

  it('should create a flat tree from IMAP boxes', () => {
    const flatTree = createFlatTreeFromImap(mockBoxes);

    expect(flatTree).toHaveLength(4);

    const inbox = flatTree.find((node) => node.key === 'INBOX');
    expect(inbox).toBeDefined();
    expect(inbox?.label).toBe('INBOX');
    expect(inbox?.attribs).toContain('HasChildren');
    expect(inbox?.total).toBe(5);
    expect(inbox?.cursor).toEqual(CURSOR);
    expect(inbox?.status).toBe(FolderStatus.Unmined);

    const work = flatTree.find((node) => node.key === 'INBOX/Work');
    expect(work).toBeDefined();
    expect(work?.label).toBe('Work');
    expect(work?.parent).toStrictEqual(expectedParent);
    expect(work?.attribs).toContain('HasNoChildren');
    expect(work?.total).toBe(10);

    const spam = flatTree.find((node) => node.key === 'INBOX/Spam');
    expect(spam).toBeDefined();
    expect(spam?.label).toBe('Spam');
    expect(spam?.attribs).toContain('Junk');
    expect(spam?.parent).toStrictEqual(expectedParent);
    expect(spam?.total).toBe(2);

    const drafts = flatTree.find((node) => node.key === 'Drafts');
    expect(drafts).toBeDefined();
    expect(drafts?.attribs).toContain('Drafts');
    expect(drafts?.total).toBe(1);
  });

  it('annotates folders with watermark + status when watermarks are provided', () => {
    const flatTree = createFlatTreeFromImap(mockBoxes, {
      INBOX: { uidvalidity: '12', last_uid: 10 },
      Drafts: { uidvalidity: '99', last_uid: 3 }
    });

    const inbox = flatTree.find((node) => node.key === 'INBOX');
    expect(inbox?.status).toBe(FolderStatus.NewMessages);
    expect(inbox?.has_new_messages).toBe(true);
    expect(inbox?.watermark).toEqual({ uidvalidity: '12', last_uid: 10 });

    const drafts = flatTree.find((node) => node.key === 'Drafts');
    expect(drafts?.status).toBe(FolderStatus.UidvalidityChanged);
  });

  it('should correctly build a hierarchical tree structure using user email as root node', () => {
    const flatTree = createFlatTreeFromImap(mockBoxes);
    const tree = buildFinalTree(flatTree, 'user@example.com');

    // Root node with user email
    expect(tree).toHaveLength(1);
    expect(tree[0].label).toBe('user@example.com');

    // Top-level children: INBOX and Drafts
    const topLevel = tree[0].children;
    expect(topLevel).toHaveLength(2);

    const inboxNode = topLevel?.find((child) => child.label === 'INBOX');
    expect(inboxNode).toBeDefined();
    expect(inboxNode?.children).toHaveLength(2); // Work and Spam

    const draftsNode = topLevel?.find((child) => child.label === 'Drafts');
    expect(draftsNode).toBeDefined();
    expect(draftsNode?.children).toBeUndefined();

    // Total messages: 5 (INBOX) + 10 (Work) + 2 (Spam) + 1 (Drafts) = 18
    expect(tree[0].total).toBe(18);
  });

  it('should ensure no node in the final tree contains a parent reference', () => {
    const flatTree = createFlatTreeFromImap(mockBoxes);
    const tree = buildFinalTree(flatTree, 'user@example.com');

    const recursivelyCheckNoParent = (node: FlatTree) => {
      expect(node.parent).toBeUndefined();
      if (node.children) {
        node.children.forEach(recursivelyCheckNoParent);
      }
    };

    tree.forEach(recursivelyCheckNoParent);
  });
});
