// Batang geser lebar panel. Induknya wajib `relative`.
export default function ResizeHandle({ side = 'right', dragging, handlers }) {
  const pos = side === 'left' ? '-left-1' : '-right-1'
  return (
    <div
      {...handlers}
      role="separator"
      aria-orientation="vertical"
      aria-label="Geser untuk mengubah lebar panel"
      title="Geser untuk mengubah lebar · klik ganda untuk reset"
      tabIndex={0}
      className={`group absolute inset-y-0 ${pos} z-20 flex w-2 cursor-col-resize justify-center outline-none`}
    >
      <span
        className={`h-full w-px transition-colors ${
          dragging ? 'bg-mint' : 'bg-transparent group-hover:bg-mint/60 group-focus:bg-mint/60'
        }`}
      />
    </div>
  )
}
