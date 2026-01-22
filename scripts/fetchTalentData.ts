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
  'SpellMisc',
  'TraitCond',
  'TraitNodeXTraitCond',
  'TraitNodeGroupXTraitCond',
  'TraitNodeGroupXTraitNode',
  'SpecSetMember',
  'TraitSubTree',
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
  TraitSubTreeID: number
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

interface SpellMisc {
  ID: number
  SpellID: number
  SpellIconFileDataID: number
}

interface TraitCond {
  ID: number
  CondType: number
  TraitTreeID: number
  SpecSetID: number
  TraitNodeGroupID: number
  TraitNodeID: number
}

interface TraitNodeXTraitCond {
  ID: number
  TraitCondID: number
  TraitNodeID: number
}

interface TraitNodeGroupXTraitCond {
  ID: number
  TraitCondID: number
  TraitNodeGroupID: number
}

interface TraitNodeGroupXTraitNode {
  ID: number
  TraitNodeGroupID: number
  TraitNodeID: number
  _Index: number
}

interface SpecSetMember {
  ID: number
  ChrSpecializationID: number
  SpecSet: number
}

interface TraitSubTree {
  ID: number
  Name_lang: string
  TraitTreeID: number
}

// Output format for our app
interface SpecTalentData {
  specId: number
  specName: string
  className: string
  treeId: number
  nodes: TalentNodeData[]
  edges: TalentEdgeData[]
  heroTrees: HeroTreeData[]
}

interface HeroTreeData {
  id: number
  name: string
  nodeIds: number[]
}

interface TalentNodeData {
  id: number
  posX: number
  posY: number
  type: number
  maxRanks: number
  entries: TalentEntryData[]
  allowedSpecs?: number[] // Specs that can use this node (empty/undefined = all specs)
}

interface TalentEntryData {
  id: number
  definitionId: number
  spellId: number
  name: string
  iconId: number
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
    spellMiscCsv,
    traitCondCsv,
    traitNodeXTraitCondCsv,
    traitNodeGroupXTraitCondCsv,
    traitNodeGroupXTraitNodeCsv,
    specSetMemberCsv,
    traitSubTreeCsv,
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
  const spellMiscs = parseCSV<SpellMisc>(spellMiscCsv)
  const traitConds = parseCSV<TraitCond>(traitCondCsv)
  const traitNodeXTraitConds = parseCSV<TraitNodeXTraitCond>(traitNodeXTraitCondCsv)
  const traitNodeGroupXTraitConds = parseCSV<TraitNodeGroupXTraitCond>(traitNodeGroupXTraitCondCsv)
  const traitNodeGroupXTraitNodes = parseCSV<TraitNodeGroupXTraitNode>(traitNodeGroupXTraitNodeCsv)
  const specSetMembers = parseCSV<SpecSetMember>(specSetMemberCsv)
  const traitSubTrees = parseCSV<TraitSubTree>(traitSubTreeCsv)

  console.log(`  Specs: ${specs.length}`)
  console.log(`  Trees: ${trees.length}`)
  console.log(`  Loadouts: ${loadouts.length}`)
  console.log(`  Nodes: ${nodes.length}`)
  console.log(`  Entries: ${entries.length}`)
  console.log(`  NodeEntries: ${nodeEntries.length}`)
  console.log(`  Definitions: ${definitions.length}`)
  console.log(`  Edges: ${edges.length}`)
  console.log(`  SpellNames: ${spellNames.length}`)
  console.log(`  SpellMiscs: ${spellMiscs.length}`)
  console.log(`  TraitConds: ${traitConds.length}`)
  console.log(`  TraitNodeXTraitConds: ${traitNodeXTraitConds.length}`)
  console.log(`  TraitNodeGroupXTraitConds: ${traitNodeGroupXTraitConds.length}`)
  console.log(`  TraitNodeGroupXTraitNodes: ${traitNodeGroupXTraitNodes.length}`)
  console.log(`  SpecSetMembers: ${specSetMembers.length}`)
  console.log(`  TraitSubTrees: ${traitSubTrees.length}`)

  // Build lookup maps
  const nodeById = new Map(nodes.map(n => [n.ID, n]))
  const entryById = new Map(entries.map(e => [e.ID, e]))
  const definitionById = new Map(definitions.map(d => [d.ID, d]))
  const spellNameById = new Map(spellNames.map(s => [s.ID, s.Name_lang]))
  // Map spell ID to icon FileDataID
  const spellIconById = new Map(spellMiscs.map(s => [s.SpellID, s.SpellIconFileDataID]))

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

  // Build spec restriction mapping
  // 1. SpecSetID -> [SpecIDs] mapping
  const specSetToSpecIds = new Map<number, number[]>()
  for (const member of specSetMembers) {
    const existing = specSetToSpecIds.get(member.SpecSet) || []
    existing.push(member.ChrSpecializationID)
    specSetToSpecIds.set(member.SpecSet, existing)
  }

  // 2. Build TraitCond lookup
  const traitCondById = new Map(traitConds.map(c => [c.ID, c]))

  // 3. Build NodeGroupID -> [AllowedSpecIDs] mapping from group conditions
  const nodeGroupToAllowedSpecs = new Map<number, number[]>()
  for (const groupCond of traitNodeGroupXTraitConds) {
    const cond = traitCondById.get(groupCond.TraitCondID)
    // CondType 1 = spec restriction
    if (cond && cond.CondType === 1 && cond.SpecSetID > 0) {
      const specIds = specSetToSpecIds.get(cond.SpecSetID) || []
      if (specIds.length > 0) {
        const existing = nodeGroupToAllowedSpecs.get(groupCond.TraitNodeGroupID) || []
        nodeGroupToAllowedSpecs.set(groupCond.TraitNodeGroupID, [...existing, ...specIds])
      }
    }
  }

