import { describe, it, expect } from 'vitest'
import { parseTalentString } from './talentParser'

// Sample Marksmanship Hunter talent string
const SAMPLE_TALENT_STRING = 'C4PAAAAAAAAAAAAAAAAAAAAAAwCMwwohBwMYDAAAAAAAAYGzMzYbGzYMDGTzYMzYZbzMzMMzMMzsMGzywMDAAgxYAwoNwAsN'

// User's actual talent string for Marksmanship Hunter with Sentinel hero tree
const USER_TALENT_STRING = 'C4PAAAAAAAAAAAAAAAAAAAAAAwCMwwohBwMYDAAAAAAAAYGzYGmxMzYGMmmxYGz22mZmZYmZYmZZwsMYGAAAzMGAMTbMMAbD'

describe('talentParser', () => {
  describe('parseTalentString', () => {
    it('should decode the base64 string without throwing', () => {
      expect(() => parseTalentString(SAMPLE_TALENT_STRING)).not.toThrow()
    })

    it('should parse version correctly', () => {
      const result = parseTalentString(SAMPLE_TALENT_STRING)
      expect(result.version).toBe(2)
    })

    it('should identify spec as Marksmanship Hunter', () => {
      const result = parseTalentString(SAMPLE_TALENT_STRING)
      expect(result.specId).toBe(254)
      expect(result.specName).toBe('Marksmanship Hunter')
    })

    it('should extract tree hash', () => {
      const result = parseTalentString(SAMPLE_TALENT_STRING)
      expect(result.treeHash).toBeDefined()
      expect(result.treeHash.length).toBe(32) // 16 bytes = 32 hex chars
    })

    it('should parse reasonable number of nodes', () => {
      const result = parseTalentString(SAMPLE_TALENT_STRING)
      // A typical talent tree has ~100-200 nodes
      expect(result.nodes.length).toBeGreaterThan(100)
      expect(result.nodes.length).toBeLessThan(300)
    })

    it('should have selected nodes', () => {
      const result = parseTalentString(SAMPLE_TALENT_STRING)
      const selectedNodes = result.nodes.filter(n => n.isSelected)
      // A full build typically has 60-70 selected talents
      expect(selectedNodes.length).toBeGreaterThan(50)
      expect(selectedNodes.length).toBeLessThan(100)
    })

    it('should have choice nodes with valid indices', () => {
      const result = parseTalentString(SAMPLE_TALENT_STRING)
      const choiceNodes = result.nodes.filter(n => n.isChoiceNode)

      expect(choiceNodes.length).toBeGreaterThan(0)
      choiceNodes.forEach(node => {
        expect(node.choiceEntryIndex).toBeDefined()
        expect(node.choiceEntryIndex).toBeGreaterThanOrEqual(0)
        expect(node.choiceEntryIndex).toBeLessThanOrEqual(3) // 2 bits = max 3
      })
    })

    it('should reject invalid characters', () => {
      expect(() => parseTalentString('invalid!@#$')).toThrow(/Invalid character/)
    })

    it('should reject strings that are too short', () => {
      expect(() => parseTalentString('ABC')).toThrow(/too short/)
    })

    it('should handle whitespace in input', () => {
      const withWhitespace = '  ' + SAMPLE_TALENT_STRING + '  \n'
      expect(() => parseTalentString(withWhitespace)).not.toThrow()
    })
  })

  describe('talent selection verification', () => {
    // These indices are based on node ID ordering in the spec data (254.json)
    // Verified with debugTalentParsing.ts script
    const AIMED_SHOT_INDEX = 142 // Aimed Shot node index when sorted by ID
    const SENTINEL_INDEX = 17 // Sentinel hero talent index
    const RAPID_FIRE_INDEX = 129 // Rapid Fire node index

    it('should select Aimed Shot at the correct index (spec tree root)', () => {
      const result = parseTalentString(USER_TALENT_STRING)
      const selectedIndices = new Set(
        result.nodes.filter(n => n.isSelected).map(n => n.nodeIndex)
      )

      // Aimed Shot should be selected - it's the MM spec tree root
      expect(selectedIndices.has(AIMED_SHOT_INDEX)).toBe(true)
    })

    it('should select Sentinel hero talent', () => {
      const result = parseTalentString(USER_TALENT_STRING)
      const selectedIndices = new Set(
        result.nodes.filter(n => n.isSelected).map(n => n.nodeIndex)
      )

      // Sentinel should be selected - it's the hero tree shown in screenshot
      expect(selectedIndices.has(SENTINEL_INDEX)).toBe(true)
    })

    it('should select Rapid Fire (key MM talent)', () => {
      const result = parseTalentString(USER_TALENT_STRING)
      const selectedIndices = new Set(
        result.nodes.filter(n => n.isSelected).map(n => n.nodeIndex)
      )

      expect(selectedIndices.has(RAPID_FIRE_INDEX)).toBe(true)
    })

    it('should have approximately 67 selected talents', () => {
      const result = parseTalentString(USER_TALENT_STRING)
      const selectedCount = result.nodes.filter(n => n.isSelected).length

      // The debug script showed 67 selected talents
      expect(selectedCount).toBe(67)
    })
  })
})
