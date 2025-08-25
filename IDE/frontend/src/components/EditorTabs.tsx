import { useEffect, useRef, useState } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import { saveFile } from '../lib/api'
import { X, Play } from 'lucide-react'

export type Tab = {
  path: string
  language: string
  content: string
  isUnsaved?: boolean
}

export function EditorTabs({
  tabs,
  setTabs,
  activePath,
  setActivePath,
  appendTerminal,
  onRunCode
}: {
  tabs: Tab[]
  setTabs: (v: Tab[]) => void
  activePath: string | null
  setActivePath: (v: string) => void
  appendTerminal: (text: string, isError?: boolean) => void
  onRunCode?: (fileName: string, code: string) => Promise<void>
}) {
  const active = tabs.find(t => t.path === activePath) || tabs[0]
  const [value, setValue] = useState(active?.content || '')
  const monacoRef = useRef<any>(null)
  const editorRef = useRef<any>(null)

  useEffect(() => { 
    setValue(active?.content || '')
    // Mark as unsaved if content differs from original
    if (active && active.content !== value) {
      setTabs(tabs.map(t => t.path === active.path ? { ...t, isUnsaved: true } : t))
    }
  }, [active?.path])

  const onMount: OnMount = (editor: any, monaco: any) => {
    editorRef.current = editor
    monacoRef.current = monaco
    
    // Set Monaco theme based on current theme
    const theme = (document.documentElement.getAttribute('data-theme') === 'light') ? 'vs' : 'vs-dark'
    monaco.editor.setTheme(theme)
    
    // Enhanced editor options
    editor.updateOptions({ 
      fontSize: 14, 
      fontFamily: 'Consolas, "Courier New", monospace',
      lineNumbers: 'on',
      minimap: { enabled: true },
      folding: true,
      wordWrap: 'on',
      automaticLayout: true,
      scrollBeyondLastLine: false,
      renderWhitespace: 'selection',
      tabSize: 2,
      insertSpaces: true
    })
    
    // Cursor position tracking
    editor.onDidChangeCursorPosition((e: any) => {
      window.dispatchEvent(new CustomEvent('ide-cursor', { detail: { line: e.position.lineNumber, col: e.position.column } }))
    })

    // Content change tracking for unsaved indicator
    editor.onDidChangeModelContent(() => {
      if (active && active.content !== value) {
        setTabs(tabs.map(t => t.path === active.path ? { ...t, isUnsaved: true } : t))
      }
    })
  }

  useEffect(() => {
    const onTheme = () => {
      const monaco = monacoRef.current
      if (!monaco) return
      const theme = (document.documentElement.getAttribute('data-theme') === 'light') ? 'vs' : 'vs-dark'
      monaco.editor.setTheme(theme)
    }
    window.addEventListener('ide-theme-change' as any, onTheme)
    return () => window.removeEventListener('ide-theme-change' as any, onTheme)
  }, [])

  async function saveActive() {
    if (!active) return
    
    try {
      // Try File System Access API first (modern browsers)
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: active.path === 'untitled' ? 'untitled.py' : active.path,
          types: [
            {
              description: 'Python Files',
              accept: { 'text/x-python': ['.py'] }
            },
            {
              description: 'All Files',
              accept: { '*/*': ['*'] }
            }
          ]
        })
        
        const writable = await handle.createWritable()
        await writable.write(value)
        await writable.close()
        
        // Update tab with new path and mark as saved
        const newPath = handle.name
        setTabs(tabs.map(t => t.path === active.path ? { ...t, path: newPath, isUnsaved: false } : t))
        setActivePath(newPath)
        
        alert('File saved successfully!')
        appendTerminal(`\r\n✓ Saved to ${newPath}\r\n`)
      } else {
        // Fallback to workspace save
        await saveFile(active.path, value)
        setTabs(tabs.map(t => t.path === active.path ? { ...t, isUnsaved: false } : t))
        appendTerminal(`\r\n✓ Saved ${active.path}\r\n`)
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // User cancelled save dialog
        return
      }
      appendTerminal(`\r\n✗ Error saving: ${error}\r\n`, true)
    }
  }

  async function runActive() {
    if (!active || !onRunCode) return
    
    try {
      // Execute the code using the terminal's handleRun function
      await onRunCode(active.path, value)
    } catch (error) {
      appendTerminal(`\r\n✗ Failed to run code: ${error}\r\n`, true)
    }
  }

  useEffect(() => {
    const handler = () => runActive()
    window.addEventListener('ide-run-active', handler as any)
    return () => window.removeEventListener('ide-run-active', handler as any)
  }, [active, value, onRunCode])

  function closeTab(tabPath: string) {
    const i = tabs.findIndex(x => x.path === tabPath)
    const next = tabs.filter(x => x.path !== tabPath)
    setTabs(next)
    if (activePath === tabPath) {
      setActivePath(next[i-1]?.path || next[0]?.path || '')
    }
  }

  return (
    <div className="center-editor h-full flex flex-col">
      {/* VS Code-style tab bar */}
      <div className="tab-bar">
        {tabs.map(tab => (
          <div
            key={tab.path}
            className={`tab ${activePath === tab.path ? 'tab-active' : ''}`}
            onClick={() => setActivePath(tab.path)}
          >
            <span className="truncate">{tab.path || 'untitled'}</span>
            {tab.isUnsaved && <span className="text-[var(--accent)] text-xs">●</span>}
            <button
              className="tab-close"
              onClick={(e) => { e.stopPropagation(); closeTab(tab.path) }}
              title="Close"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        
        {/* Action buttons */}
        <div className="ml-auto flex items-center gap-2 pr-2">
          <button
            onClick={saveActive}
            className="vscode-button"
            title="Save (Ctrl+S)"
          >
            Save
          </button>
          <button
            onClick={runActive}
            className="vscode-button primary"
            title="Run Code (Ctrl+F5)"
            disabled={!onRunCode}
          >
            <Play size={14} />
            Run
          </button>
        </div>
      </div>
      
      {/* Editor area */}
      <div className="flex-1">
        {active && (
          <Editor
            height="100%"
            language={active.language}
            value={value}
            onChange={(v: string | undefined) => setValue(v ?? '')}
            onMount={onMount}
            options={{ 
              minimap: { enabled: true },
              lineNumbers: 'on',
              folding: true,
              wordWrap: 'on'
            }}
          />
        )}
      </div>
    </div>
  )
}
