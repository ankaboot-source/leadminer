import { ListResponse } from 'imapflow';
import { FlatTree, ImapFolderCursor } from '../../services/imap/types';

function normalizeCursor(status: ListResponse['status']): ImapFolderCursor {
  const uidValidity = status?.uidValidity;
  const uidNext = status?.uidNext;
  const uidvalidity =
    uidValidity === undefined || uidValidity === null
      ? null
      : String(uidValidity);
  const uidnext =
    typeof uidNext === 'number' && Number.isInteger(uidNext) && uidNext > 0
      ? uidNext
      : null;

  return {
    uidvalidity,
    uidnext,
    high_water_uid: uidnext === null ? null : Math.max(0, uidnext - 1)
  };
}

export function createFlatTreeFromImap(boxes: ListResponse[]): FlatTree[] {
  const pathMap = new Map<string, FlatTree>();

  // Create FlatTree nodes without linking parents yet
  for (const box of boxes) {
    pathMap.set(box.path, {
      label: box.name,
      key: box.path,
      total: box.status?.messages || 0,
      cumulativeTotal: box.status?.messages || 0,
      attribs: Array.from(box.flags.values()),
      cursor: normalizeCursor(box.status)
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

export function buildFinalTree(flatTree: FlatTree[], userEmail: string) {
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
      box.parent.cumulativeTotal! += box.total!;
    } else {
      readableTree.push(box);
    }
    totalInEmail += box.total!;
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
