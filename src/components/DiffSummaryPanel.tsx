import { useState } from 'react'
import type { TalentDiffResult, TalentDiffNode } from '../lib/talentDiff'
import type { SpecTalentData } from '../data/types'
import './DiffSummaryPanel.css'

interface DiffSummaryPanelProps {
  diffResult: TalentDiffResult
  specData: SpecTalentData | null
}

export function DiffSummaryPanel({ diffResult, specData }: DiffSummaryPanelProps) {
  const [isOpen, setIsOpen] = useState(true)

  const { summary } = diffResult

  const getNodeName = (nodeIndex: number): string => {
    if (!specData) return `Node ${nodeIndex}`
    const node = specData.nodes[nodeIndex]
    if (!node) return `Node ${nodeIndex}`
    return node.entries[0]?.name || `Node ${nodeIndex}`
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

  const totalChanges = summary.added.length + summary.removed.length + summary.changed.length

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
          {summary.added.length > 0 && (
            <div className="diff-section diff-section-added">
              <h4>
                <span className="diff-icon">+</span>
                Added in Build B ({summary.added.length})
              </h4>
              <ul>
                {summary.added.map(nodeIndex => (
                  <li key={nodeIndex}>
                    {getNodeName(nodeIndex)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.removed.length > 0 && (
            <div className="diff-section diff-section-removed">
              <h4>
                <span className="diff-icon">−</span>
                Removed from Build A ({summary.removed.length})
              </h4>
              <ul>
                {summary.removed.map(nodeIndex => (
                  <li key={nodeIndex}>
                    {getNodeName(nodeIndex)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.changed.length > 0 && (
            <div className="diff-section diff-section-changed">
              <h4>
                <span className="diff-icon">~</span>
                Changed ({summary.changed.length})
              </h4>
              <ul>
                {summary.changed.map(nodeIndex => {
                  const diff = getDiffNode(nodeIndex)
                  const details = diff ? formatChangeDetails(diff) : null
                  return (
                    <li key={nodeIndex}>
                      <span className="diff-item-name">{getNodeName(nodeIndex)}</span>
                      {details && <span className="diff-item-details">{details}</span>}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
