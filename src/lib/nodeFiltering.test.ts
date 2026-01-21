import { describe, it, expect } from 'vitest'
import { deduplicateOverlappingNodes } from './nodeFiltering'
import type { TalentNodeData } from '../data/types'

// Helper to create a minimal node for testing
function createNode(id: number, posX: number, posY: number, type = 0): TalentNodeData {
  return {
    id,
    posX,
    posY,
    type,
    maxRanks: 1,
    entries: [{
      id: id * 100,
      definitionId: id * 100,
      spellId: id * 1000,
      name: `Spell ${id}`,
      iconId: 0,
      maxRanks: 1,
      entryIndex: 0,
    }],
  }
}

describe('deduplicateOverlappingNodes', () => {
  it('should keep all nodes when no overlap exists', () => {
    const nodes: TalentNodeData[] = [
      createNode(1, 100, 100),
      createNode(2, 200, 200),
      createNode(3, 300, 300),
    ]
    const result = deduplicateOverlappingNodes(nodes, new Set(), new Set())
    expect(result).toHaveLength(3)
    expect(result.map(n => n.id)).toEqual([1, 2, 3])
  })

  it('should deduplicate nodes at same position, preferring selected hero tree node', () => {
    // Simulating the real bug: Node 103957 (Trick Shots/Aspect of Hydra) and 109321 (Strike as One)
    // both at position (13800, 3300)
    const nodes: TalentNodeData[] = [
      createNode(103957, 13800, 3300, 2), // Choice node from selected hero tree
      createNode(109321, 13800, 3300, 0), // Single node from unselected hero tree
    ]
    const selectedHeroNodeIds = new Set([103957])
    const heroTreeNodeIds = new Set([103957, 109321])

    const result = deduplicateOverlappingNodes(nodes, selectedHeroNodeIds, heroTreeNodeIds)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(103957) // Should keep the selected hero tree node
  })

  it('should deduplicate in reverse order too (109321 first in array)', () => {
    // Same test but with nodes in different order to ensure order doesn't matter
    const nodes: TalentNodeData[] = [
      createNode(109321, 13800, 3300, 0), // Single node from unselected hero tree
      createNode(103957, 13800, 3300, 2), // Choice node from selected hero tree
    ]
    const selectedHeroNodeIds = new Set([103957])
    const heroTreeNodeIds = new Set([103957, 109321])

    const result = deduplicateOverlappingNodes(nodes, selectedHeroNodeIds, heroTreeNodeIds)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(103957) // Should still prefer the selected hero tree node
  })

  it('should keep ALL nodes when overlapping nodes are mixed (hero + non-hero)', () => {
    // If a hero tree node and a non-hero tree node share a position,
    // keep both - they're from different tree types
    const nodes: TalentNodeData[] = [
      createNode(1, 100, 100), // hero tree node
      createNode(2, 100, 100), // non-hero tree node (class/spec tree)
    ]
    const selectedHeroNodeIds = new Set<number>()
    const heroTreeNodeIds = new Set([1]) // Only node 1 is a hero tree node

    const result = deduplicateOverlappingNodes(nodes, selectedHeroNodeIds, heroTreeNodeIds)

    // Both should be kept since they're from different tree types
    expect(result).toHaveLength(2)
    expect(result.map(n => n.id).sort()).toEqual([1, 2])
  })

  it('should handle multiple overlapping positions independently (all hero nodes)', () => {
    const nodes: TalentNodeData[] = [
      // Position A: (100, 100) - two overlapping hero tree nodes
      createNode(1, 100, 100),
      createNode(2, 100, 100),
      // Position B: (200, 200) - two overlapping hero tree nodes
      createNode(3, 200, 200),
      createNode(4, 200, 200),
      // Position C: (300, 300) - single non-hero node
      createNode(5, 300, 300),
    ]
    // All overlapping nodes (1,2,3,4) are hero tree nodes
    const selectedHeroNodeIds = new Set([1, 3])
    const heroTreeNodeIds = new Set([1, 2, 3, 4])

    const result = deduplicateOverlappingNodes(nodes, selectedHeroNodeIds, heroTreeNodeIds)

    expect(result).toHaveLength(3) // One from each position
    expect(result.map(n => n.id).sort()).toEqual([1, 3, 5])
  })

  it('should fall back to first node when no preference criteria match', () => {
    const nodes: TalentNodeData[] = [
      createNode(1, 100, 100),
      createNode(2, 100, 100),
    ]
    // Both are hero tree nodes, neither is selected
    const selectedHeroNodeIds = new Set<number>()
    const heroTreeNodeIds = new Set([1, 2])

    const result = deduplicateOverlappingNodes(nodes, selectedHeroNodeIds, heroTreeNodeIds)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1) // Should return first node as fallback
  })

  it('should preserve node data (entries, type, etc.) in output', () => {
    const nodeWithEntries: TalentNodeData = {
      id: 103957,
      posX: 13800,
      posY: 3300,
      type: 2,
      maxRanks: 1,
      entries: [
        {
          id: 128378,
          definitionId: 133184,
          spellId: 257621,
          name: 'Trick Shots',
          iconId: 2065591,
          maxRanks: 1,
          entryIndex: 100,
        },
        {
          id: 128377,
          definitionId: 133183,
          spellId: 470945,
          name: 'Aspect of the Hydra',
          iconId: 6352451,
          maxRanks: 1,
          entryIndex: 200,
        },
      ],
    }
    const otherNode = createNode(109321, 13800, 3300, 0)

    const nodes = [nodeWithEntries, otherNode]
    const selectedHeroNodeIds = new Set([103957])
    const heroTreeNodeIds = new Set([103957, 109321])

    const result = deduplicateOverlappingNodes(nodes, selectedHeroNodeIds, heroTreeNodeIds)

    expect(result).toHaveLength(1)
    expect(result[0]).toBe(nodeWithEntries) // Should be the exact same object
    expect(result[0].entries).toHaveLength(2)
    expect(result[0].entries[0].name).toBe('Trick Shots')
    expect(result[0].entries[1].name).toBe('Aspect of the Hydra')
  })
})
