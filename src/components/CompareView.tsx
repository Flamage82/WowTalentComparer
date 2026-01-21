import { useMemo } from 'react'
import type { ParsedTalentData } from '../lib/talentParser'
import { diffTalentBuilds, type TalentDiffResult } from '../lib/talentDiff'
import { useSpecData } from '../hooks/useSpecData'
import { DiffSummaryPanel } from './DiffSummaryPanel'
import { TalentTreeView } from './TalentTreeView'
import './CompareView.css'

interface CompareViewProps {
  buildA: ParsedTalentData
  buildB: ParsedTalentData
}

export function CompareView({ buildA, buildB }: CompareViewProps) {
  const { data: specData, loading, error } = useSpecData(buildA.specId)

  const diffResult = useMemo<TalentDiffResult>(() => {
    return diffTalentBuilds(buildA, buildB)
  }, [buildA, buildB])

  // For the tree view, we show Build B's selections as the "current" state
  // with diff highlighting showing what changed from Build A
  const selectedNodes = buildB.nodes

  return (
    <div className="compare-view">
      <div className="compare-view-header">
        <h3>
          {buildA.specName || `Spec ${buildA.specId}`}
          {specData && <span className="compare-view-class"> {specData.className}</span>}
        </h3>
        <div className="compare-view-builds">
          <span className="compare-view-build-label build-a">Build A</span>
          <span className="compare-view-vs">→</span>
          <span className="compare-view-build-label build-b">Build B</span>
        </div>
      </div>

      {loading && (
        <div className="compare-view-loading">Loading talent tree data...</div>
      )}

      {error && (
        <div className="compare-view-error">{error}</div>
      )}

      {specData && (
        <TalentTreeView
          specData={specData}
          selectedNodes={selectedNodes}
          diffResult={diffResult}
        />
      )}

      <DiffSummaryPanel diffResult={diffResult} specData={specData} />

      {!specData && !loading && !error && (
        <div className="compare-view-no-data">
          No tree data available for this spec. Run <code>npm run fetch-data</code> to download.
        </div>
      )}
    </div>
  )
}
