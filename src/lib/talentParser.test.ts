import { describe, it, expect } from 'vitest'
import { parseTalentString } from './talentParser'

// Sample Marksmanship Hunter talent string
const SAMPLE_TALENT_STRING = 'C4PAAAAAAAAAAAAAAAAAAAAAAwCMwwohBwMYDAAAAAAAAYGzMzYbGzYMDGTzYMzYZbzMzMMzMMzsMGzywMDAAgxYAwoNwAsN'

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
})
