import { useEffect, useMemo, useRef } from 'react'
import type { SpecTalentData, TalentNodeData } from '../data/types'
import type { TalentNodeSelection } from '../lib/talentParser'
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

  // Calculate bounds and scale
  const { nodes, edges, bounds, scale } = useMemo(() => {
    const nodes = specData.nodes
    const edges = specData.edges

    // Find bounds
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    for (const node of nodes) {
      minX = Math.min(minX, node.posX)
      maxX = Math.max(maxX, node.posX)
      minY = Math.min(minY, node.posY)
      maxY = Math.max(maxY, node.posY)
    }

    // Add padding
    const padding = 500
    minX -= padding
    maxX += padding
    minY -= padding
    maxY += padding

    const width = maxX - minX
    const height = maxY - minY

    // Scale to fit in viewport (target ~800px wide)
    const targetWidth = 800
    const scale = targetWidth / width

    return {
      nodes,
      edges,
      bounds: { minX, minY, width, height },
      scale,
    }
  }, [specData])

  // Create node ID to position mapping for edge rendering
  const nodePositions = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>()
    nodes.forEach((node) => {
      map.set(node.id, {
        x: (node.posX - bounds.minX) * scale,
        y: (node.posY - bounds.minY) * scale,
      })
    })
    return map
  }, [nodes, bounds, scale])

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
        {/* SVG layer for edges and node circles */}
        <svg
          className="talent-tree-svg"
          width={viewWidth}
          height={viewHeight}
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        >
          {/* Render edges first (behind nodes) */}
          <g className="edges">
            {edges.map((edge, i) => {
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

          {/* Render node circles */}
          <g className="nodes">
            {nodes.map((node, index) => {
              const x = (node.posX - bounds.minX) * scale
              const y = (node.posY - bounds.minY) * scale
              const isSelected = selectedIndices.has(index)
              const isChoice = node.entries.length > 1

              // Node type affects appearance
              const radius = node.type === 3 ? 12 : 8

              return (
                <g key={node.id} className="node-group">
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    className={`node ${isSelected ? 'selected' : ''} ${isChoice ? 'choice' : ''} type-${node.type}`}
                  />
                  {/* Show max ranks indicator for multi-rank talents */}
                  {node.maxRanks > 1 && (
                    <text
                      x={x}
                      y={y + radius + 10}
                      className="rank-text"
                      textAnchor="middle"
                    >
                      {node.maxRanks}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        {/* HTML overlay for Wowhead tooltips */}
        <div className="talent-overlay">
          {nodes.map((node, index) => {
            const x = (node.posX - bounds.minX) * scale
            const y = (node.posY - bounds.minY) * scale
            const isSelected = selectedIndices.has(index)
            const isChoice = node.entries.length > 1
            const radius = node.type === 3 ? 12 : 8

            // Get spell ID(s) for this node
            const spellIds = getSpellIds(node)
            if (spellIds.length === 0) return null

            // For choice nodes, show the selected entry if available
            const choiceIndex = choiceSelections.get(index)
            const displaySpellId = isChoice && choiceIndex !== undefined
              ? (node.entries[choiceIndex]?.spellId || spellIds[0])
              : spellIds[0]

            return (
              <a
                key={node.id}
                href={`https://www.wowhead.com/spell=${displaySpellId}`}
                className={`talent-hotspot ${isSelected ? 'selected' : ''}`}
                style={{
                  left: x - radius,
                  top: y - radius,
                  width: radius * 2,
                  height: radius * 2,
                }}
                target="_blank"
                rel="noopener noreferrer"
                data-wowhead={`spell=${displaySpellId}`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
