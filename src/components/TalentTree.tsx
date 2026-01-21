import type { ParsedTalentData } from '../lib/talentParser'
import type { TalentDiffResult } from '../lib/talentDiff'
import { useSpecData } from '../hooks/useSpecData'
import { TalentTreeView } from './TalentTreeView'
import './TalentTree.css'

interface TalentTreeProps {
  data: ParsedTalentData
  diffResult?: TalentDiffResult
}

export function TalentTree({ data, diffResult }: TalentTreeProps) {
  const { data: specData, loading, error } = useSpecData(data.specId)

  const selectedNodes = data.nodes.filter(n => n.isSelected)
  const purchasedNodes = data.nodes.filter(n => n.isPurchased)
  const choiceNodes = data.nodes.filter(n => n.isChoiceNode)

  return (
    <div className="talent-tree-container">
      <div className="talent-tree-header">
        <h3>
          {data.specName || 'Unknown Spec'}
          {specData && <span className="class-name"> {specData.className}</span>}
        </h3>
        <div className="spec-info">
          <span className="spec-id">Spec ID: {data.specId}</span>
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

      {/* Visual Tree View */}
      {loading && (
        <div className="loading-message">Loading talent tree data...</div>
      )}

      {error && (
        <div className="error-message tree-error">{error}</div>
      )}

      {specData && (
        <TalentTreeView specData={specData} selectedNodes={data.nodes} diffResult={diffResult} />
      )}

      {!specData && !loading && !error && (
        <div className="no-data-message">
          No tree data available for this spec. Run <code>npm run fetch-data</code> to download.
        </div>
      )}

      <div className="talent-tree-hash">
        <strong>Tree Hash:</strong>
        <code>{data.treeHash}</code>
      </div>
    </div>
  )
}
