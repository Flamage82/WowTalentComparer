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
}

export interface TalentNodeData {
  id: number
  posX: number
  posY: number
  type: number
  maxRanks: number
  entries: TalentEntryData[]
}

export interface TalentEntryData {
  id: number
  definitionId: number
  spellId: number
  name: string
  maxRanks: number
  entryIndex: number
}

export interface TalentEdgeData {
  fromNodeId: number
  toNodeId: number
  type: number
}
