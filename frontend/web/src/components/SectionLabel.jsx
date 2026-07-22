// Label kecil huruf-besar di atas tiap blok sidebar.
export default function SectionLabel({ children }) {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-fg3">
      {children}
    </div>
  )
}
