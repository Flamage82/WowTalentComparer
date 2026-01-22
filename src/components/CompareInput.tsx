import { useState } from 'react'
import { BuildInput } from './BuildInput'
import type { ParsedTalentData } from '../lib/talentParser'
import './CompareInput.css'

interface CompareInputProps {
  onBuildAChange: (data: ParsedTalentData | null, rawString: string | null) => void
  onBuildBChange: (data: ParsedTalentData | null, rawString: string | null) => void
  initialBuildA?: string
  initialBuildB?: string
}

export function CompareInput({
  onBuildAChange,
  onBuildBChange,
  initialBuildA = '',
  initialBuildB = '',
}: CompareInputProps) {
  const [buildAValue, setBuildAValue] = useState(initialBuildA)
  const [buildBValue, setBuildBValue] = useState(initialBuildB)

  const handleSwap = () => {
    const tempA = buildAValue
    setBuildAValue(buildBValue)
    setBuildBValue(tempA)
  }

  return (
    <div className="compare-input">
      <BuildInput
        label="Build A"
        onLoad={onBuildAChange}
        value={buildAValue}
        onValueChange={setBuildAValue}
      />
      <div className="compare-input-divider">
        <button
          className="compare-input-swap"
          onClick={handleSwap}
          title="Swap builds"
          aria-label="Swap Build A and Build B"
        >
          ⇄
        </button>
      </div>
      <BuildInput
        label="Build B"
        onLoad={onBuildBChange}
        value={buildBValue}
        onValueChange={setBuildBValue}
      />
    </div>
  )
}
