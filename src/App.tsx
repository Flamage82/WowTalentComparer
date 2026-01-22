import { useState, useEffect } from 'react'
import { CompareInput } from './components/CompareInput'
import { CompareView } from './components/CompareView'
import type { ParsedTalentData } from './lib/talentParser'
import './App.css'

interface InitialBuilds {
  buildA: string
  buildB: string
}

function getInitialBuilds(): InitialBuilds {
  const params = new URLSearchParams(window.location.search)
  return {
    buildA: params.get('buildA') || '',
    buildB: params.get('buildB') || '',
  }
}

function updateUrl(buildA: string | null, buildB: string | null) {
  const url = new URL(window.location.href)

  if (buildA) {
    url.searchParams.set('buildA', buildA)
  } else {
    url.searchParams.delete('buildA')
  }

  if (buildB) {
    url.searchParams.set('buildB', buildB)
  } else {
    url.searchParams.delete('buildB')
  }

  window.history.replaceState({}, '', url.toString())
}

function App() {
  const [initialBuilds] = useState(getInitialBuilds)
  const [buildA, setBuildA] = useState<ParsedTalentData | null>(null)
  const [buildB, setBuildB] = useState<ParsedTalentData | null>(null)
  const [buildAString, setBuildAString] = useState<string | null>(null)
  const [buildBString, setBuildBString] = useState<string | null>(null)
  const [treeWidth, setTreeWidth] = useState<number | undefined>(undefined)
  // Compute spec mismatch synchronously to prevent race conditions
  const specMismatchError = buildA && buildB && buildA.specId !== buildB.specId
    ? `Cannot compare different specs: ${buildA.specName || `Spec ${buildA.specId}`} vs ${buildB.specName || `Spec ${buildB.specId}`}`
    : null

  // Check if builds are identical
  const buildsIdentical = buildAString && buildBString && buildAString === buildBString

  // Update URL when builds change
  useEffect(() => {
    updateUrl(buildAString, buildBString)
  }, [buildAString, buildBString])

  const handleBuildAChange = (data: ParsedTalentData | null, rawString: string | null) => {
    setBuildA(data)
    setBuildAString(rawString)
  }

  const handleBuildBChange = (data: ParsedTalentData | null, rawString: string | null) => {
    setBuildB(data)
    setBuildBString(rawString)
  }

  const canCompare = buildA && buildB && !specMismatchError

  return (
    <>
      <header>
        <h1>WoW Talent Comparer</h1>
        <h2>Compare two talent builds to see the differences</h2>
      </header>

      <main
        className="main-content"
        style={treeWidth ? { maxWidth: treeWidth } : undefined}
      >
        <CompareInput
          onBuildAChange={handleBuildAChange}
          onBuildBChange={handleBuildBChange}
          initialBuildA={initialBuilds.buildA}
          initialBuildB={initialBuilds.buildB}
        />

        {specMismatchError && (
          <div className="error-message">
            {specMismatchError}
          </div>
        )}

        {buildsIdentical && (
          <div className="info-message">
            These builds are identical
          </div>
        )}

        {canCompare && (
          <CompareView buildA={buildA} buildB={buildB} onTreeWidthChange={setTreeWidth} />
        )}

        {!canCompare && (buildA || buildB) && !specMismatchError && (
          <div className="info-message">
            Load both builds to see the comparison
          </div>
        )}
      </main>
    </>
  )
}

export default App
