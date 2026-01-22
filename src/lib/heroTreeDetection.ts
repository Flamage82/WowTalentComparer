import type { SpecTalentData, HeroTreeData } from '../data/types'
import type { TalentNodeSelection } from './talentParser'

/**
 * Determines which hero tree is selected based on the talent node selections.
 * Returns the hero tree with the most selected nodes.
 */
export function getSelectedHeroTree(
  specData: SpecTalentData,
  selectedNodes: TalentNodeSelection[]
): HeroTreeData | null {
  if (!specData.heroTrees || specData.heroTrees.length === 0) {
    return null
  }

  // Create a set of selected node IDs for quick lookup
  const selectedNodeIds = new Set<number>()
  for (const selection of selectedNodes) {
    if (selection.isSelected) {
      const node = specData.nodes[selection.nodeIndex]
      if (node) {
        selectedNodeIds.add(node.id)
      }
    }
  }

  // Count selected nodes for each hero tree
  let bestMatch: HeroTreeData | null = null
  let maxCount = 0

  for (const heroTree of specData.heroTrees) {
    let count = 0
    for (const nodeId of heroTree.nodeIds) {
      if (selectedNodeIds.has(nodeId)) {
        count++
      }
    }

    if (count > maxCount) {
      maxCount = count
      bestMatch = heroTree
    }
  }

  // Only return a hero tree if at least one node is selected
  return maxCount > 0 ? bestMatch : null
}