  // 4. Build NodeID -> [AllowedSpecIDs] mapping
  const nodeToAllowedSpecs = new Map<number, number[]>()

  // From direct node conditions
  for (const nodeCond of traitNodeXTraitConds) {
    const cond = traitCondById.get(nodeCond.TraitCondID)
    if (cond && cond.CondType === 1 && cond.SpecSetID > 0) {
      const specIds = specSetToSpecIds.get(cond.SpecSetID) || []
      if (specIds.length > 0) {
        const existing = nodeToAllowedSpecs.get(nodeCond.TraitNodeID) || []
        nodeToAllowedSpecs.set(nodeCond.TraitNodeID, [...existing, ...specIds])
      }
    }
  }

  // From node group membership
  for (const groupNode of traitNodeGroupXTraitNodes) {
    const allowedSpecs = nodeGroupToAllowedSpecs.get(groupNode.TraitNodeGroupID)
    if (allowedSpecs && allowedSpecs.length > 0) {
      const existing = nodeToAllowedSpecs.get(groupNode.TraitNodeID) || []
      nodeToAllowedSpecs.set(groupNode.TraitNodeID, [...existing, ...allowedSpecs])
    }
  }

  console.log(`\nBuilt spec restrictions for ${nodeToAllowedSpecs.size} nodes`)

  // Build hero tree mappings
  const subTreeById = new Map(traitSubTrees.map(st => [st.ID, st]))

  // Map subtree ID to its node IDs (from TraitNode.TraitSubTreeID)
  const subTreeToNodeIds = new Map<number, number[]>()
  for (const node of nodes) {
    if (node.TraitSubTreeID && node.TraitSubTreeID > 0) {
      const existing = subTreeToNodeIds.get(node.TraitSubTreeID) || []
      existing.push(node.ID)
      subTreeToNodeIds.set(node.TraitSubTreeID, existing)
    }
  }

  // Map tree ID to its subtrees (from TraitSubTree.TraitTreeID)
  const treeToSubTreeIds = new Map<number, Set<number>>()
  for (const subTree of traitSubTrees) {
    if (subTree.TraitTreeID && subTree.TraitTreeID > 0) {
      const existing = treeToSubTreeIds.get(subTree.TraitTreeID) || new Set()
      existing.add(subTree.ID)
      treeToSubTreeIds.set(subTree.TraitTreeID, existing)
    }
  }

  console.log(`Built hero tree mappings for ${subTreeById.size} subtrees`)

  // Map spec to tree via loadouts
  // Sort by ID descending to prefer higher IDs (main class trees) over lower IDs (hero trees)
  const sortedLoadouts = [...loadouts].sort((a, b) => b.ID - a.ID)
  const specToTreeId = new Map<number, number>()
  for (const loadout of sortedLoadouts) {
    // Take the tree with highest loadout ID for each spec (main class tree)
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

    // Sort nodes by ID to match WoW talent export string order
    // The talent string encodes nodes in node ID order
    treeNodeList.sort((a, b) => a.ID - b.ID)

    const talentNodes: TalentNodeData[] = []

    for (const node of treeNodeList) {
      // Get spec restrictions for this node (if any)
      const allowedSpecs = nodeToAllowedSpecs.get(node.ID)

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
        // Use override icon if available, otherwise look up spell icon
        const iconId = definition?.OverrideIcon || spellIconById.get(spellId) || 0

        talentEntries.push({
          id: entry.ID,
          definitionId: entry.TraitDefinitionID,
          spellId,
          name,
          iconId,
          maxRanks: entry.MaxRanks,
          entryIndex: ne._Index,
        })
      }

      const nodeData: TalentNodeData = {
        id: node.ID,
        posX: node.PosX,
        posY: node.PosY,
        type: node.Type,
        maxRanks: talentEntries[0]?.maxRanks || 1,
        entries: talentEntries,
      }

      // Add spec restriction if this node is limited to specific specs
      if (allowedSpecs && allowedSpecs.length > 0) {
        nodeData.allowedSpecs = [...new Set(allowedSpecs)] // Deduplicate
      }

      talentNodes.push(nodeData)
    }

    const talentEdges: TalentEdgeData[] = treeEdgeList.map(e => ({
      fromNodeId: e.LeftTraitNodeID,
      toNodeId: e.RightTraitNodeID,
      type: e.Type,
    }))

    // Build hero tree data for this spec
    const subTreeIds = treeToSubTreeIds.get(treeId) || new Set()
    const heroTrees: HeroTreeData[] = [...subTreeIds]
      .map(subTreeId => {
        const subTree = subTreeById.get(subTreeId)
        if (!subTree || !subTree.Name_lang) return null
        const nodeIds = subTreeToNodeIds.get(subTreeId) || []
        return {
          id: subTreeId,
          name: subTree.Name_lang,
          nodeIds,
        }
      })
      .filter((ht): ht is HeroTreeData => ht !== null)

    const specData: SpecTalentData = {
      specId: spec.ID,
      specName: spec.Name_lang,
      className,
      treeId,
      nodes: talentNodes,
      edges: talentEdges,
      heroTrees,
    }

    specDataList.push(specData)

    // Write individual spec file
    const filename = join(outDir, `${spec.ID}.json`)
    writeFileSync(filename, JSON.stringify(specData, null, 2))
    console.log(`  ${spec.ID}.json - ${spec.Name_lang} ${className} (${talentNodes.length} nodes, ${talentEdges.length} edges, ${heroTrees.length} hero trees)`)
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
