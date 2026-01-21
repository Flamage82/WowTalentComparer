/**
 * WoW Talent String Parser
 *
 * Talent strings are base64 encoded with the following structure:
 * - Version (8 bits)
 * - Spec ID (16 bits)
 * - Tree Hash (128 bits = 16 bytes)
 * - Per-node data (variable length, bit-packed):
 *   - isNodeSelected (1 bit)
 *   - if selected: isNodePurchased (1 bit)
 *   - if purchased: isPartiallyRanked (1 bit)
 *   - if partially ranked: ranksPurchased (6 bits)
 *   - if purchased: isChoiceNode (1 bit)
 *   - if choice: choiceEntryIndex (2 bits)
 */

export interface TalentNodeSelection {
  nodeIndex: number
  isSelected: boolean
  isPurchased?: boolean
  isPartiallyRanked?: boolean
  ranksPurchased?: number
  isChoiceNode?: boolean
  choiceEntryIndex?: number
}

export interface ParsedTalentData {
  version: number
  specId: number
  specName?: string
  treeHash: string
  nodes: TalentNodeSelection[]
  rawBytes: number[]
}

// Spec ID to name mapping
const SPEC_NAMES: Record<number, string> = {
  62: 'Arcane Mage',
  63: 'Fire Mage',
  64: 'Frost Mage',
  65: 'Holy Paladin',
  66: 'Protection Paladin',
  70: 'Retribution Paladin',
  71: 'Arms Warrior',
  72: 'Fury Warrior',
  73: 'Protection Warrior',
  102: 'Balance Druid',
  103: 'Feral Druid',
  104: 'Guardian Druid',
  105: 'Restoration Druid',
  250: 'Blood Death Knight',
  251: 'Frost Death Knight',
  252: 'Unholy Death Knight',
  253: 'Beast Mastery Hunter',
  254: 'Marksmanship Hunter',
  255: 'Survival Hunter',
  256: 'Discipline Priest',
  257: 'Holy Priest',
  258: 'Shadow Priest',
  259: 'Assassination Rogue',
  260: 'Outlaw Rogue',
  261: 'Subtlety Rogue',
  262: 'Elemental Shaman',
  263: 'Enhancement Shaman',
  264: 'Restoration Shaman',
  265: 'Affliction Warlock',
  266: 'Demonology Warlock',
  267: 'Destruction Warlock',
  268: 'Brewmaster Monk',
  270: 'Mistweaver Monk',
  269: 'Windwalker Monk',
  577: 'Havoc Demon Hunter',
  581: 'Vengeance Demon Hunter',
  1467: 'Devastation Evoker',
  1468: 'Preservation Evoker',
  1473: 'Augmentation Evoker',
}

class BitReader {
  private data: Uint8Array
  private bitPosition: number = 0

  constructor(data: Uint8Array) {
    this.data = data
  }

  readBits(numBits: number): number {
    let result = 0
    for (let i = 0; i < numBits; i++) {
      const byteIndex = Math.floor(this.bitPosition / 8)
      const bitIndex = this.bitPosition % 8

      if (byteIndex >= this.data.length) {
        return result // Return partial result if we run out of data
      }

      const bit = (this.data[byteIndex] >> bitIndex) & 1
      result |= bit << i
      this.bitPosition++
    }
    return result
  }

  readBit(): boolean {
    return this.readBits(1) === 1
  }

  get bitsRemaining(): number {
    return this.data.length * 8 - this.bitPosition
  }

  get currentPosition(): number {
    return this.bitPosition
  }
}

function decodeBase64(input: string): Uint8Array {
  // WoW uses standard base64 alphabet
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  // Create reverse lookup
  const lookup: Record<string, number> = {}
  for (let i = 0; i < alphabet.length; i++) {
    lookup[alphabet[i]] = i
  }

  // Remove any whitespace
  const cleanInput = input.replace(/\s/g, '')

  // Calculate output length
  const outputLength = Math.floor((cleanInput.length * 6) / 8)
  const output = new Uint8Array(outputLength)

  let bitBuffer = 0
  let bitsInBuffer = 0
  let outputIndex = 0

  for (const char of cleanInput) {
    const value = lookup[char]
    if (value === undefined) {
      throw new Error(`Invalid character in talent string: ${char}`)
    }

    bitBuffer |= value << bitsInBuffer
    bitsInBuffer += 6

    while (bitsInBuffer >= 8 && outputIndex < outputLength) {
      output[outputIndex++] = bitBuffer & 0xff
      bitBuffer >>= 8
      bitsInBuffer -= 8
    }
  }

  return output
}

export function parseTalentString(talentString: string): ParsedTalentData {
  // Decode the base64 string
  const bytes = decodeBase64(talentString.trim())

  // Store raw bytes for debugging
  const rawBytes = Array.from(bytes)

  if (bytes.length < 19) {
    throw new Error(`Talent string too short - got ${bytes.length} bytes, expected at least 19`)
  }

  const reader = new BitReader(bytes)

  // Read header (152 bits total)
  // Version: 8 bits
  const version = reader.readBits(8)

  // Spec ID: 16 bits
  const specId = reader.readBits(16)

  // Tree hash: 128 bits (16 bytes)
  const hashBytes: number[] = []
  for (let i = 0; i < 16; i++) {
    hashBytes.push(reader.readBits(8))
  }
  const treeHash = hashBytes.map(b => b.toString(16).padStart(2, '0')).join('')

  // Parse talent node selections
  // The format iterates through all nodes in the tree in order
  // Each node has variable-length encoding based on its selection state
  const nodes: TalentNodeSelection[] = []
  let nodeIndex = 0

  while (reader.bitsRemaining >= 1) {
    const isSelected = reader.readBit()

    const node: TalentNodeSelection = {
      nodeIndex,
      isSelected,
    }

    if (isSelected) {
      // Is this node purchased (vs granted free)?
      node.isPurchased = reader.readBit()

      if (node.isPurchased) {
        // Is it partially ranked?
        node.isPartiallyRanked = reader.readBit()

        if (node.isPartiallyRanked) {
          // Read the number of ranks purchased (6 bits)
          node.ranksPurchased = reader.readBits(6)
        }

        // Is this a choice node?
        node.isChoiceNode = reader.readBit()

        if (node.isChoiceNode) {
          // Read choice entry index (2 bits)
          node.choiceEntryIndex = reader.readBits(2)
        }
      }
    }

    nodes.push(node)
    nodeIndex++
  }

  return {
    version,
    specId,
    specName: SPEC_NAMES[specId],
    treeHash,
    nodes,
    rawBytes,
  }
}

// Debug helper to show hex dump
export function hexDump(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join(' ')
}
