import { FolderOpen, Search, GitBranch, Puzzle, Settings, Files } from 'lucide-react'

export function Sidebar({ active, onSelect }: { active: string; onSelect: (panel: string) => void }) {
  const icons = [
    { id: 'explorer', icon: Files, label: 'Explorer' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'git', icon: GitBranch, label: 'Source Control' },
    { id: 'extensions', icon: Puzzle, label: 'Extensions' },
    { id: 'settings', icon: Settings, label: 'Settings' }
  ]

  return (
    <div className="sidebar-icons">
      {icons.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className={`sidebar-icon ${active === id ? 'active' : ''}`}
          title={label}
        >
          <Icon size={20} />
        </button>
      ))}
    </div>
  )
}

