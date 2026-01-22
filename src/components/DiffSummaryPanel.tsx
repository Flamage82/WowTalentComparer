import { useState, useEffect, useMemo } from 'react'
import type { TalentDiffResult, TalentDiffNode } from '../lib/talentDiff'
import type { SpecTalentData } from '../data/types'
import './DiffSummaryPanel.css'

// Declare Wowhead's global refresh function
declare global {
  interface Window {
    $WowheadPower?: {
      refreshLinks: () => void
    }
  }
}

type TreeType = 'class' | 'spec' | 'hero'

interface DiffSummaryPanelProps {
  diffResult: TalentDiffResult
  specData: SpecTalentData | null
}

export function DiffSummaryPanel({ diffResult, specData }: DiffSummaryPanelProps) {
  const [isOpen, setIsOpen] = useState(true)

  const { summary } = diffResult

  // Calculate column separators and hero tree nodes to determine class vs spec vs hero tree
  const getTreeType = useMemo(() => {
    if (!specData) return () => 'class' as TreeType

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

    // Identify hero tree components by their size (10-25 nodes)
    const heroTreeComponents = new Set(
      components
        .map((comp, idx) => ({ index: idx, size: comp.length }))
        .filter(c => c.size >= 10 && c.size <= 25)
        .map(c => c.index)
    )

    // Create set of hero tree node IDs (by original index)
    const heroTreeNodeIndices = new Set<number>()
    allNodes.forEach((node, idx) => {
      const componentIdx = nodeIdToComponent.get(node.id)
      if (componentIdx !== undefined && heroTreeComponents.has(componentIdx)) {
        heroTreeNodeIndices.add(idx)
      }
    })

    // Get X positions of non-hero nodes to find class/spec separator
    const nonHeroNodes = allNodes.filter((_, idx) => !heroTreeNodeIndices.has(idx))
    const xPositions = [...new Set(nonHeroNodes.map(n => n.posX))].sort((a, b) => a - b)

    // Find the largest gap which should separate class tree from spec tree
    let maxGap = 0
    let separatorX = 0
    for (let i = 1; i < xPositions.length; i++) {
      const gap = xPositions[i] - xPositions[i - 1]
      if (gap > maxGap) {
        maxGap = gap
        separatorX = (xPositions[i] + xPositions[i - 1]) / 2
      }
    }

    return (nodeIndex: number): TreeType => {
      // Check if it's a hero tree node first
      if (heroTreeNodeIndices.has(nodeIndex)) return 'hero'

      const node = specData.nodes[nodeIndex]
      if (!node) return 'class'
      return node.posX < separatorX ? 'class' : 'spec'
    }
  }, [specData])

  const getNodeName = (nodeIndex: number): string => {
    if (!specData) return `Node ${nodeIndex}`
    const node = specData.nodes[nodeIndex]
    if (!node) return `Node ${nodeIndex}`
    return node.entries[0]?.name || `Node ${nodeIndex}`
  }

  const getNodeSpellId = (nodeIndex: number): number | null => {
    if (!specData) return null
    const node = specData.nodes[nodeIndex]
    if (!node) return null
    return node.entries[0]?.spellId || null
  }

  const getDiffNode = (nodeIndex: number): TalentDiffNode | undefined => {
    return diffResult.diffs.find(d => d.nodeIndex === nodeIndex)
  }

  const formatRankChange = (diff: TalentDiffNode): string | null => {
    if (!diff.changeDetails?.rankChange) return null
    const { from, to } = diff.changeDetails.rankChange
    return `Rank: ${from} → ${to}`
  }

  // Get choice change details for rendering with icons
  const getChoiceChangeInfo = (diff: TalentDiffNode): { from: { name: string; spellId: number | null }; to: { name: string; spellId: number | null } } | null => {
    if (!diff.changeDetails?.choiceChange || !specData) return null
    const { from, to } = diff.changeDetails.choiceChange
    const node = specData.nodes[diff.nodeIndex]
    if (!node || node.entries.length <= 1) return null

    const fromEntry = node.entries[from]
    const toEntry = node.entries[to]

    return {
      from: {
        name: fromEntry?.name || `Option ${from + 1}`,
        spellId: fromEntry?.spellId || null
      },
      to: {
        name: toEntry?.name || `Option ${to + 1}`,
        spellId: toEntry?.spellId || null
      }
    }
  }

  // Group node indices by tree type, excluding hero selector nodes (type=3)
  const groupByTree = (nodeIndices: number[]): { class: number[]; spec: number[]; hero: number[] } => {
    const result = { class: [] as number[], spec: [] as number[], hero: [] as number[] }
    for (const idx of nodeIndices) {
      // Skip hero tree selector nodes (type=3) - they're implied by the hero talent changes
      const node = specData?.nodes[idx]
      if (node?.type === 3) continue

      const treeType = getTreeType(idx)
      result[treeType].push(idx)
    }
    return result
  }

  // Refresh Wowhead tooltips when content changes
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      window.$WowheadPower?.refreshLinks()
    }, 100)
    return () => clearTimeout(timer)
  }, [diffResult, specData, isOpen])

  // Get all changes grouped by tree type (this also filters out type=3 selector nodes)
  const groupedAdded = groupByTree(summary.added)
  const groupedRemoved = groupByTree(summary.removed)
  const groupedChanged = groupByTree(summary.changed)

  const classTotal = groupedAdded.class.length + groupedRemoved.class.length + groupedChanged.class.length
  const specTotal = groupedAdded.spec.length + groupedRemoved.spec.length + groupedChanged.spec.length
  const heroTotal = groupedAdded.hero.length + groupedRemoved.hero.length + groupedChanged.hero.length
  const totalChanges = classTotal + specTotal + heroTotal

  // Render a spell link with Wowhead tooltip
  const renderSpellLink = (name: string, spellId: number | null) => {
    if (spellId) {
      return (
        <a
          href={`https://www.wowhead.com/spell=${spellId}`}
          className="diff-talent-link"
          target="_blank"
          rel="noopener noreferrer"
          data-wowhead={`spell=${spellId}`}
        >
          {name}
        </a>
      )
    }
    return <span className="diff-item-name">{name}</span>
  }

  // Helper to render a talent item with Wowhead tooltip
  const renderTalentItem = (
    nodeIndex: number,
    showDetails: boolean = false
  ) => {
    const spellId = getNodeSpellId(nodeIndex)
    const name = getNodeName(nodeIndex)
    const diff = showDetails ? getDiffNode(nodeIndex) : undefined
    const choiceInfo = diff ? getChoiceChangeInfo(diff) : null
    const rankDetails = diff ? formatRankChange(diff) : null

    // For choice changes, show both icons side by side
    if (choiceInfo) {
      return (
        <li key={nodeIndex} className="diff-item-choice-change">
          <div className="diff-choice-comparison">
            {renderSpellLink(choiceInfo.from.name, choiceInfo.from.spellId)}
            <span className="diff-arrow">→</span>
            {renderSpellLink(choiceInfo.to.name, choiceInfo.to.spellId)}
          </div>
          {rankDetails && <span className="diff-item-details">{rankDetails}</span>}
        </li>
      )
    }

    if (spellId) {
      return (
        <li key={nodeIndex}>
          {renderSpellLink(name, spellId)}
          {rankDetails && <span className="diff-item-details">{rankDetails}</span>}
        </li>
      )
    }

    return (
      <li key={nodeIndex}>
        <span className="diff-item-name">{name}</span>
        {rankDetails && <span className="diff-item-details">{rankDetails}</span>}
      </li>
    )
  }

  // Render a change type subsection (added/removed/changed) within a tree column
  const renderChangeSubsection = (
    changeType: 'added' | 'removed' | 'changed',
    nodeIndices: number[],
    showDetails: boolean = false
  ) => {
    if (nodeIndices.length === 0) return null

    const config = {
      added: { icon: '+', label: 'Added', className: 'diff-subsection-added' },
      removed: { icon: '−', label: 'Removed', className: 'diff-subsection-removed' },
      changed: { icon: '~', label: 'Changed', className: 'diff-subsection-changed' },
    }[changeType]

    return (
      <div className={`diff-change-subsection ${config.className}`}>
        <h5>
          <span className="diff-icon-small">{config.icon}</span>
          {config.label} ({nodeIndices.length})
        </h5>
        <ul>
          {nodeIndices.map(idx => renderTalentItem(idx, showDetails))}
        </ul>
      </div>
    )
  }

  if (totalChanges === 0) {
    return (
      <div className="diff-summary-panel">
        <div className="diff-summary-empty">
          These builds are identical
        </div>
      </div>
    )
  }

  return (
    <div className="diff-summary-panel">
      <button
        className="diff-summary-header"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <h3>
          Differences
          <span className="diff-summary-count">({totalChanges})</span>
        </h3>
        <span className={`diff-summary-arrow ${isOpen ? 'open' : ''}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="diff-summary-content">
          <div className="diff-tree-columns">
            {/* Class Talents Column */}
            {classTotal > 0 && (
              <div className="diff-tree-column diff-tree-class">
                <h4>Class Talents ({classTotal})</h4>
                {renderChangeSubsection('added', groupedAdded.class)}
                {renderChangeSubsection('removed', groupedRemoved.class)}
                {renderChangeSubsection('changed', groupedChanged.class, true)}
              </div>
            )}

            {/* Hero Talents Column */}
            {heroTotal > 0 && (
              <div className="diff-tree-column diff-tree-hero">
                <h4>Hero Talents ({heroTotal})</h4>
                {renderChangeSubsection('added', groupedAdded.hero)}
                {renderChangeSubsection('removed', groupedRemoved.hero)}
                {renderChangeSubsection('changed', groupedChanged.hero, true)}
              </div>
            )}

            {/* Spec Talents Column */}
            {specTotal > 0 && (
              <div className="diff-tree-column diff-tree-spec">
                <h4>Spec Talents ({specTotal})</h4>
                {renderChangeSubsection('added', groupedAdded.spec)}
                {renderChangeSubsection('removed', groupedRemoved.spec)}
                {renderChangeSubsection('changed', groupedChanged.spec, true)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
