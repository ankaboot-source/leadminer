import type { TreeSelectionKeys } from 'primevue/tree';
import type { BoxNode } from '~/utils/boxes';

/** Depth-first flatten of a box tree, parents before children. */
export function flattenBoxNodes(nodes: BoxNode[]): BoxNode[] {
  return nodes.flatMap((node) => [
    node,
    ...(node.children ? flattenBoxNodes(node.children) : []),
  ]);
}

/**
 * Builds PrimeVue Tree selection keys for a set of folder keys.
 *
 * - A key matching a node selects that node and its whole subtree.
 * - Ancestors of a selected node are marked `partialChecked`.
 * - A node is `checked` when every child subtree is selected.
 * - Keys absent from the tree are ignored (e.g. folders deleted server-side).
 */
export function buildTreeSelectionKeys(
  nodes: BoxNode[],
  keys: Iterable<string>,
): TreeSelectionKeys {
  const wanted = new Set(keys);
  const selection: TreeSelectionKeys = {};

  const checkSubtree = (node: BoxNode) => {
    selection[node.key] = { checked: true, partialChecked: false };
    for (const child of node.children ?? []) checkSubtree(child);
  };

  const visit = (node: BoxNode): boolean => {
    const children = node.children ?? [];
    if (wanted.has(node.key)) {
      checkSubtree(node);
      return true;
    }
    if (children.length === 0) return false;

    let allSelected = true;
    for (const child of children) {
      if (!visit(child)) allSelected = false;
    }
    if (allSelected) {
      selection[node.key] = { checked: true, partialChecked: false };
    } else if (children.some((child) => selection[child.key] !== undefined)) {
      selection[node.key] = { checked: false, partialChecked: true };
    }
    return allSelected;
  };

  for (const node of nodes) visit(node);
  return selection;
}
