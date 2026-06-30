import { ListResponse } from 'imapflow';
import { FlatTree } from '../../services/imap/types';

/**
 * FlatTree node after {@link createFlatTreeFromImap} has populated the
 * counters. The intermediate fields (`total`, `cumulativeTotal`) are always
 * present once the node has been created; this intersection narrows the
 * optional fields to required so downstream code does not need non-null
 * assertions.
 */
type PopulatedTree = FlatTree & {
  total: number;
  cumulativeTotal: number;
};

export function createFlatTreeFromImap(
  boxes: ListResponse[]
): PopulatedTree[] {
  const pathMap = new Map<string, PopulatedTree>();

  // Create PopulatedTree nodes without linking parents yet
  for (const box of boxes) {
    pathMap.set(box.path, {
      label: box.name,
      key: box.path,
      total: box.status?.messages || 0,
      cumulativeTotal: box.status?.messages || 0,
      attribs: Array.from(box.flags.values())
    });
  }

  // Assign parent references
  for (const box of boxes) {
    const node = pathMap.get(box.path);
    if (node && box.parentPath && pathMap.has(box.parentPath)) {
      node.parent = pathMap.get(box.parentPath);
    }
  }

  return [...pathMap.values()];
}

/**
 * @param flatTree - A flat array of objects to build a tree.
 * @param userEmail - The email address of the user you want to get the data for.
 */

export function buildFinalTree(flatTree: PopulatedTree[], userEmail: string) {
  const readableTree = [];
  let totalInEmail = 0;

  for (const box of flatTree) {
    box.key = box.key.toString();

    if (box.parent) {
      if (box.parent.children) {
        box.parent.children.push(box);
      } else {
        box.parent.children = [box];
      }
      box.parent.cumulativeTotal += box.total;
    } else {
      readableTree.push(box);
    }
    totalInEmail += box.total;
    delete box.parent;
  }

  return [
    {
      label: userEmail,
      children: [...readableTree],
      total: totalInEmail,
      key: ''
    }
  ];
}