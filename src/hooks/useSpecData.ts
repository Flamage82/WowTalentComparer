import { useState, useEffect } from 'react'
import type { SpecTalentData, SpecIndex } from '../data/types'

// Import index statically
import specIndex from '../data/specs/index.json'

export function useSpecIndex(): SpecIndex[] {
  return specIndex as SpecIndex[]
}

export function useSpecData(specId: number | null): {
  data: SpecTalentData | null
  loading: boolean
  error: string | null
} {
  const [data, setData] = useState<SpecTalentData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (specId === null) {
      setData(null)
      return
    }

    setLoading(true)
    setError(null)

    // Dynamic import of spec data
    import(`../data/specs/${specId}.json`)
      .then((module) => {
        setData(module.default as SpecTalentData)
        setLoading(false)
      })
      .catch((err) => {
        setError(`Failed to load spec data: ${err.message}`)
        setLoading(false)
      })
  }, [specId])

  return { data, loading, error }
}
