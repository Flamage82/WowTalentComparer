import { useState, useEffect, useMemo } from 'react'
import type { ParsedTalentData } from '../lib/talentParser'
import { diffTalentBuilds, type TalentDiffResult } from '../lib/talentDiff'
import { useSpecData } from '../hooks/useSpecData'
import { DiffSummaryPanel } from './DiffSummaryPanel'
import { TalentTreeView } from './TalentTreeView'
import './CompareView.css'

type ViewMode = 'buildA' | 'buildB' | 'comparison'

interface CompareViewProps {
  buildA: ParsedTalentData
  buildB: ParsedTalentData
  onTreeWidthChange?: (width: number) => void
}

export function CompareView({ buildA, buildB, onTreeWidthChange }: CompareViewProps) {
  const { data: specData, loading, error } = useSpecData(buildA.specId)
  const [treeWidth, setTreeWidth] = useState<number | undefined>(undefined)

  // Notify parent when tree width changes
  useEffect(() => {
    if (treeWidth !== undefined) {
      onTreeWidthChange?.(treeWidth)
    }
  }, [treeWidth, onTreeWidthChange])

  // View mode state with URL initialization
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search)
    const mode = params.get('view')
    if (mode === 'buildA' || mode === 'buildB') return mode
    return 'comparison'
  })

  // Sync view mode to URL
  useEffect(() => {
    const url = new URL(window.location.href)
    if (viewMode === 'comparison') {
      url.searchParams.delete('view')
    } else {
      url.searchParams.set('view', viewMode)
    }
    window.history.replaceState({}, '', url.toString())
  }, [viewMode])

  // Always compute diffResult for DiffSummaryPanel
  const diffResult = useMemo<TalentDiffResult>(() => {
    return diffTalentBuilds(buildA, buildB)
  }, [buildA, buildB])

  // Compute selectedNodes, diffResultToPass, and comparisonNodes based on view mode
  const { selectedNodes, diffResultToPass, comparisonNodes } = useMemo(() => {
    if (viewMode === 'buildA') {
      return { selectedNodes: buildA.nodes, diffResultToPass: undefined, comparisonNodes: undefined }
    }
    if (viewMode === 'buildB') {
      return { selectedNodes: buildB.nodes, diffResultToPass: undefined, comparisonNodes: undefined }
    }
    // Comparison mode: show Build B with diff highlighting, pass Build A for comparison
    return { selectedNodes: buildB.nodes, diffResultToPass: diffResult, comparisonNodes: buildA.nodes }
  }, [viewMode, buildA.nodes, buildB.nodes, diffResult])

  return (
    <div className="compare-view">
      <div className="compare-view-header">
        <h3>
          {buildA.specName || `Spec ${buildA.specId}`}
          {specData && <span className="compare-view-class"> {specData.className}</span>}
        </h3>
        <div className="compare-view-controls">
          <div className="compare-view-builds">
            <span className="compare-view-build-label build-a">Build A</span>
            <span className="compare-view-vs">→</span>
            <span className="compare-view-build-label build-b">Build B</span>
          </div>
          <div className="view-mode-switcher">
            <button
              className={`view-mode-button ${viewMode === 'buildA' ? 'active' : ''}`}
              onClick={() => setViewMode('buildA')}
              aria-pressed={viewMode === 'buildA'}
            >
              Build A
            </button>
            <button
              className={`view-mode-button ${viewMode === 'buildB' ? 'active' : ''}`}
              onClick={() => setViewMode('buildB')}
              aria-pressed={viewMode === 'buildB'}
            >
              Build B
            </button>
            <button
              className={`view-mode-button ${viewMode === 'comparison' ? 'active' : ''}`}
              onClick={() => setViewMode('comparison')}
              aria-pressed={viewMode === 'comparison'}
            >
              Comparison
            </button>
          </div>
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
          diffResult={diffResultToPass}
          comparisonNodes={comparisonNodes}
          onDimensionsChange={setTreeWidth}
        />
      )}

      <DiffSummaryPanel diffResult={diffResult} specData={specData} treeWidth={treeWidth} />

      {!specData && !loading && !error && (
        <div className="compare-view-no-data">
          No tree data available for this spec. Run <code>npm run fetch-data</code> to download.
        </div>
      )}
    </div>
  )
}
