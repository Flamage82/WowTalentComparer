import { useEffect, useMemo, useRef } from 'react'
import type { SpecTalentData, TalentNodeData } from '../data/types'
import type { TalentNodeSelection } from '../lib/talentParser'
import type { TalentDiffResult, TalentDiffNode } from '../lib/talentDiff'
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
  diffResult?: TalentDiffResult
}

function getSpellIds(node: TalentNodeData): number[] {
  return node.entries.map(e => e.spellId).filter(id => id > 0)
}

export function TalentTreeView({ specData, selectedNodes, diffResult }: TalentTreeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Create diff lookup map for O(1) access by node index
  const diffMap = useMemo(() => {
    if (!diffResult) return null
    const map = new Map<number, TalentDiffNode>()
    diffResult.diffs.forEach(d => map.set(d.nodeIndex, d))
    return map
  }, [diffResult])

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
  const { visibleNodes, visibleEdges, selectedHeroNodeIds } = useMemo(() => {
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

    // Identify hero tree components by their size
    // Hero trees are small disconnected components (10-25 nodes) separate from main class/spec trees
    const componentInfo = components.map((comp, idx) => {
      // Count how many nodes in this component are selected (and available to this spec)
      let selectedCount = 0
      comp.forEach(id => {
        const node = allNodes.find(n => n.id === id)
        if (!node) return
        // Skip nodes restricted to other specs
        if (node.allowedSpecs && node.allowedSpecs.length > 0 && !node.allowedSpecs.includes(specData.specId)) {
          return
        }
        const nodeIndex = allNodes.findIndex(n => n.id === id)
        if (selectedIndices.has(nodeIndex)) {
          selectedCount++
        }
      })
      return { index: idx, size: comp.length, selectedCount }
    })

    // Hero trees are small disconnected components (10-25 nodes)
    // This size range captures hero trees while excluding class/spec trees (30+ nodes)
    const heroTreeComponents = componentInfo
      .filter(c => c.size >= 10 && c.size <= 25)
      .map(c => c.index)

    // Find the hero tree component with the MOST selected nodes
    // This correctly identifies which hero tree the player chose
    let selectedHeroComponent: number | null = null
    let maxSelectedCount = 0
    for (const compIdx of heroTreeComponents) {
      const info = componentInfo[compIdx]
      if (info.selectedCount > maxSelectedCount) {
        maxSelectedCount = info.selectedCount
        selectedHeroComponent = compIdx
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

    return { visibleNodes, visibleNodeIds, visibleEdges, selectedHeroNodeIds }
  }, [specData, selectedIndices])

  // Calculate bounds, scale, and X offsets to normalize spacing between tree sections
  const { bounds, scale, xOffsets } = useMemo(() => {
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

    // Group nodes into columns (class tree, hero tree, spec tree)
    // Hero tree nodes are always in the middle column (1), regardless of their X position
    // Non-hero nodes are split into class tree (left/0) and spec tree (right/2) by X position

    // Find the X midpoint of non-hero nodes to separate class and spec trees
    const nonHeroNodes = visibleNodes.filter(n => !selectedHeroNodeIds.has(n.id))
    const nonHeroXPositions = [...new Set(nonHeroNodes.map(n => n.posX))].sort((a, b) => a - b)

    // Find the largest gap in non-hero X positions to separate class from spec tree
    let clasSpecSeparator = 0
    let maxGap = 0
    for (let i = 1; i < nonHeroXPositions.length; i++) {
      const gap = nonHeroXPositions[i] - nonHeroXPositions[i - 1]
      if (gap > maxGap) {
        maxGap = gap
        clasSpecSeparator = (nonHeroXPositions[i] + nonHeroXPositions[i - 1]) / 2
      }
    }

    // Assign each node to a column
    const getColumn = (nodeId: number, x: number) => {
      // Hero tree nodes always go in the middle column
      if (selectedHeroNodeIds.has(nodeId)) return 1
      // Non-hero nodes: left of separator = class tree, right = spec tree
      return x < clasSpecSeparator ? 0 : 2
    }

    // Calculate bounds for each column
    const columnBounds = [
      { minX: Infinity, maxX: -Infinity },
      { minX: Infinity, maxX: -Infinity },
      { minX: Infinity, maxX: -Infinity },
    ]

    let minY = Infinity, maxY = -Infinity
    for (const node of visibleNodes) {
      const col = getColumn(node.id, node.posX)
      columnBounds[col].minX = Math.min(columnBounds[col].minX, node.posX)
      columnBounds[col].maxX = Math.max(columnBounds[col].maxX, node.posX)
      minY = Math.min(minY, node.posY)
      maxY = Math.max(maxY, node.posY)
    }

    // Calculate column widths
    const columnWidths = columnBounds.map(b =>
      b.maxX > -Infinity ? b.maxX - b.minX : 0
    )

    // Calculate X offsets to center each column with equal gaps
    const COLUMN_GAP = 120 / calculatedScale // Gap between columns in original coordinates
    const xOffsets = new Map<number, number>()

    // Position columns: [class tree] [gap] [hero tree] [gap] [spec tree]
    let currentX = 0
    for (let col = 0; col < 3; col++) {
      if (columnBounds[col].minX < Infinity) {
        // Offset = where we want minX to be - where it currently is
        xOffsets.set(col, currentX - columnBounds[col].minX)
        currentX += columnWidths[col] + COLUMN_GAP
      }
    }

    // Calculate adjusted bounds
    const padding = (NODE_SIZE * 2) / calculatedScale
    const adjustedMinX = -padding
    const adjustedMaxX = currentX - COLUMN_GAP + padding // Remove last gap, add padding
    const adjustedMinY = minY - padding
    const adjustedMaxY = maxY + padding

    return {
      bounds: {
        minX: adjustedMinX,
        minY: adjustedMinY,
        width: adjustedMaxX - adjustedMinX,
        height: adjustedMaxY - adjustedMinY
      },
      scale: calculatedScale,
      xOffsets: { offsets: xOffsets, getColumn },
    }
  }, [visibleNodes, visibleEdges, selectedHeroNodeIds])

  // Create node ID to position mapping for edge rendering
  const nodePositions = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>()
    visibleNodes.forEach((node) => {
      const col = xOffsets.getColumn(node.id, node.posX)
      const xOffset = xOffsets.offsets.get(col) || 0
      map.set(node.id, {
        x: (node.posX + xOffset - bounds.minX) * scale,
        y: (node.posY - bounds.minY) * scale,
      })
    })
    return map
  }, [visibleNodes, bounds, scale, xOffsets])

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
            const col = xOffsets.getColumn(node.id, node.posX)
            const xOffset = xOffsets.offsets.get(col) || 0
            const x = (node.posX + xOffset - bounds.minX) * scale
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

            // Get diff info for this node (if in comparison mode)
            const diff = diffMap?.get(originalIndex)
            const diffClass = diff ? `diff-${diff.diffType}` : ''
            // In comparison mode, selected talents with no diff are "same" (both specs have it)
            const comparisonSameClass = diffMap && isSelected && !diff ? 'comparison-same' : ''

            return (
              <a
                key={node.id}
                href={`https://www.wowhead.com/spell=${displaySpellId}`}
                className={`talent-node ${isSelected ? 'selected' : 'unselected'} ${isChoice ? 'choice' : ''} ${isHero ? 'hero' : ''} ${diffClass} ${comparisonSameClass}`}
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
            const col = xOffsets.getColumn(node.id, node.posX)
            const xOffset = xOffsets.offsets.get(col) || 0
            const x = (node.posX + xOffset - bounds.minX) * scale
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
