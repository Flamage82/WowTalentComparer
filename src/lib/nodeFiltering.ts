import type { TalentNodeData } from '../data/types'

/**
 * Deduplicates nodes that share the same position (posX, posY).
 *
 * This handles the case where hero talent trees have overlapping nodes -
 * nodes from different hero trees can exist at the same position, but
 * only one should be visible at a time.
 *
 * IMPORTANT: Only deduplicates when ALL overlapping nodes are hero tree nodes.
 * If any non-hero-tree node is at a position, all nodes at that position are kept
 * (they're from different tree types and should all be visible).
 *
 * Priority order when deduplicating hero tree nodes:
 * 1. Nodes in the selected hero tree
 * 2. First node in the array (fallback)
 */
export function deduplicateOverlappingNodes(
  nodes: TalentNodeData[],
  selectedHeroNodeIds: Set<number>,
  heroTreeNodeIds: Set<number>
): TalentNodeData[] {
  // Group nodes by position
  const nodesByPosition = new Map<string, TalentNodeData[]>()
  for (const node of nodes) {
    const key = `${node.posX},${node.posY}`
    const existing = nodesByPosition.get(key) || []
    existing.push(node)
    nodesByPosition.set(key, existing)
  }

  // For each position, decide what to keep
  const result: TalentNodeData[] = []

  for (const nodesAtPos of nodesByPosition.values()) {
    if (nodesAtPos.length === 1) {
      result.push(nodesAtPos[0])
      continue
    }

    // Check if ALL nodes at this position are hero tree nodes
    const allAreHeroNodes = nodesAtPos.every(n => heroTreeNodeIds.has(n.id))

    if (!allAreHeroNodes) {
      // Mixed tree types at same position - keep all of them
      // (This shouldn't normally happen, but be safe)
      result.push(...nodesAtPos)
      continue
    }

    // All nodes are hero tree nodes - deduplicate
    // Prefer nodes in the selected hero tree
    const selectedNode = nodesAtPos.find(n => selectedHeroNodeIds.has(n.id))
    if (selectedNode) {
      result.push(selectedNode)
    } else {
      // Fallback to first node
      result.push(nodesAtPos[0])
    }
  }

  return result
}
