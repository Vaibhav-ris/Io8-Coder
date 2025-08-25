import { useEffect, useRef, useState } from 'react'
import { Titlebar } from './components/Titlebar'
import { Sidebar } from './components/Sidebar'
import { Explorer } from './components/Explorer'
import { EditorTabs, Tab } from './components/EditorTabs'
import { Terminal, TerminalAPI } from './components/Terminal'
import { AIChatPanel } from './components/AIChatPanel'
import { addLocalFiles } from './lib/api'
import { Gutter } from './components/Gutter'

export default function App() {
  const [activePanel, setActivePanel] = useState('explorer')
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activePath, setActivePath] = useState<string>('')
  const [appendOut, setAppendOut] = useState<(text: string) => void>(() => () => {})
  const [appendErr, setAppendErr] = useState<(text: string) => void>(() => () => {})
  const [termApi, setTermApi] = useState<TerminalAPI | null>(null)

  const [chatVisible, setChatVisible] = useState(false)
  const [terminalVisible, setTerminalVisible] = useState(true)

  const [explorerWidth, setExplorerWidth] = useState<number>(() => parseInt(localStorage.getItem('explorerWidth') || '260'))
  const [chatWidth, setChatWidth] = useState<number>(() => parseInt(localStorage.getItem('chatWidth') || '320'))
  const [terminalHeight, setTerminalHeight] = useState<number>(() => parseInt(localStorage.getItem('terminalHeight') || String(Math.round(window.innerHeight * 0.28))))

  const [cursor, setCursor] = useState<{ line: number; col: number }>({ line: 1, col: 1 })
  const [isRunning, setIsRunning] = useState(false)

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark'
    document.documentElement.setAttribute('data-theme', savedTheme)
  }, [])

  useEffect(() => {
    if (tabs.length === 0) {
      const demo: Tab = { path: 'hello.py', language: 'python', content: 'print("Hello from IDE")\n' }
      setTabs([demo])
      setActivePath(demo.path)
    }
  }, [])

  useEffect(() => {
    const onCursor = (e: any) => setCursor(e.detail)
    window.addEventListener('ide-cursor' as any, onCursor)
    return () => window.removeEventListener('ide-cursor' as any, onCursor)
  }, [])

  function onOpen(path: string, content?: string) {
    const existing = tabs.find(t => t.path === path)
    if (existing) { setActivePath(existing.path); return }

    let language = 'plaintext'
    if (path.endsWith('.py')) language = 'python'
    else if (path.endsWith('.c')) language = 'c'
    else if (path.endsWith('.cpp') || path.endsWith('.cc') || path.endsWith('.hpp')) language = 'cpp'
    else if (path.endsWith('.js')) language = 'javascript'
    else if (path.endsWith('.ts')) language = 'typescript'
    else if (path.endsWith('.html')) language = 'html'
    else if (path.endsWith('.css')) language = 'css'
    else if (path.endsWith('.json')) language = 'json'
    else if (path.endsWith('.java')) language = 'java'

    const tab: Tab = { path, language, content: content ?? '' }
    setTabs(prev => [...prev, tab])
    setActivePath(path)
  }

  async function openSystemFile() {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = '.py,.c,.cpp,.js,.ts,.html,.css,.json,.txt,.java'

    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files
      if (files && files.length) {
        const list = Array.from(files)
        // Persist into local workspace and open first selected
        const entries: Array<{ path: string; content: string }> = []
        for (const f of list) {
          const content = await f.text()
          entries.push({ path: f.name, content })
        }
        addLocalFiles(entries)
        for (const item of entries) {
          onOpen(item.path, item.content)
        }
        setTimeout(() => window.dispatchEvent(new Event('explorer-refresh')), 100)
      }
    }

    input.click()
  }

  function runActiveFromMenu() {
    if (!terminalVisible) setTerminalVisible(true)
    window.dispatchEvent(new CustomEvent('ide-run-active'))
  }

  function toggleChat() {
    setChatVisible(!chatVisible)
  }

  // Function to handle code execution from editor
  async function handleRunCode(fileName: string, code: string) {
    if (!terminalVisible) setTerminalVisible(true)
    setIsRunning(true)
    
    try {
      if (termApi?.handleRun) {
        await termApi.handleRun(fileName, code)
      } else {
        appendOut(`\r\n$ Running ${fileName}...\r\n`)
        appendOut('Terminal not ready yet. Please wait a moment and try again.\r\n')
      }
    } catch (error) {
      appendErr(`\r\n✗ Failed to run code: ${error}\r\n`)
    } finally {
      setIsRunning(false)
    }
  }

  useEffect(() => {
    const handleRunPython = async (e: any) => {
      if (!terminalVisible) setTerminalVisible(true)
      setIsRunning(true)
      try {
        await termApi?.runPythonSmart(e.detail.code)
      } finally {
        setIsRunning(false)
      }
    }
    window.addEventListener('ide-run-python' as any, handleRunPython)
    return () => window.removeEventListener('ide-run-python' as any, handleRunPython)
  }, [termApi, terminalVisible])

  // Resizers
  const explorerMin = 180, explorerMax = Math.round(window.innerWidth * 0.4)
  const chatMin = 280, chatMax = Math.round(window.innerWidth * 0.5)
  const termMin = 160, termMax = Math.round(window.innerHeight * 0.7)

  const onExplorerDrag = (x: number) => setExplorerWidth(Math.max(explorerMin, Math.min(explorerMax, x - 48)))
  const onExplorerEnd = () => localStorage.setItem('explorerWidth', String(explorerWidth))

  const onChatDrag = (x: number) => setChatWidth(Math.max(chatMin, Math.min(chatMax, window.innerWidth - x - 48)))
  const onChatEnd = () => localStorage.setItem('chatWidth', String(chatWidth))

  const onTerminalDrag = (y: number) => setTerminalHeight(Math.max(termMin, Math.min(termMax, window.innerHeight - y - 24)))
  const onTerminalEnd = () => localStorage.setItem('terminalHeight', String(terminalHeight))

  return (
    <div className="app-shell" data-theme={localStorage.getItem('theme') || 'dark'}>
      <Titlebar
        onToggleChat={toggleChat}
        chatVisible={chatVisible}
        onRun={runActiveFromMenu}
        onToggleTerminal={() => setTerminalVisible(v => !v)}
        terminalVisible={terminalVisible}
      />

      <div className="flex-1 flex" style={{ height: 'calc(100vh - 32px - 22px)' }}>
        <div className="flex">
          <Sidebar active={activePanel} onSelect={setActivePanel} />
          <div className="left-panel" style={{ width: explorerWidth, overflow: 'hidden' }}>
            {activePanel === 'explorer' && <Explorer onOpen={onOpen} onOpenSystem={openSystemFile} />}
          </div>
          <Gutter direction="vertical" onDrag={onExplorerDrag} onEnd={onExplorerEnd} className="gutter-v" />
        </div>

        <div className="flex-1 flex flex-col">
          <div className="center-editor flex-1 flex flex-col" style={{ overflow: 'hidden' }}>
            <EditorTabs
              tabs={tabs}
              setTabs={setTabs}
              activePath={activePath}
              setActivePath={setActivePath}
              appendTerminal={(t, isError) => (isError ? appendErr(t) : appendOut(t))}
              onRunCode={handleRunCode}
            />
          </div>

          {terminalVisible && (
            <div className="relative" style={{ height: Math.max(terminalHeight, 160), borderTop: '1px solid var(--gutter)', background: 'var(--panel)' }}>
              <Gutter direction="horizontal" onDrag={onTerminalDrag} onEnd={onTerminalEnd} className="gutter-h absolute left-0 right-0 top-0" />
              <div className="h-full">
                <Terminal onReady={(append, appendError, api) => { setAppendOut(() => append); setAppendErr(() => appendError); setTermApi(api || null) }} />
              </div>
            </div>
          )}
        </div>

        {chatVisible && (
          <>
            <Gutter direction="vertical" onDrag={onChatDrag} onEnd={onChatEnd} className="gutter-v" />
            <div className="right-panel" style={{ width: chatWidth, overflow: 'hidden' }}>
              <AIChatPanel />
            </div>
          </>
        )}
      </div>

      <div className="statusbar">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <span>Ln {cursor.line}, Col {cursor.col}</span>
            <span>UTF-8</span>
            <span>{activePath.split('.').pop() || 'plaintext'}</span>
            {isRunning && <span className="text-[var(--accent)]">⚙ Running</span>}
          </div>
          <div className="flex items-center gap-4">
            <span>main</span>
            <span>🔔</span>
          </div>
        </div>
      </div>
    </div>
  )
}
