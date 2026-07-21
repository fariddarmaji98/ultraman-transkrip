// Lebar sidebar yang bisa digeser. Disimpan di localStorage agar bertahan.
import { useEffect, useRef, useState } from 'react'

const KEY = 'sidebar-width'
const MIN = 280
const MAX = 560
const DEFAULT = 340

const clamp = (n) => Math.min(MAX, Math.max(MIN, Math.round(n)))

function initial() {
  const saved = Number(localStorage.getItem(KEY))
  return saved ? clamp(saved) : DEFAULT
}

export default function useSidebarWidth() {
  const [width, setWidth] = useState(initial)
  const [dragging, setDragging] = useState(false)
  const origin = useRef({ x: 0, width: DEFAULT })

  useEffect(() => localStorage.setItem(KEY, String(width)), [width])

  function onPointerDown(e) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    origin.current = { x: e.clientX, width }
    setDragging(true)
  }

  function onPointerMove(e) {
    if (!dragging) return
    setWidth(clamp(origin.current.width + e.clientX - origin.current.x))
  }

  function onPointerUp(e) {
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
  }

  function onKeyDown(e) {
    const step = e.shiftKey ? 32 : 8
    if (e.key === 'ArrowLeft') setWidth((w) => clamp(w - step))
    if (e.key === 'ArrowRight') setWidth((w) => clamp(w + step))
  }

  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
    onDoubleClick: () => setWidth(DEFAULT),
  }
  return { width, dragging, handlers }
}
