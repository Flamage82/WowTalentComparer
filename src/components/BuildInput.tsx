import { useState, useEffect, useRef } from 'react'
import { parseTalentString, type ParsedTalentData } from '../lib/talentParser'
import './BuildInput.css'

interface BuildInputProps {
  label: string
  onLoad: (data: ParsedTalentData | null, rawString: string | null) => void
  initialValue?: string
}

export function BuildInput({ label, onLoad, initialValue = '' }: BuildInputProps) {
  const [value, setValue] = useState(initialValue)
  const [specName, setSpecName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lastLoadedValue = useRef<string>('')

  // Auto-load when value changes to a valid talent string
  useEffect(() => {
    const trimmed = value.trim()

    // Skip if empty or already loaded this value
    if (!trimmed || trimmed === lastLoadedValue.current) return

    try {
      const data = parseTalentString(trimmed)
      setSpecName(data.specName || `Spec ${data.specId}`)
      setError(null)
      lastLoadedValue.current = trimmed
      onLoad(data, trimmed)
    } catch {
      // Don't show error during typing - only clear if we had a valid load before
      if (lastLoadedValue.current) {
        setError(null)
        setSpecName(null)
        lastLoadedValue.current = ''
        onLoad(null, null)
      }
    }
  }, [value, onLoad])

  const handleLoad = () => {
    if (!value.trim()) return

    try {
      const data = parseTalentString(value.trim())
      setSpecName(data.specName || `Spec ${data.specId}`)
      setError(null)
      lastLoadedValue.current = value.trim()
      onLoad(data, value.trim())
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to parse talent string'
      setError(errorMsg)
      setSpecName(null)
      lastLoadedValue.current = ''
      onLoad(null, null)
    }
  }

  const handleClear = () => {
    setValue('')
    setSpecName(null)
    setError(null)
    lastLoadedValue.current = ''
    onLoad(null, null)
  }

  return (
    <div className="build-input">
      <div className="build-input-header">
        <label className="build-input-label">{label}</label>
        {specName && <span className="build-input-spec">{specName}</span>}
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Paste ${label} talent string...`}
        rows={2}
      />
      {error && <div className="build-input-error">{error}</div>}
      <div className="build-input-actions">
        {(value || specName) && (
          <button type="button" onClick={handleClear} className="build-input-clear">
            Clear
          </button>
        )}
        <button type="button" onClick={handleLoad} disabled={!value.trim()}>
          Load
        </button>
      </div>
    </div>
  )
}
