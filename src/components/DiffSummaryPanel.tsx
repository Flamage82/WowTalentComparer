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

type TreeType = 'class' | 'spec'

interface DiffSummaryPanelProps {
  diffResult: TalentDiffResult
  specData: SpecTalentData | null
}

export function DiffSummaryPanel({ diffResult, specData }: DiffSummaryPanelProps) {
  const [isOpen, setIsOpen] = useState(true)

  const { summary } = diffResult

  // Calculate column separators to determine class vs spec tree (similar to TalentTreeView)
  const getTreeType = useMemo(() => {
    if (!specData) return () => 'class' as TreeType

    // Get all X positions and find the gap between class and spec trees
    const xPositions = [...new Set(specData.nodes.map(n => n.posX))].sort((a, b) => a - b)

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

  const formatChangeDetails = (diff: TalentDiffNode): string | null => {
    if (!diff.changeDetails) return null
    const parts: string[] = []
    if (diff.changeDetails.rankChange) {
      const { from, to } = diff.changeDetails.rankChange
      parts.push(`Rank: ${from} → ${to}`)
    }
    if (diff.changeDetails.choiceChange) {
      const { from, to } = diff.changeDetails.choiceChange
      // Try to get actual spell names for choice changes
      if (specData) {
        const node = specData.nodes[diff.nodeIndex]
        if (node && node.entries.length > 1) {
          const fromName = node.entries[from]?.name || `Option ${from + 1}`
          const toName = node.entries[to]?.name || `Option ${to + 1}`
          parts.push(`${fromName} → ${toName}`)
        } else {
          parts.push(`Choice: ${from + 1} → ${to + 1}`)
        }
      } else {
        parts.push(`Choice: ${from + 1} → ${to + 1}`)
      }
    }
    return parts.length > 0 ? parts.join(', ') : null
  }

  // Group node indices by tree type
  const groupByTree = (nodeIndices: number[]): { class: number[]; spec: number[] } => {
    const result = { class: [] as number[], spec: [] as number[] }
    for (const idx of nodeIndices) {
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

  const totalChanges = summary.added.length + summary.removed.length + summary.changed.length

  // Helper to render a talent item with Wowhead tooltip
  const renderTalentItem = (
    nodeIndex: number,
    showDetails: boolean = false
  ) => {
    const spellId = getNodeSpellId(nodeIndex)
    const name = getNodeName(nodeIndex)
    const diff = showDetails ? getDiffNode(nodeIndex) : undefined
    const details = diff ? formatChangeDetails(diff) : null

    if (spellId) {
      return (
        <li key={nodeIndex}>
          <a
            href={`https://www.wowhead.com/spell=${spellId}`}
            className="diff-talent-link"
            target="_blank"
            rel="noopener noreferrer"
            data-wowhead={`spell=${spellId}`}
          >
            {name}
          </a>
          {details && <span className="diff-item-details">{details}</span>}
        </li>
      )
    }

    return (
      <li key={nodeIndex}>
        <span className="diff-item-name">{name}</span>
        {details && <span className="diff-item-details">{details}</span>}
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

  // Get all changes grouped by tree type
  const groupedAdded = groupByTree(summary.added)
  const groupedRemoved = groupByTree(summary.removed)
  const groupedChanged = groupByTree(summary.changed)

  const classTotal = groupedAdded.class.length + groupedRemoved.class.length + groupedChanged.class.length
  const specTotal = groupedAdded.spec.length + groupedRemoved.spec.length + groupedChanged.spec.length

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
