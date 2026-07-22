// Render subset Markdown yang memang kita minta di prompt: "## judul", "- butir",
// paragraf. Sengaja bukan library — formatnya kita sendiri yang tentukan.
export default function SummaryText({ text }) {
  return (
    <div className="space-y-1.5">
      {parse(text).map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  )
}

function Block({ block }) {
  if (block.type === 'h')
    return (
      <h4 className="pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-mint">
        {block.text}
      </h4>
    )
  if (block.type === 'li')
    return (
      <div className="flex gap-2 text-xs leading-relaxed text-fg2">
        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-fg3" />
        <span>{block.text}</span>
      </div>
    )
  return <p className="text-xs leading-relaxed text-fg2">{block.text}</p>
}

function parse(text) {
  const out = []
  for (const raw of (text ?? '').split('\n')) {
    const line = clean(raw)
    if (!line) continue
    if (line.startsWith('## ')) out.push({ type: 'h', text: line.slice(3) })
    else if (/^[-*]\s/.test(line)) out.push({ type: 'li', text: line.slice(2) })
    else out.push({ type: 'p', text: line })
  }
  return out
}

function clean(s) {
  const line = s.replace(/\*\*/g, '').trim()  // bintang tebal jangan terbaca sebagai teks
  return line.replace(/^#{1,6}\s+/, '## ')    // heading tingkat apa pun -> satu gaya
}
