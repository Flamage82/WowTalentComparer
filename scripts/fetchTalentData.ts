/**
 * Fetches talent tree data from wago.tools and generates spec JSON files
 *
 * Run with: npm run fetch-data
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const WAGO_BASE = 'https://wago.tools/db2'

// Tables we need to fetch
const TABLES = [
  'ChrSpecialization',
  'TraitTree',
  'TraitTreeLoadout',
  'TraitNode',
  'TraitNodeEntry',
  'TraitNodeXTraitNodeEntry',
  'TraitDefinition',
  'TraitEdge',
  'SpellName',
] as const

type TableName = (typeof TABLES)[number]

interface ChrSpecialization {
  ID: number
  Name_lang: string
  ClassID: number
}

interface TraitTree {
  ID: number
  Field_12_0_1_65337_000_lang: string // Name field
}

interface TraitTreeLoadout {
  ID: number
  TraitTreeID: number
  ChrSpecializationID: number
}

interface TraitNode {
  ID: number
  TraitTreeID: number
  PosX: number
  PosY: number
  Type: number
  Flags: number
}

interface TraitNodeEntry {
  ID: number
  TraitDefinitionID: number
  MaxRanks: number
  NodeEntryType: number
}

interface TraitNodeXTraitNodeEntry {
  ID: number
  TraitNodeID: number
  TraitNodeEntryID: number
  _Index: number
}

interface TraitDefinition {
  ID: number
  SpellID: number
  OverrideIcon: number
  OverrideName_lang: string
}

interface TraitEdge {
  ID: number
  VisualStyle: number
  LeftTraitNodeID: number
  RightTraitNodeID: number
  Type: number
}

interface SpellName {
  ID: number
  Name_lang: string
}

// Output format for our app
interface SpecTalentData {
  specId: number
  specName: string
  className: string
  treeId: number
  nodes: TalentNodeData[]
  edges: TalentEdgeData[]
}

interface TalentNodeData {
  id: number
  posX: number
  posY: number
  type: number
  maxRanks: number
  entries: TalentEntryData[]
}

interface TalentEntryData {
  id: number
  definitionId: number
  spellId: number
  name: string
  maxRanks: number
  entryIndex: number
}

interface TalentEdgeData {
  fromNodeId: number
  toNodeId: number
  type: number
}

async function fetchCSV(table: TableName): Promise<string> {
  const url = `${WAGO_BASE}/${table}/csv`
  console.log(`Fetching ${table}...`)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${table}: ${response.status}`)
  }

  return response.text()
}

function parseCSV<T>(csv: string): T[] {
  // Handle multi-line quoted fields by parsing character by character
  const records: string[][] = []
  let currentRecord: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]
    const nextChar = csv[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"'
        i++
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      currentRecord.push(currentField)
      currentField = ''
    } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
      // End of record
      if (char === '\r') i++ // Skip \n in \r\n
      currentRecord.push(currentField)
      if (currentRecord.length > 1 || currentRecord[0] !== '') {
        records.push(currentRecord)
      }
      currentRecord = []
      currentField = ''
    } else if (char === '\r' && !inQuotes) {
      // Handle standalone \r as newline
      currentRecord.push(currentField)
      if (currentRecord.length > 1 || currentRecord[0] !== '') {
        records.push(currentRecord)
      }
      currentRecord = []
      currentField = ''
    } else {
      currentField += char
    }
  }

  // Don't forget the last field/record
  if (currentField || currentRecord.length > 0) {
    currentRecord.push(currentField)
    if (currentRecord.length > 1 || currentRecord[0] !== '') {
      records.push(currentRecord)
    }
  }

  if (records.length < 2) return []

  const headers = records[0]
  const results: T[] = []

  for (let i = 1; i < records.length; i++) {
    const values = records[i]
    const obj: Record<string, string | number> = {}

    headers.forEach((header, index) => {
      const value = values[index] || ''
      // Try to parse as number
      const num = Number(value)
      obj[header] = isNaN(num) || value === '' ? value : num
    })

    results.push(obj as T)
  }

  return results
}

// Class IDs to names
const CLASS_NAMES: Record<number, string> = {
  1: 'Warrior',
  2: 'Paladin',
  3: 'Hunter',
  4: 'Rogue',
  5: 'Priest',
  6: 'Death Knight',
  7: 'Shaman',
  8: 'Mage',
  9: 'Warlock',
  10: 'Monk',
  11: 'Druid',
  12: 'Demon Hunter',
  13: 'Evoker',
}

async function main() {
  console.log('Fetching talent data from wago.tools...\n')

  // Fetch all tables in parallel
  const [
    specsCsv,
    treesCsv,
    loadoutsCsv,
    nodesCsv,
    entriesCsv,
    nodeEntriesCsv,
    definitionsCsv,
    edgesCsv,
    spellNamesCsv,
  ] = await Promise.all(TABLES.map(fetchCSV))

  console.log('\nParsing CSV data...')

  const specs = parseCSV<ChrSpecialization>(specsCsv)
  const trees = parseCSV<TraitTree>(treesCsv)
  const loadouts = parseCSV<TraitTreeLoadout>(loadoutsCsv)
  const nodes = parseCSV<TraitNode>(nodesCsv)
  const entries = parseCSV<TraitNodeEntry>(entriesCsv)
  const nodeEntries = parseCSV<TraitNodeXTraitNodeEntry>(nodeEntriesCsv)
  const definitions = parseCSV<TraitDefinition>(definitionsCsv)
  const edges = parseCSV<TraitEdge>(edgesCsv)
  const spellNames = parseCSV<SpellName>(spellNamesCsv)

  console.log(`  Specs: ${specs.length}`)
  console.log(`  Trees: ${trees.length}`)
  console.log(`  Loadouts: ${loadouts.length}`)
  console.log(`  Nodes: ${nodes.length}`)
  console.log(`  Entries: ${entries.length}`)
  console.log(`  NodeEntries: ${nodeEntries.length}`)
  console.log(`  Definitions: ${definitions.length}`)
  console.log(`  Edges: ${edges.length}`)
  console.log(`  SpellNames: ${spellNames.length}`)

  // Build lookup maps
  const nodeById = new Map(nodes.map(n => [n.ID, n]))
  const entryById = new Map(entries.map(e => [e.ID, e]))
  const definitionById = new Map(definitions.map(d => [d.ID, d]))
  const spellNameById = new Map(spellNames.map(s => [s.ID, s.Name_lang]))

  // Map nodes to their entries
  const nodeToEntries = new Map<number, TraitNodeXTraitNodeEntry[]>()
  for (const ne of nodeEntries) {
    const existing = nodeToEntries.get(ne.TraitNodeID) || []
    existing.push(ne)
    nodeToEntries.set(ne.TraitNodeID, existing)
  }

  // Group nodes by tree
  const treeToNodes = new Map<number, TraitNode[]>()
  for (const node of nodes) {
    const existing = treeToNodes.get(node.TraitTreeID) || []
    existing.push(node)
    treeToNodes.set(node.TraitTreeID, existing)
  }

  // Group edges by tree (using the from-node's tree)
  const treeToEdges = new Map<number, TraitEdge[]>()
  for (const edge of edges) {
    const fromNode = nodeById.get(edge.LeftTraitNodeID)
    if (fromNode) {
      const existing = treeToEdges.get(fromNode.TraitTreeID) || []
      existing.push(edge)
      treeToEdges.set(fromNode.TraitTreeID, existing)
    }
  }

  // Map spec to tree via loadouts
  const specToTreeId = new Map<number, number>()
  for (const loadout of loadouts) {
    // Take the first tree for each spec
    if (!specToTreeId.has(loadout.ChrSpecializationID)) {
      specToTreeId.set(loadout.ChrSpecializationID, loadout.TraitTreeID)
    }
  }

  // Filter to player specs only
  const playerSpecs = specs.filter(s =>
    s.ClassID >= 1 && s.ClassID <= 13 &&
    s.Name_lang && s.Name_lang.length > 0 &&
    specToTreeId.has(s.ID)
  )

  console.log(`\nProcessing ${playerSpecs.length} player specs with trees...`)

  // Create output directory
  const outDir = join(process.cwd(), 'src', 'data', 'specs')
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true })
  }

  const specDataList: SpecTalentData[] = []

  for (const spec of playerSpecs) {
    const treeId = specToTreeId.get(spec.ID)!
    const className = CLASS_NAMES[spec.ClassID] || 'Unknown'

    const treeNodeList = treeToNodes.get(treeId) || []
    const treeEdgeList = treeToEdges.get(treeId) || []

    // Sort nodes by position (top to bottom, left to right) for consistent ordering
    treeNodeList.sort((a, b) => {
      if (a.PosY !== b.PosY) return a.PosY - b.PosY
      return a.PosX - b.PosX
    })

    const talentNodes: TalentNodeData[] = []

    for (const node of treeNodeList) {
      const nodeEntryList = nodeToEntries.get(node.ID) || []
      // Sort entries by their index
      nodeEntryList.sort((a, b) => a._Index - b._Index)

      const talentEntries: TalentEntryData[] = []

      for (const ne of nodeEntryList) {
        const entry = entryById.get(ne.TraitNodeEntryID)
        if (!entry) continue

        const definition = definitionById.get(entry.TraitDefinitionID)
        const spellId = definition?.SpellID || 0
        // Use override name if available, otherwise look up spell name
        const name = definition?.OverrideName_lang || spellNameById.get(spellId) || ''

        talentEntries.push({
          id: entry.ID,
          definitionId: entry.TraitDefinitionID,
          spellId,
          name,
          maxRanks: entry.MaxRanks,
          entryIndex: ne._Index,
        })
      }

      talentNodes.push({
        id: node.ID,
        posX: node.PosX,
        posY: node.PosY,
        type: node.Type,
        maxRanks: talentEntries[0]?.maxRanks || 1,
        entries: talentEntries,
      })
    }

    const talentEdges: TalentEdgeData[] = treeEdgeList.map(e => ({
      fromNodeId: e.LeftTraitNodeID,
      toNodeId: e.RightTraitNodeID,
      type: e.Type,
    }))

    const specData: SpecTalentData = {
      specId: spec.ID,
      specName: spec.Name_lang,
      className,
      treeId,
      nodes: talentNodes,
      edges: talentEdges,
    }

    specDataList.push(specData)

    // Write individual spec file
    const filename = join(outDir, `${spec.ID}.json`)
    writeFileSync(filename, JSON.stringify(specData, null, 2))
    console.log(`  ${spec.ID}.json - ${spec.Name_lang} ${className} (${talentNodes.length} nodes, ${talentEdges.length} edges)`)
  }

  // Write index file
  const indexData = specDataList.map(s => ({
    specId: s.specId,
    specName: s.specName,
    className: s.className,
    nodeCount: s.nodes.length,
  }))
  writeFileSync(join(outDir, 'index.json'), JSON.stringify(indexData, null, 2))

  console.log(`\nDone! Generated ${specDataList.length} spec files in src/data/specs/`)
}

main().catch(console.error)
