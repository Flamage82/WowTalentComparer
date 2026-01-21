import { useState } from 'react'
import './TalentInput.css'

interface TalentInputProps {
  onSubmit: (talentString: string) => void
  initialValue?: string
}

export function TalentInput({ onSubmit, initialValue = '' }: TalentInputProps) {
  const [value, setValue] = useState(initialValue)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      onSubmit(value.trim())
    }
  }

  return (
    <form className="talent-input" onSubmit={handleSubmit}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste your talent export string here..."
        rows={3}
      />
      <button type="submit" disabled={!value.trim()}>
        Load Talents
      </button>
    </form>
  )
}
