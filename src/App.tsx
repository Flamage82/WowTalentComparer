import { useState, useEffect } from 'react'
import { TalentInput } from './components/TalentInput'
import { TalentTree } from './components/TalentTree'
import { parseTalentString, type ParsedTalentData } from './lib/talentParser'
import './App.css'

function getInitialTalentString(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('build') || ''
}

function updateUrlWithTalentString(talentString: string) {
  const url = new URL(window.location.href)
  if (talentString) {
    url.searchParams.set('build', talentString)
  } else {
    url.searchParams.delete('build')
  }
  window.history.replaceState({}, '', url.toString())
}

function App() {
  const [talentString, setTalentString] = useState(getInitialTalentString)
  const [parsedData, setParsedData] = useState<ParsedTalentData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Parse initial talent string from URL on mount
  useEffect(() => {
    if (talentString) {
      try {
        const data = parseTalentString(talentString)
        setParsedData(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to parse talent string')
      }
    }
  }, [])

  const handleTalentStringSubmit = (newTalentString: string) => {
    setError(null)
    setTalentString(newTalentString)
    updateUrlWithTalentString(newTalentString)
    try {
      const data = parseTalentString(newTalentString)
      setParsedData(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse talent string')
      setParsedData(null)
    }
  }

  return (
    <>
      <header>
        <h1>WoW Talent Comparer</h1>
        <h2>Paste a talent export string to visualize your build</h2>
      </header>

      <main>
        <TalentInput onSubmit={handleTalentStringSubmit} initialValue={talentString} />

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {parsedData && (
          <TalentTree data={parsedData} />
        )}
      </main>
    </>
  )
}

export default App
