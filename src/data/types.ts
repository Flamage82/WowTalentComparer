export interface SpecIndex {
  specId: number
  specName: string
  className: string
  nodeCount: number
}

export interface SpecTalentData {
  specId: number
  specName: string
  className: string
  treeId: number
  nodes: TalentNodeData[]
  edges: TalentEdgeData[]
  heroTrees?: HeroTreeData[]
}

export interface HeroTreeData {
  id: number
  name: string
  nodeIds: number[]
}

export interface TalentNodeData {
  id: number
  posX: number
  posY: number
  type: number
  maxRanks: number
  entries: TalentEntryData[]
  allowedSpecs?: number[] // Specs that can use this node (empty/undefined = all specs)
}

export interface TalentEntryData {
  id: number
  definitionId: number
  spellId: number
  name: string
  iconId: number
  maxRanks: number
  entryIndex: number
}

export interface TalentEdgeData {
  fromNodeId: number
  toNodeId: number
  type: number
}
