// Lebar panel yang bisa digeser. Disimpan di localStorage agar bertahan.
// cfg: { key, min, max, initial, handleSide } — handleSide 'left' berarti
// menggeser ke kiri memperlebar (panel kanan), 'right' sebaliknya (sidebar).
import { useEffect, useRef, useState } from 'react'

const clamp = (n, cfg) => Math.min(cfg.max, Math.max(cfg.min, Math.round(n)))

function stored(cfg) {
  const saved = Number(localStorage.getItem(cfg.key))
  return saved ? clamp(saved, cfg) : cfg.initial
}

export default function usePanelWidth(cfg) {
  const [width, setWidth] = useState(() => stored(cfg))
  const [dragging, setDragging] = useState(false)
  const origin = useRef({ x: 0, width: 0 })
  const sign = cfg.handleSide === 'left' ? -1 : 1

  useEffect(() => localStorage.setItem(cfg.key, String(width)), [cfg.key, width])

  function onPointerDown(e) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    origin.current = { x: e.clientX, width }
    setDragging(true)
  }

  function onPointerMove(e) {
    if (!dragging) return
    const delta = (e.clientX - origin.current.x) * sign
    setWidth(clamp(origin.current.width + delta, cfg))
  }

  function onPointerUp(e) {
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
  }

  function onKeyDown(e) {
    const step = (e.shiftKey ? 32 : 8) * sign
    if (e.key === 'ArrowLeft') setWidth((w) => clamp(w - step, cfg))
    if (e.key === 'ArrowRight') setWidth((w) => clamp(w + step, cfg))
  }

  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
    onDoubleClick: () => setWidth(cfg.initial),
  }
  return { width, dragging, handlers }
}
