// Pemisah dua bagian sidebar: transkrip (unggah) vs unduh (dari URL).
import TabBar from './TabBar'

export default function SidebarTabs({ active, counts, onChange }) {
  const tabs = [
    { id: 'transkrip', label: 'Transkrip', count: counts?.transkrip },
    { id: 'unduh', label: 'Unduh', count: counts?.unduh },
  ]
  return <TabBar tabs={tabs} active={active} onChange={onChange} />
}
