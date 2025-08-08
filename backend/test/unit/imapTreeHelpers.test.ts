import { ListResponse } from 'imapflow';
import { describe, it, expect } from '@jest/globals';
import {
  createFlatTreeFromImap,
  buildFinalTree
} from '../../src/utils/helpers/imapTreeHelpers';

describe('IMAP Tree Utilities', () => {
  const mockBoxes: ListResponse[] = [
    {
      path: 'INBOX',
      name: 'INBOX',
      flags: new Set(['HasChildren']),
      delimiter: '/',
      status: { messages: 5 }
    } as any,
    {
      path: 'INBOX/Work',
      name: 'Work',
      flags: new Set(['HasNoChildren']),
      delimiter: '/',
      parentPath: 'INBOX',
      status: { messages: 10 }
    } as any,
    {
      path: 'INBOX/Spam',
      name: 'Spam',
      flags: new Set(['Junk', 'HasNoChildren']),
      delimiter: '/',
      parentPath: 'INBOX',
      status: { messages: 2 }
    } as any,
    {
      path: 'Drafts',
      name: 'Drafts',
      flags: new Set(['Drafts', 'HasNoChildren']),
      delimiter: '/',
      status: { messages: 1 }
    } as any
  ];

  it('should create a flat tree from IMAP boxes', () => {
    const flatTree = createFlatTreeFromImap(mockBoxes);

    expect(flatTree).toHaveLength(4);

    const inbox = flatTree.find((node) => node.key === 'INBOX');
    expect(inbox).toBeDefined();
    expect(inbox?.label).toBe('INBOX');
    expect(inbox?.attribs).toContain('HasChildren');
    expect(inbox?.total).toBe(5);

    const work = flatTree.find((node) => node.key === 'INBOX/Work');
    expect(work).toBeDefined();
    expect(work?.label).toBe('Work');
    expect(work?.parent).toStrictEqual({
      attribs: ['HasChildren'],
      cumulativeTotal: 5,
      key: 'INBOX',
      label: 'INBOX',
      total: 5
    });
    expect(work?.attribs).toContain('HasNoChildren');
    expect(work?.total).toBe(10);

    const spam = flatTree.find((node) => node.key === 'INBOX/Spam');
    expect(spam).toBeDefined();
    expect(spam?.label).toBe('Spam');
    expect(spam?.attribs).toContain('Junk');
    expect(spam?.parent).toStrictEqual({
      attribs: ['HasChildren'],
      cumulativeTotal: 5,
      key: 'INBOX',
      label: 'INBOX',
      total: 5
    });
    expect(spam?.total).toBe(2);

    const drafts = flatTree.find((node) => node.key === 'Drafts');
    expect(drafts).toBeDefined();
    expect(drafts?.attribs).toContain('Drafts');
    expect(drafts?.total).toBe(1);
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

    const recursivelyCheckNoParent = (node: any) => {
      expect(node.parent).toBeUndefined();
      if (node.children) {
        node.children.forEach(recursivelyCheckNoParent);
      }
    };

    tree.forEach(recursivelyCheckNoParent);
  });
});
