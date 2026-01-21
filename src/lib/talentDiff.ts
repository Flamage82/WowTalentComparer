import type { ParsedTalentData, TalentNodeSelection } from './talentParser'

export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged'

export interface TalentDiffNode {
  nodeIndex: number
  diffType: DiffType
  buildA?: TalentNodeSelection
  buildB?: TalentNodeSelection
  changeDetails?: {
    rankChange?: { from: number; to: number }
    choiceChange?: { from: number; to: number }
  }
}

export interface TalentDiffResult {
  specId: number
  specName?: string
  diffs: TalentDiffNode[]
  summary: {
    added: number[]
    removed: number[]
    changed: number[]
  }
}

/**
 * Compare two talent builds and return the differences.
 * Build A is considered the "baseline" and Build B is the "new" build.
 * - Added: selected in B but not in A
 * - Removed: selected in A but not in B
 * - Changed: selected in both but with different rank or choice
 */
export function diffTalentBuilds(
  buildA: ParsedTalentData,
  buildB: ParsedTalentData
): TalentDiffResult {
  // Validate specs match
  if (buildA.specId !== buildB.specId) {
    throw new Error(
      `Cannot compare different specs: ${buildA.specName || buildA.specId} vs ${buildB.specName || buildB.specId}`
    )
  }

  // Create maps for quick lookup
  const nodesA = new Map<number, TalentNodeSelection>()
  const nodesB = new Map<number, TalentNodeSelection>()

  for (const node of buildA.nodes) {
    nodesA.set(node.nodeIndex, node)
  }
  for (const node of buildB.nodes) {
    nodesB.set(node.nodeIndex, node)
  }

  // Find all unique node indices
  const allIndices = new Set<number>([
    ...buildA.nodes.map(n => n.nodeIndex),
    ...buildB.nodes.map(n => n.nodeIndex),
  ])

  const diffs: TalentDiffNode[] = []
  const summary = {
    added: [] as number[],
    removed: [] as number[],
    changed: [] as number[],
  }

  for (const nodeIndex of allIndices) {
    const nodeA = nodesA.get(nodeIndex)
    const nodeB = nodesB.get(nodeIndex)

    const selectedA = nodeA?.isSelected ?? false
    const selectedB = nodeB?.isSelected ?? false

    if (selectedB && !selectedA) {
      // Added in B
      diffs.push({
        nodeIndex,
        diffType: 'added',
        buildB: nodeB,
      })
      summary.added.push(nodeIndex)
    } else if (selectedA && !selectedB) {
      // Removed from A
      diffs.push({
        nodeIndex,
        diffType: 'removed',
        buildA: nodeA,
      })
      summary.removed.push(nodeIndex)
    } else if (selectedA && selectedB) {
      // Both selected - check for changes
      const changeDetails = getChangeDetails(nodeA!, nodeB!)

      if (changeDetails) {
        diffs.push({
          nodeIndex,
          diffType: 'changed',
          buildA: nodeA,
          buildB: nodeB,
          changeDetails,
        })
        summary.changed.push(nodeIndex)
      } else {
        // Unchanged
        diffs.push({
          nodeIndex,
          diffType: 'unchanged',
          buildA: nodeA,
          buildB: nodeB,
        })
      }
    }
    // If neither selected, skip (not relevant to diff)
  }

  // Sort summary arrays for consistent output
  summary.added.sort((a, b) => a - b)
  summary.removed.sort((a, b) => a - b)
  summary.changed.sort((a, b) => a - b)

  return {
    specId: buildA.specId,
    specName: buildA.specName,
    diffs,
    summary,
  }
}

/**
 * Check if two selected nodes have different configurations.
 * Returns change details if different, null if identical.
 */
function getChangeDetails(
  nodeA: TalentNodeSelection,
  nodeB: TalentNodeSelection
): TalentDiffNode['changeDetails'] | null {
  const changes: TalentDiffNode['changeDetails'] = {}
  let hasChanges = false

  // Compare ranks if at least one is partially ranked
  if (nodeA.isPartiallyRanked || nodeB.isPartiallyRanked) {
    const effectiveRankA = nodeA.ranksPurchased ?? (nodeA.isPartiallyRanked ? 1 : 0)
    const effectiveRankB = nodeB.ranksPurchased ?? (nodeB.isPartiallyRanked ? 1 : 0)

    if (effectiveRankA !== effectiveRankB) {
      changes.rankChange = { from: effectiveRankA, to: effectiveRankB }
      hasChanges = true
    }
  }

  // Compare choice selections
  if (nodeA.isChoiceNode || nodeB.isChoiceNode) {
    const choiceA = nodeA.choiceEntryIndex ?? 0
    const choiceB = nodeB.choiceEntryIndex ?? 0

    if (choiceA !== choiceB) {
      changes.choiceChange = { from: choiceA, to: choiceB }
      hasChanges = true
    }
  }

  return hasChanges ? changes : null
}

/**
 * Create a Map from diff result for O(1) lookup by node index.
 */
export function createDiffMap(diffResult: TalentDiffResult): Map<number, TalentDiffNode> {
  const map = new Map<number, TalentDiffNode>()
  for (const diff of diffResult.diffs) {
    map.set(diff.nodeIndex, diff)
  }
  return map
}
