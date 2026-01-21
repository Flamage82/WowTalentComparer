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
  return (
    <div className="compare-input">
      <BuildInput
        label="Build A"
        onLoad={onBuildAChange}
        initialValue={initialBuildA}
      />
      <div className="compare-input-divider">
        <span className="compare-input-vs">vs</span>
      </div>
      <BuildInput
        label="Build B"
        onLoad={onBuildBChange}
        initialValue={initialBuildB}
      />
    </div>
  )
}
