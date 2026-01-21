import { useEffect, useMemo, useRef } from 'react'
import type { SpecTalentData, TalentNodeData } from '../data/types'
import type { TalentNodeSelection } from '../lib/talentParser'
import { deduplicateOverlappingNodes } from '../lib/nodeFiltering'
import './TalentTreeView.css'

// Declare Wowhead's global refresh function
declare global {
  interface Window {
    $WowheadPower?: {
      refreshLinks: () => void
    }
  }
}

interface TalentTreeViewProps {
  specData: SpecTalentData
  selectedNodes: TalentNodeSelection[]
}

function getSpellIds(node: TalentNodeData): number[] {
  return node.entries.map(e => e.spellId).filter(id => id > 0)
}

export function TalentTreeView({ specData, selectedNodes }: TalentTreeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Create a set of selected node indices for quick lookup
  const selectedIndices = useMemo(() => {
    return new Set(
      selectedNodes
        .filter(n => n.isSelected)
        .map(n => n.nodeIndex)
    )
  }, [selectedNodes])

  // Get choice entry for selected choice nodes
  const choiceSelections = useMemo(() => {
    const map = new Map<number, number>()
    selectedNodes.forEach(n => {
      if (n.isChoiceNode && n.choiceEntryIndex !== undefined) {
        map.set(n.nodeIndex, n.choiceEntryIndex)
      }
    })
    return map
  }, [selectedNodes])

  // Node sizes
  const NODE_SIZE = 40
  const HERO_NODE_SIZE = 46
  const MIN_NODE_SPACING = 78 // Minimum pixels between node centers

  // Filter hero nodes to only show the selected hero tree
  const { visibleNodes, visibleEdges } = useMemo(() => {
    const allNodes = specData.nodes
    const allEdges = specData.edges

    // Build adjacency map for all nodes
    const adjacency = new Map<number, Set<number>>()
    allNodes.forEach(n => adjacency.set(n.id, new Set()))
    allEdges.forEach(edge => {
      adjacency.get(edge.fromNodeId)?.add(edge.toNodeId)
      adjacency.get(edge.toNodeId)?.add(edge.fromNodeId)
    })

    // Find connected components via BFS
    const visited = new Set<number>()
    const components: number[][] = []
    const nodeIdToComponent = new Map<number, number>()

    for (const node of allNodes) {
      if (visited.has(node.id)) continue

      const component: number[] = []
      const queue = [node.id]
      while (queue.length > 0) {
        const id = queue.shift()!
        if (visited.has(id)) continue
        visited.add(id)
        component.push(id)
        adjacency.get(id)?.forEach(n => {
          if (!visited.has(n)) queue.push(n)
        })
      }

      const componentIndex = components.length
      component.forEach(id => nodeIdToComponent.set(id, componentIndex))
      components.push(component)
    }

    // Identify hero tree components by their average X position
    // Hero trees are in the middle column (between class tree on left and spec tree on right)
    const componentInfo = components.map((comp, idx) => {
      const nodes = comp.map(id => allNodes.find(n => n.id === id)!).filter(Boolean)
      const avgX = nodes.reduce((s, n) => s + n.posX, 0) / nodes.length
      // Only consider a node as "selected" if it's available to this spec
      const hasSelectedNode = comp.some(id => {
        const node = allNodes.find(n => n.id === id)
        if (!node) return false
        // Skip nodes restricted to other specs
        if (node.allowedSpecs && node.allowedSpecs.length > 0 && !node.allowedSpecs.includes(specData.specId)) {
          return false
        }
        const nodeIndex = allNodes.findIndex(n => n.id === id)
        return selectedIndices.has(nodeIndex)
      })
      return { index: idx, avgX, size: comp.length, hasSelectedNode }
    })

    // Find the X ranges to identify hero trees
    // Group components by their X position (rounded to nearest 1000)
    const componentsByX = new Map<number, typeof componentInfo>()
    componentInfo.filter(c => c.size > 5).forEach(c => {
      const roundedX = Math.round(c.avgX / 1000) * 1000
      if (!componentsByX.has(roundedX)) componentsByX.set(roundedX, [])
      componentsByX.get(roundedX)!.push(c)
    })

    // Hero trees are identified as: a group of 2-3 similar-sized small components
    // at the same X position (the middle column typically has the 3 hero trees)
    const heroTreeComponents: number[] = []
    componentsByX.forEach((comps) => {
      // If there are 2-3 components at this X position with similar small sizes (10-20 nodes),
      // they're likely hero trees
      const smallComps = comps.filter(c => c.size >= 10 && c.size <= 25)
      if (smallComps.length >= 2 && smallComps.length <= 3) {
        smallComps.forEach(c => heroTreeComponents.push(c.index))
      }
    })

    // Find which hero tree component has selected nodes
    let selectedHeroComponent: number | null = null
    for (const compIdx of heroTreeComponents) {
      if (componentInfo[compIdx].hasSelectedNode) {
        selectedHeroComponent = compIdx
        break
      }
    }

    // Determine which nodes to hide (unselected hero tree nodes)
    const heroTreeNodeIds = new Set<number>()
    heroTreeComponents.forEach(idx => {
      components[idx].forEach(id => heroTreeNodeIds.add(id))
    })

    const selectedHeroNodeIds = selectedHeroComponent !== null
      ? new Set(components[selectedHeroComponent])
      : new Set<number>()

    // Build set of node IDs that have at least one edge
    const connectedNodeIds = new Set<number>()
    allEdges.forEach(edge => {
      connectedNodeIds.add(edge.fromNodeId)
      connectedNodeIds.add(edge.toNodeId)
    })

    // Filter nodes: hide hero tree nodes that aren't in the selected hero tree
    // Also hide type=3 selector nodes, spec-restricted nodes, and disconnected nodes
    const filteredNodes = allNodes.filter(node => {
      // Always hide the hero selector nodes (type=3)
      if (node.type === 3) return false

      // Hide disconnected nodes (no edges)
      if (!connectedNodeIds.has(node.id)) return false

      // Hide nodes that are restricted to other specs
      if (node.allowedSpecs && node.allowedSpecs.length > 0) {
        if (!node.allowedSpecs.includes(specData.specId)) {
          return false
        }
      }

      // If this is a hero tree node, only show if it's in the selected hero tree
      if (heroTreeNodeIds.has(node.id)) {
        return selectedHeroNodeIds.has(node.id)
      }

      // Show all other nodes
      return true
    })

    // Deduplicate overlapping nodes (nodes at the same position from different hero trees)
    const visibleNodes = deduplicateOverlappingNodes(
      filteredNodes,
      selectedHeroNodeIds,
      heroTreeNodeIds
    )

    const visibleNodeIds = new Set(visibleNodes.map(n => n.id))

    // Filter edges to only those between visible nodes
    const visibleEdges = allEdges.filter(edge =>
      visibleNodeIds.has(edge.fromNodeId) && visibleNodeIds.has(edge.toNodeId)
    )

    return { visibleNodes, visibleNodeIds, visibleEdges }
  }, [specData, selectedIndices])

  // Calculate bounds and scale based on visible nodes
  const { bounds, scale } = useMemo(() => {
    // Find bounds
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    for (const node of visibleNodes) {
      minX = Math.min(minX, node.posX)
      maxX = Math.max(maxX, node.posX)
      minY = Math.min(minY, node.posY)
      maxY = Math.max(maxY, node.posY)
    }

    // Find minimum distance between adjacent nodes (using edges) to calculate proper scale
    let minEdgeDistance = Infinity
    for (const edge of visibleEdges) {
      const fromNode = visibleNodes.find(n => n.id === edge.fromNodeId)
      const toNode = visibleNodes.find(n => n.id === edge.toNodeId)
      if (fromNode && toNode) {
        const dx = fromNode.posX - toNode.posX
        const dy = fromNode.posY - toNode.posY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 0 && dist < minEdgeDistance) {
          minEdgeDistance = dist
        }
      }
    }

    // Calculate scale so minimum edge distance maps to MIN_NODE_SPACING
    const calculatedScale = minEdgeDistance < Infinity ? MIN_NODE_SPACING / minEdgeDistance : 0.1

    // Add padding based on node size
    const padding = (NODE_SIZE * 2) / calculatedScale
    minX -= padding
    maxX += padding
    minY -= padding
    maxY += padding

    const width = maxX - minX
    const height = maxY - minY

    return {
      bounds: { minX, minY, width, height },
      scale: calculatedScale,
    }
  }, [visibleNodes, visibleEdges])

  // Create node ID to position mapping for edge rendering
  const nodePositions = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>()
    visibleNodes.forEach((node) => {
      map.set(node.id, {
        x: (node.posX - bounds.minX) * scale,
        y: (node.posY - bounds.minY) * scale,
      })
    })
    return map
  }, [visibleNodes, bounds, scale])

  // Create a map from node ID to original index for selection lookups
  const nodeIdToOriginalIndex = useMemo(() => {
    const map = new Map<number, number>()
    specData.nodes.forEach((node, index) => {
      map.set(node.id, index)
    })
    return map
  }, [specData])

  const viewWidth = bounds.width * scale
  const viewHeight = bounds.height * scale

  // Refresh Wowhead tooltips when nodes change
  useEffect(() => {
    // Small delay to ensure DOM is updated
    const timer = setTimeout(() => {
      window.$WowheadPower?.refreshLinks()
    }, 100)
    return () => clearTimeout(timer)
  }, [specData, selectedNodes])

  return (
    <div className="talent-tree-view" ref={containerRef}>
      <div className="talent-tree-canvas" style={{ width: viewWidth, height: viewHeight }}>
        {/* SVG layer for edges only */}
        <svg
          className="talent-tree-svg"
          width={viewWidth}
          height={viewHeight}
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        >
          {/* Render edges */}
          <g className="edges">
            {visibleEdges.map((edge, i) => {
              const from = nodePositions.get(edge.fromNodeId)
              const to = nodePositions.get(edge.toNodeId)
              if (!from || !to) return null

              return (
                <line
                  key={i}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  className="edge"
                />
              )
            })}
          </g>
        </svg>

        {/* HTML overlay with Wowhead icons */}
        <div className="talent-overlay">
          {visibleNodes.map((node) => {
            const originalIndex = nodeIdToOriginalIndex.get(node.id) ?? -1
            const x = (node.posX - bounds.minX) * scale
            const y = (node.posY - bounds.minY) * scale
            const isSelected = selectedIndices.has(originalIndex)
            const isChoice = node.entries.length > 1
            const isHero = node.type === 3
            const size = isHero ? HERO_NODE_SIZE : NODE_SIZE

            // Get spell ID(s) for this node
            const spellIds = getSpellIds(node)
            if (spellIds.length === 0) return null

            // For choice nodes, show the selected entry if available
            const choiceIndex = choiceSelections.get(originalIndex)
            const displaySpellId = isChoice && choiceIndex !== undefined
              ? (node.entries[choiceIndex]?.spellId || spellIds[0])
              : spellIds[0]

            return (
              <a
                key={node.id}
                href={`https://www.wowhead.com/spell=${displaySpellId}`}
                className={`talent-node ${isSelected ? 'selected' : 'unselected'} ${isChoice ? 'choice' : ''} ${isHero ? 'hero' : ''}`}
                style={{
                  left: x - size / 2,
                  top: y - size / 2,
                  width: size,
                  height: size,
                }}
                target="_blank"
                rel="noopener noreferrer"
                data-wowhead={`spell=${displaySpellId}`}
              />
            )
          })}
        </div>

        {/* Rank indicators */}
        <div className="talent-ranks">
          {visibleNodes.map((node) => {
            if (node.maxRanks <= 1) return null
            const originalIndex = nodeIdToOriginalIndex.get(node.id) ?? -1
            const x = (node.posX - bounds.minX) * scale
            const y = (node.posY - bounds.minY) * scale
            const isHero = node.type === 3
            const size = isHero ? HERO_NODE_SIZE : NODE_SIZE
            const isSelected = selectedIndices.has(originalIndex)
            const selection = selectedNodes.find(n => n.nodeIndex === originalIndex)
            const currentRanks = selection?.isSelected ? (selection.ranksPurchased || node.maxRanks) : 0

            return (
              <span
                key={node.id}
                className={`rank-indicator ${isSelected ? 'selected' : ''}`}
                style={{
                  left: x,
                  top: y + size / 2 + 4,
                }}
              >
                {currentRanks}/{node.maxRanks}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
