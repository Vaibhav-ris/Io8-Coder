import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { openPythonSocket, runPython } from '../lib/api'
import { runCode, getLanguageFromExtension, preprocessCodeForInput } from '../utils/pistonApi'
import { RotateCcw, Plus, X } from 'lucide-react'

export type TerminalAPI = {
  append: (text: string) => void
  appendError: (text: string) => void
  sendInput: (line: string) => void
  runPythonSmart: (code: string) => Promise<void>
  clear: () => void
  handleRun: (fileName: string, code: string) => Promise<void>
}

type TerminalTab = {
  id: string
  name: string
  terminal: XTerminal
  fit: FitAddon
}

export function Terminal({ onReady }: { onReady?: (append: (text: string) => void, appendError: (text: string) => void, api?: TerminalAPI) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTab, setActiveTab] = useState<string>('')
  const wsRef = useRef<WebSocket | null>(null)
  const inputBuffer = useRef<string>('')
  const nextId = useRef(1)
  const mountedIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    createTerminal()
  }, [])

  // Retry-open active terminal until container is ready
  useEffect(() => {
    const tab = tabs.find(t => t.id === activeTab)
    if (!tab) return
    if (mountedIds.current.has(tab.id)) return

    let attempts = 0
    const tryMount = () => {
      attempts++
      if (containerRef.current && !mountedIds.current.has(tab.id)) {
        try {
          tab.terminal.open(containerRef.current)
          tab.fit.fit()
          tab.terminal.writeln('Terminal ready - Piston API')
          tab.terminal.writeln('$ ')
          mountedIds.current.add(tab.id)
          return
        } catch {}
      }
      if (attempts < 20) requestAnimationFrame(tryMount)
    }
    tryMount()
  }, [tabs, activeTab])

  function createTerminal() {
    const id = `terminal-${nextId.current++}`
    const name = `Terminal ${tabs.length + 1}`

    const term = new XTerminal({
      theme: { background: 'var(--terminal-bg)', foreground: 'var(--terminal-fg)', cursor: 'var(--accent)' },
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 13,
      cursorBlink: true,
      convertEol: true,
      scrollback: 1000,
      rows: 20
    })

    const fit = new FitAddon()
    term.loadAddon(fit)

    const newTab: TerminalTab = { id, name, terminal: term, fit }
    setTabs(prev => [...prev, newTab])
    setActiveTab(id)

    if (tabs.length === 0) initializeTerminal(newTab)
  }

  function initializeTerminal(tab: TerminalTab) {
    const { terminal } = tab

    const append = (text: string) => {
      terminal.write(text.replace(/\n/g, '\r\n'))
    }

    const appendError = (text: string) => {
      terminal.write(`\x1b[31m${text.replace(/\n/g, '\r\n')}\x1b[0m`)
    }

    const sendInput = (line: string) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(line)
      }
    }

    const clear = () => {
      terminal.clear()
      terminal.writeln('Terminal cleared - Piston API')
      terminal.writeln('$ ')
    }

    const handleRun = async (fileName: string, code: string) => {
      try {
        const language = getLanguageFromExtension(fileName)
        terminal.write(`\r\n\x1b[36m$ Running ${fileName} (${language})\x1b[0m\r\n`)
        const hasInput = /input\s*\(/.test(code)
        const codeToRun = hasInput ? (terminal.write(`\x1b[33mDetected input(); simulating inputs...\x1b[0m\r\n`), preprocessCodeForInput(code, language)) : code
        terminal.write(`\x1b[33mExecuting with Piston API...\x1b[0m\r\n`)

        const result = await runCode(language, codeToRun)
        if (result.stdout) {
          terminal.write(`\x1b[32m[STDOUT]\x1b[0m\r\n`)
          terminal.write(result.stdout)
          if (!result.stdout.endsWith('\n')) terminal.write('\r\n')
        }
        if (result.stderr) {
          terminal.write(`\x1b[31m[STDERR]\x1b[0m\r\n`)
          terminal.write(result.stderr)
          if (!result.stderr.endsWith('\n')) terminal.write('\r\n')
        }
        if (!result.success) terminal.write(`\x1b[31m✗ Execution failed\x1b[0m\r\n`)
        else terminal.write(`\x1b[32m✓ Done\x1b[0m\r\n`)
        terminal.write('$ ')
      } catch (error) {
        terminal.write(`\x1b[31m✗ Error: ${error}\x1b[0m\r\n$ `)
      }
    }

    terminal.onData((data) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
      if (data === '\r') {
        const toSend = inputBuffer.current
        inputBuffer.current = ''
        terminal.write('\r\n')
        sendInput(toSend)
        terminal.write('$ ')
      } else if (data === '\u0008' || data === '\x7f') {
        if (inputBuffer.current.length > 0) {
          inputBuffer.current = inputBuffer.current.slice(0, -1)
          terminal.write('\b \b')
        }
      } else if (data >= ' ') {
        inputBuffer.current += data
        terminal.write(data)
      }
    })

    async function runPythonSmart(code: string) {
      const shouldInteractive = /input\s*\(/.test(code)
      if (!shouldInteractive) {
        append(`\r\n$ python main.py\r\n`)
        const { stdout, stderr } = await runPython(code, undefined, 10)
        if (stdout) append(stdout)
        if (stderr) appendError(stderr)
        terminal.write('\r\n$ ')
        return
      }
      await openInteractive(code)
    }

    async function openInteractive(code: string) {
      append(`\r\n$ python main.py  # interactive\r\n`)
      const ws = openPythonSocket()
      wsRef.current = ws
      ws.onopen = () => { ws.send(JSON.stringify({ code })) }
      ws.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data)
          if (payload.stdout) append(payload.stdout)
          if (payload.stderr) appendError(payload.stderr)
        } catch { append(ev.data) }
      }
    }

    const api: TerminalAPI = { append, appendError, sendInput, runPythonSmart, clear, handleRun }
    onReady?.(append, appendError, api)
  }

  function closeTab(id: string) {
    const tab = tabs.find(t => t.id === id)
    if (tab) tab.terminal.dispose()
    const newTabs = tabs.filter(t => t.id !== id)
    setTabs(newTabs)
    if (activeTab === id && newTabs.length > 0) setActiveTab(newTabs[0].id)
  }

  function clearActiveTerminal() {
    const tab = tabs.find(t => t.id === activeTab)
    if (tab) {
      tab.terminal.clear()
      tab.terminal.writeln('Terminal cleared - Piston API')
      tab.terminal.writeln('$ ')
    }
  }

  useEffect(() => {
    const onResize = () => {
      const tab = tabs.find(t => t.id === activeTab)
      if (tab) tab.fit.fit()
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [tabs, activeTab])

  return (
    <div className="h-full flex flex-col">
      <div className="terminal-header">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">TERMINAL</span>
          <div className="flex items-center gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2 py-1 text-xs transition-fast ${activeTab === tab.id ? 'bg-[var(--bg)] text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}
              >
                {tab.name}
                <X size={12} className="ml-2 hover:text-[var(--error)] transition-fast" onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }} />
              </button>
            ))}
            <button onClick={createTerminal} className="p-1 text-[var(--muted)] hover:text-[var(--text)] transition-fast" title="New Terminal">
              <Plus size={14} />
            </button>
          </div>
        </div>
        <button onClick={clearActiveTerminal} className="p-1 text-[var(--muted)] hover:text-[var(--text)] transition-fast" title="Clear Terminal">
          <RotateCcw size={14} />
        </button>
      </div>

      <div className="terminal-content flex-1">
        {tabs.map(tab => (
          <div key={tab.id} className={`h-full w-full ${activeTab === tab.id ? 'block' : 'hidden'}`} ref={activeTab === tab.id ? containerRef : null} />
        ))}
      </div>
    </div>
  )
}

