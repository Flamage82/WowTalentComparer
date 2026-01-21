import type { ParsedTalentData } from '../lib/talentParser'
import './TalentTree.css'

interface TalentTreeProps {
  data: ParsedTalentData
}

export function TalentTree({ data }: TalentTreeProps) {
  const selectedNodes = data.nodes.filter(n => n.isSelected)
  const purchasedNodes = data.nodes.filter(n => n.isPurchased)
  const choiceNodes = data.nodes.filter(n => n.isChoiceNode)

  return (
    <div className="talent-tree-container">
      <div className="talent-tree-header">
        <h3>Parsed Talent Data</h3>
        <div className="spec-info">
          <span className="spec-id">Spec ID: {data.specId}</span>
          {data.specName && <span className="spec-name">{data.specName}</span>}
        </div>
      </div>

      <div className="talent-tree-stats">
        <div className="stat">
          <span className="stat-value">{data.version}</span>
          <span className="stat-label">Version</span>
        </div>
        <div className="stat">
          <span className="stat-value">{data.nodes.length}</span>
          <span className="stat-label">Total Nodes</span>
        </div>
        <div className="stat">
          <span className="stat-value">{selectedNodes.length}</span>
          <span className="stat-label">Selected</span>
        </div>
        <div className="stat">
          <span className="stat-value">{purchasedNodes.length}</span>
          <span className="stat-label">Purchased</span>
        </div>
        <div className="stat">
          <span className="stat-value">{choiceNodes.length}</span>
          <span className="stat-label">Choice Nodes</span>
        </div>
      </div>

      <div className="talent-tree-debug">
        <h4>Selected Talents</h4>
        <div className="node-list">
          {selectedNodes.map((node) => (
            <span
              key={node.nodeIndex}
              className={`node-badge ${node.isPurchased ? 'purchased' : 'granted'} ${node.isChoiceNode ? 'choice' : ''}`}
            >
              #{node.nodeIndex}
              {node.isPurchased && ' (purchased)'}
              {!node.isPurchased && ' (granted)'}
              {node.isChoiceNode && ` [choice: ${node.choiceEntryIndex}]`}
              {node.isPartiallyRanked && ` (${node.ranksPurchased} ranks)`}
            </span>
          ))}
        </div>
      </div>

      <div className="talent-tree-hash">
        <strong>Tree Hash:</strong>
        <code>{data.treeHash}</code>
      </div>
    </div>
  )
}
