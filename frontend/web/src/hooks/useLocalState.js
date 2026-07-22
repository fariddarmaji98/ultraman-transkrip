// State string kecil yang bertahan di localStorage (mis. tab sidebar aktif).
import { useEffect, useState } from 'react'

export default function useLocalState(key, initial) {
  const [value, setValue] = useState(() => localStorage.getItem(key) ?? initial)
  useEffect(() => localStorage.setItem(key, value), [key, value])
  return [value, setValue]
}
