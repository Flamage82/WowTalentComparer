import { describe, it, expect } from 'vitest'
import { diffTalentBuilds, createDiffMap } from './talentDiff'
import type { ParsedTalentData, TalentNodeSelection } from './talentParser'

// Helper to create a minimal ParsedTalentData
function createBuild(
  specId: number,
  nodes: TalentNodeSelection[],
  specName?: string
): ParsedTalentData {
  return {
    version: 2,
    specId,
    specName,
    treeHash: 'test-hash',
    nodes,
    rawBytes: [],
  }
}

// Helper to create a node selection
function createNode(
  nodeIndex: number,
  isSelected: boolean,
  options?: {
    isPurchased?: boolean
    isPartiallyRanked?: boolean
    ranksPurchased?: number
    isChoiceNode?: boolean
    choiceEntryIndex?: number
  }
): TalentNodeSelection {
  return {
    nodeIndex,
    isSelected,
    ...options,
  }
}

describe('talentDiff', () => {
  describe('diffTalentBuilds', () => {
    it('should throw error when comparing different specs', () => {
      const buildA = createBuild(254, [], 'Marksmanship Hunter')
      const buildB = createBuild(253, [], 'Beast Mastery Hunter')

      expect(() => diffTalentBuilds(buildA, buildB)).toThrow(
        /Cannot compare different specs/
      )
    })

    it('should return empty summary when both builds are identical', () => {
      const nodes = [
        createNode(0, true, { isPurchased: true }),
        createNode(1, true, { isPurchased: true }),
        createNode(2, false),
      ]
      const buildA = createBuild(254, nodes, 'Marksmanship Hunter')
      const buildB = createBuild(254, [...nodes], 'Marksmanship Hunter')

      const result = diffTalentBuilds(buildA, buildB)

      expect(result.summary.added).toHaveLength(0)
      expect(result.summary.removed).toHaveLength(0)
      expect(result.summary.changed).toHaveLength(0)
    })

    it('should detect added nodes (in B but not in A)', () => {
      const buildA = createBuild(254, [
        createNode(0, true, { isPurchased: true }),
        createNode(1, false),
        createNode(2, false),
      ])
      const buildB = createBuild(254, [
        createNode(0, true, { isPurchased: true }),
        createNode(1, true, { isPurchased: true }), // Added
        createNode(2, true, { isPurchased: true }), // Added
      ])

      const result = diffTalentBuilds(buildA, buildB)

      expect(result.summary.added).toEqual([1, 2])
      expect(result.summary.removed).toHaveLength(0)
      expect(result.summary.changed).toHaveLength(0)

      const addedDiff = result.diffs.find(d => d.nodeIndex === 1)
      expect(addedDiff?.diffType).toBe('added')
      expect(addedDiff?.buildB?.isSelected).toBe(true)
      expect(addedDiff?.buildA).toBeUndefined()
    })

    it('should detect removed nodes (in A but not in B)', () => {
      const buildA = createBuild(254, [
        createNode(0, true, { isPurchased: true }),
        createNode(1, true, { isPurchased: true }),
        createNode(2, true, { isPurchased: true }),
      ])
      const buildB = createBuild(254, [
        createNode(0, true, { isPurchased: true }),
        createNode(1, false), // Removed
        createNode(2, false), // Removed
      ])

      const result = diffTalentBuilds(buildA, buildB)

      expect(result.summary.removed).toEqual([1, 2])
      expect(result.summary.added).toHaveLength(0)
      expect(result.summary.changed).toHaveLength(0)

      const removedDiff = result.diffs.find(d => d.nodeIndex === 1)
      expect(removedDiff?.diffType).toBe('removed')
      expect(removedDiff?.buildA?.isSelected).toBe(true)
      expect(removedDiff?.buildB).toBeUndefined()
    })

    it('should detect changed rank', () => {
      const buildA = createBuild(254, [
        createNode(0, true, {
          isPurchased: true,
          isPartiallyRanked: true,
          ranksPurchased: 1,
        }),
      ])
      const buildB = createBuild(254, [
        createNode(0, true, {
          isPurchased: true,
          isPartiallyRanked: true,
          ranksPurchased: 2,
        }),
      ])

      const result = diffTalentBuilds(buildA, buildB)

      expect(result.summary.changed).toEqual([0])
      const changedDiff = result.diffs.find(d => d.nodeIndex === 0)
      expect(changedDiff?.diffType).toBe('changed')
      expect(changedDiff?.changeDetails?.rankChange).toEqual({ from: 1, to: 2 })
    })

    it('should detect changed choice selection', () => {
      const buildA = createBuild(254, [
        createNode(0, true, {
          isPurchased: true,
          isChoiceNode: true,
          choiceEntryIndex: 0,
        }),
      ])
      const buildB = createBuild(254, [
        createNode(0, true, {
          isPurchased: true,
          isChoiceNode: true,
          choiceEntryIndex: 1,
        }),
      ])

      const result = diffTalentBuilds(buildA, buildB)

      expect(result.summary.changed).toEqual([0])
      const changedDiff = result.diffs.find(d => d.nodeIndex === 0)
      expect(changedDiff?.diffType).toBe('changed')
      expect(changedDiff?.changeDetails?.choiceChange).toEqual({ from: 0, to: 1 })
    })

    it('should handle both rank and choice changes', () => {
      const buildA = createBuild(254, [
        createNode(0, true, {
          isPurchased: true,
          isPartiallyRanked: true,
          ranksPurchased: 1,
          isChoiceNode: true,
          choiceEntryIndex: 0,
        }),
      ])
      const buildB = createBuild(254, [
        createNode(0, true, {
          isPurchased: true,
          isPartiallyRanked: true,
          ranksPurchased: 2,
          isChoiceNode: true,
          choiceEntryIndex: 1,
        }),
      ])

      const result = diffTalentBuilds(buildA, buildB)

      expect(result.summary.changed).toEqual([0])
      const changedDiff = result.diffs.find(d => d.nodeIndex === 0)
      expect(changedDiff?.changeDetails?.rankChange).toEqual({ from: 1, to: 2 })
      expect(changedDiff?.changeDetails?.choiceChange).toEqual({ from: 0, to: 1 })
    })

    it('should handle mixed changes (added, removed, changed)', () => {
      const buildA = createBuild(254, [
        createNode(0, true, { isPurchased: true }), // Will be removed
        createNode(1, true, { isPurchased: true, isPartiallyRanked: true, ranksPurchased: 1 }), // Will be changed
        createNode(2, false), // Will be added
        createNode(3, true, { isPurchased: true }), // Unchanged
      ])
      const buildB = createBuild(254, [
        createNode(0, false), // Removed
        createNode(1, true, { isPurchased: true, isPartiallyRanked: true, ranksPurchased: 2 }), // Changed
        createNode(2, true, { isPurchased: true }), // Added
        createNode(3, true, { isPurchased: true }), // Unchanged
      ])

      const result = diffTalentBuilds(buildA, buildB)

      expect(result.summary.removed).toEqual([0])
      expect(result.summary.changed).toEqual([1])
      expect(result.summary.added).toEqual([2])
    })

    it('should handle empty builds', () => {
      const buildA = createBuild(254, [])
      const buildB = createBuild(254, [])

      const result = diffTalentBuilds(buildA, buildB)

      expect(result.summary.added).toHaveLength(0)
      expect(result.summary.removed).toHaveLength(0)
      expect(result.summary.changed).toHaveLength(0)
      expect(result.diffs).toHaveLength(0)
    })

    it('should handle builds with different node counts', () => {
      const buildA = createBuild(254, [
        createNode(0, true, { isPurchased: true }),
      ])
      const buildB = createBuild(254, [
        createNode(0, true, { isPurchased: true }),
        createNode(1, true, { isPurchased: true }),
        createNode(2, true, { isPurchased: true }),
      ])

      const result = diffTalentBuilds(buildA, buildB)

      expect(result.summary.added).toEqual([1, 2])
    })

    it('should preserve specId and specName in result', () => {
      const buildA = createBuild(254, [], 'Marksmanship Hunter')
      const buildB = createBuild(254, [], 'Marksmanship Hunter')

      const result = diffTalentBuilds(buildA, buildB)

      expect(result.specId).toBe(254)
      expect(result.specName).toBe('Marksmanship Hunter')
    })

    it('should sort summary arrays by node index', () => {
      const buildA = createBuild(254, [
        createNode(5, true, { isPurchased: true }),
        createNode(1, true, { isPurchased: true }),
        createNode(10, true, { isPurchased: true }),
      ])
      const buildB = createBuild(254, [
        createNode(5, false),
        createNode(1, false),
        createNode(10, false),
      ])

      const result = diffTalentBuilds(buildA, buildB)

      expect(result.summary.removed).toEqual([1, 5, 10])
    })
  })

  describe('createDiffMap', () => {
    it('should create a map for O(1) lookup by node index', () => {
      const buildA = createBuild(254, [
        createNode(0, true, { isPurchased: true }),
        createNode(5, true, { isPurchased: true }),
        createNode(10, false),
      ])
      const buildB = createBuild(254, [
        createNode(0, true, { isPurchased: true }),
        createNode(5, false),
        createNode(10, true, { isPurchased: true }),
      ])

      const result = diffTalentBuilds(buildA, buildB)
      const diffMap = createDiffMap(result)

      expect(diffMap.get(0)?.diffType).toBe('unchanged')
      expect(diffMap.get(5)?.diffType).toBe('removed')
      expect(diffMap.get(10)?.diffType).toBe('added')
      expect(diffMap.get(99)).toBeUndefined()
    })
  })
})
