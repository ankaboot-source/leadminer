import { describe, expect, it } from 'vitest';

import { flattenBoxNodes } from '@/utils/box-tree';
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
