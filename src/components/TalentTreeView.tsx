import { useMemo, useState } from 'react'
import type { SpecTalentData, TalentNodeData } from '../data/types'
import type { TalentNodeSelection } from '../lib/talentParser'
import './TalentTreeView.css'

interface TalentTreeViewProps {
  specData: SpecTalentData
  selectedNodes: TalentNodeSelection[]
}

function getNodeName(node: TalentNodeData): string {
  // For choice nodes, show both options
  if (node.entries.length > 1) {
    const names = node.entries
      .map(e => e.name)
      .filter(n => n)
    if (names.length > 1) {
      return names.join(' / ')
    }
  }
  // For regular nodes, show the first entry's name
  return node.entries[0]?.name || ''
}

export function TalentTreeView({ specData, selectedNodes }: TalentTreeViewProps) {
  const [hoveredNode, setHoveredNode] = useState<TalentNodeData | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // Create a set of selected node indices for quick lookup
  const selectedIndices = useMemo(() => {
    return new Set(
      selectedNodes
        .filter(n => n.isSelected)
        .map(n => n.nodeIndex)
    )
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

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  return (
    <div className="talent-tree-view" onMouseMove={handleMouseMove}>
      <svg
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

        {/* Render nodes */}
        <g className="nodes">
          {nodes.map((node, index) => {
            const x = (node.posX - bounds.minX) * scale
            const y = (node.posY - bounds.minY) * scale
            const isSelected = selectedIndices.has(index)
            const isChoice = node.entries.length > 1

            // Node type affects appearance
            const radius = node.type === 3 ? 12 : 8

            return (
              <g
                key={node.id}
                className="node-group"
                onMouseEnter={() => setHoveredNode(node)}
                onMouseLeave={() => setHoveredNode(null)}
              >
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

      {/* Tooltip */}
      {hoveredNode && (
        <div
          className="talent-tooltip"
          style={{
            left: mousePos.x + 15,
            top: mousePos.y + 15,
          }}
        >
          <div className="tooltip-name">{getNodeName(hoveredNode) || 'Unknown Talent'}</div>
          {hoveredNode.maxRanks > 1 && (
            <div className="tooltip-ranks">Max Ranks: {hoveredNode.maxRanks}</div>
          )}
          {hoveredNode.entries.length > 1 && (
            <div className="tooltip-choice">Choice Node</div>
          )}
        </div>
      )}
    </div>
  )
}
