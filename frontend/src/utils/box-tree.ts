import type { BoxNode } from '~/utils/boxes';

/** Depth-first flatten of a box tree, parents before children. */
export function flattenBoxNodes(nodes: BoxNode[]): BoxNode[] {
  return nodes.flatMap((node) => [
    node,
    ...(node.children ? flattenBoxNodes(node.children) : []),
  ]);
}
