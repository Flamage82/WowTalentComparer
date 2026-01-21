import { useState } from 'react'
import { TalentInput } from './components/TalentInput'
import { TalentTree } from './components/TalentTree'
import { parseTalentString, type ParsedTalentData } from './lib/talentParser'
import './App.css'

function App() {
  const [parsedData, setParsedData] = useState<ParsedTalentData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleTalentStringSubmit = (talentString: string) => {
    setError(null)
    try {
      const data = parseTalentString(talentString)
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
        <TalentInput onSubmit={handleTalentStringSubmit} />

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
