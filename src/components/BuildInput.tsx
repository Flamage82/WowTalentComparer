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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-load when value changes
  useEffect(() => {
    const trimmed = value.trim()

    // If empty, clear everything
    if (!trimmed) {
      if (lastLoadedValue.current) {
        setSpecName(null)
        setError(null)
        lastLoadedValue.current = ''
        onLoad(null, null)
      }
      return
    }

    // Skip if already loaded this value
    if (trimmed === lastLoadedValue.current) return

    try {
      const data = parseTalentString(trimmed)
      setSpecName(data.specName || `Spec ${data.specId}`)
      setError(null)
      lastLoadedValue.current = trimmed
      onLoad(data, trimmed)
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Invalid talent string'
      setError(errorMsg)
      setSpecName(null)
      lastLoadedValue.current = ''
      onLoad(null, null)
    }
  }, [value, onLoad])

  const handleFocus = () => {
    textareaRef.current?.select()
  }

  return (
    <div className="build-input">
      <div className="build-input-header">
        <label className="build-input-label">{label}</label>
        {specName && <span className="build-input-spec">{specName}</span>}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={handleFocus}
        placeholder={`Paste ${label} talent string...`}
        rows={2}
      />
      {error && <div className="build-input-error">{error}</div>}
    </div>
  )
}
