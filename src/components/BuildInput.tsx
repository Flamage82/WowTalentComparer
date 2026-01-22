import { useState, useEffect, useRef } from 'react'
import { parseTalentString, type ParsedTalentData } from '../lib/talentParser'
import { useSpecData } from '../hooks/useSpecData'
import { getSelectedHeroTree } from '../lib/heroTreeDetection'
import './BuildInput.css'

interface BuildInputProps {
  label: string
  onLoad: (data: ParsedTalentData | null, rawString: string | null) => void
  initialValue?: string
  value?: string
  onValueChange?: (value: string) => void
}

export function BuildInput({ label, onLoad, initialValue = '', value: controlledValue, onValueChange }: BuildInputProps) {
  const [internalValue, setInternalValue] = useState(initialValue)
  const value = controlledValue !== undefined ? controlledValue : internalValue
  const setValue = (newValue: string) => {
    if (onValueChange) {
      onValueChange(newValue)
    } else {
      setInternalValue(newValue)
    }
  }
  const [specId, setSpecId] = useState<number | null>(null)
  const [parsedNodes, setParsedNodes] = useState<ParsedTalentData['nodes'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lastLoadedValue = useRef<string>('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Load spec data to get hero tree information
  const { data: specData } = useSpecData(specId)

  // Determine the selected hero tree
  const heroTreeName = specData && parsedNodes
    ? getSelectedHeroTree(specData, parsedNodes)?.name ?? null
    : null

  // Auto-load when value changes
  useEffect(() => {
    const trimmed = value.trim()

    // If empty, clear everything
    if (!trimmed) {
      if (lastLoadedValue.current) {
        setSpecId(null)
        setParsedNodes(null)
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
      setSpecId(data.specId)
      setParsedNodes(data.nodes)
      setError(null)
      lastLoadedValue.current = trimmed
      onLoad(data, trimmed)
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Invalid talent string'
      setError(errorMsg)
      setSpecId(null)
      setParsedNodes(null)
      lastLoadedValue.current = ''
      onLoad(null, null)
    }
  }, [value, onLoad])

  const handleFocus = () => {
    inputRef.current?.select()
  }

  return (
    <div className="build-input">
      <div className="build-input-header">
        <label className="build-input-label">{label}</label>
        {specData && (
          <span className="build-input-spec">
            {specData.className} / {specData.specName}
            {heroTreeName && ` / ${heroTreeName}`}
          </span>
        )}
      </div>
      <input
        type="text"
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={handleFocus}
        placeholder={`Paste ${label} talent string...`}
      />
      {error && <div className="build-input-error">{error}</div>}
    </div>
  )
}
