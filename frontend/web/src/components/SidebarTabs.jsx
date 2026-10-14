// Pemisah sidebar: Media (mentah), Transkrip (setengah matang), Summary (matang).
import TabBar from './TabBar'

export default function SidebarTabs({ active, counts, onChange, ...rest }) {
  const tabs = [
    { id: 'media', label: 'Media', count: counts?.media },
    { id: 'transkrip', label: 'Transkrip', count: counts?.transkrip },
    { id: 'summary', label: 'Summary', count: counts?.summary },
  ]
  return <TabBar tabs={tabs} active={active} onChange={onChange} {...rest} />
}
