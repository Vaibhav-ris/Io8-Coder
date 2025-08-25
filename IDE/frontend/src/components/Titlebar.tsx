import { Moon, Sun, Play, Terminal, MessageSquare } from 'lucide-react'
import { useState } from 'react'

export function Titlebar({
  onToggleChat,
  chatVisible,
  onRun,
  onToggleTerminal,
  terminalVisible
}: {
  onToggleChat: () => void
  chatVisible: boolean
  onRun: () => void
  onToggleTerminal: () => void
  terminalVisible: boolean
}) {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark')

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)
    // Broadcast theme change for Monaco editor
    window.dispatchEvent(new CustomEvent('ide-theme-change'))
  }

  return (
    <div className="titlebar">
      <div className="flex items-center gap-6 px-4">
        <span className="font-semibold text-[var(--text)]">Online IDE</span>
        <div className="flex items-center gap-1">
          <button className="vscode-button">File</button>
          <button className="vscode-button">Edit</button>
          <button className="vscode-button">Selection</button>
          <button className="vscode-button">View</button>
          <button className="vscode-button">Run</button>
          <button className="vscode-button">Help</button>
        </div>
      </div>
      
      <div className="flex items-center gap-2 px-4">
        <button
          onClick={onRun}
          className="vscode-button primary"
          title="Run Code"
        >
          <Play size={14} />
          Run
        </button>
        
        <button
          onClick={onToggleTerminal}
          className={`vscode-button ${terminalVisible ? 'primary' : ''}`}
          title="Toggle Terminal"
        >
          <Terminal size={14} />
          Terminal
        </button>
        
        <button
          onClick={onToggleChat}
          className={`vscode-button ${chatVisible ? 'primary' : ''}`}
          title={chatVisible ? 'Hide AI Chat' : 'Show AI Chat'}
        >
          <MessageSquare size={14} />
          {chatVisible ? 'Hide Chat' : 'AI Chat'}
        </button>
        
        <button
          onClick={toggleTheme}
          className="vscode-button"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </div>
  )
}
