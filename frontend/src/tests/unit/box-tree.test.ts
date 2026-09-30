import { describe, expect, it } from 'vitest';

import { buildTreeSelectionKeys, flattenBoxNodes } from '@/utils/box-tree';
import type { BoxNode } from '@/utils/boxes';

function node(key: string, children?: BoxNode[]): BoxNode {
  return { key, label: key, total: 0, ...(children ? { children } : {}) };
}

describe('flattenBoxNodes', () => {
  it('flattens depth-first with parents before children', () => {
    const tree = [
      node('INBOX', [node('INBOX/Sub', [node('INBOX/Sub/Deep')])]),
      node('Sent'),
    ];
    expect(flattenBoxNodes(tree).map((n) => n.key)).toEqual([
      'INBOX',
      'INBOX/Sub',
      'INBOX/Sub/Deep',
      'Sent',
    ]);
  });

  it('returns [] for an empty tree', () => {
    expect(flattenBoxNodes([])).toEqual([]);
  });

  it('passes through leaf nodes unchanged', () => {
    const leaf = node('Drafts');
    expect(flattenBoxNodes([leaf])).toEqual([leaf]);
  });
});

describe('buildTreeSelectionKeys', () => {
  const tree: BoxNode[] = [
    {
      key: 'Archive',
      label: 'Archive',
      total: 2,
      children: [
        { key: 'Archive/2024', label: '2024', total: 1 },
        { key: 'Archive/2025', label: '2025', total: 1 },
      ],
    },
    { key: 'INBOX', label: 'Inbox', total: 3 },
  ];

  it('checks wanted leaves and leaves ancestors partial', () => {
    expect(buildTreeSelectionKeys(tree, ['Archive/2024', 'INBOX'])).toEqual({
      'Archive/2024': { checked: true, partialChecked: false },
      Archive: { checked: false, partialChecked: true },
      INBOX: { checked: true, partialChecked: false },
    });
  });

  it('checks a parent when all its children are selected', () => {
    expect(
      buildTreeSelectionKeys(tree, ['Archive/2024', 'Archive/2025']),
    ).toEqual({
      'Archive/2024': { checked: true, partialChecked: false },
      'Archive/2025': { checked: true, partialChecked: false },
      Archive: { checked: true, partialChecked: false },
    });
  });

  it('selects a whole subtree when a parent key is given', () => {
    expect(buildTreeSelectionKeys(tree, ['Archive'])).toEqual({
      Archive: { checked: true, partialChecked: false },
      'Archive/2024': { checked: true, partialChecked: false },
      'Archive/2025': { checked: true, partialChecked: false },
    });
  });

  it('ignores keys not present in the tree', () => {
    expect(buildTreeSelectionKeys(tree, ['Missing'])).toEqual({});
  });
});
