import { useEffect, useRef, useState } from 'react'
import { Bot, Send, Key } from 'lucide-react'

// Preload default key provided by user once if not set
const DEFAULT_GEMINI_KEY = 'AIzaSyA9bGr7y0Oo83n3j17S4OAnHigfYAv4K30'
if (typeof window !== 'undefined' && !localStorage.getItem('gemini_api_key')) {
  try { localStorage.setItem('gemini_api_key', DEFAULT_GEMINI_KEY) } catch {}
}

function getApiKey(): string | null {
  return localStorage.getItem('gemini_api_key')
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('No API key')

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }]}]
    })
  })

  if (!res.ok) throw new Error('Gemini API error')
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'
  return text
}

export function AIChatPanel() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [keyDraft, setKeyDraft] = useState(getApiKey() || '')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, isTyping])

  async function send() {
    const content = input.trim()
    if (!content) return
    setMessages(prev => [...prev, { role: 'user', text: content }])
    setInput('')

    const apiKey = getApiKey()

    if (!apiKey) {
      setIsTyping(true)
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'assistant', text: 'Please add your Gemini API key to enable real coding assistance. Click the key icon in the header.' }])
        setIsTyping(false)
      }, 600)
      return
    }

    try {
      setIsTyping(true)
      const reply = await callGemini(`You are a coding assistant. Answer concisely and provide code when asked. Query: ${content}`)
      setMessages(prev => [...prev, { role: 'assistant', text: reply }])
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${e.message}` }])
    } finally {
      setIsTyping(false)
    }
  }

  function saveKey() {
    localStorage.setItem('gemini_api_key', keyDraft.trim())
    setShowKey(false)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="chat-header">
        <div className="flex items-center gap-2">
          <Bot size={14} />
          <span>AI Chat</span>
        </div>
        <button className="vscode-button" title="Set API Key" onClick={() => setShowKey(true)}>
          <Key size={14} />
          Key
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`mb-2 ${m.role === 'user' ? 'text-[var(--text)]' : 'text-[var(--muted)]'}`}>
            <strong>{m.role === 'user' ? 'You' : 'Assistant'}:</strong>
            <div className="whitespace-pre-wrap">{m.text}</div>
          </div>
        ))}
        {isTyping && <div className="text-[var(--muted)] text-sm">Assistant is typing...</div>}
      </div>

      <div className="p-2 border-t border-[var(--gutter)] flex items-center gap-2">
        <textarea
          className="flex-1 vscode-input"
          rows={2}
          placeholder="Ask coding questions..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="vscode-button primary" onClick={send}>
          <Send size={14} />
          Send
        </button>
      </div>

      {showKey && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-[var(--panel)] border border-[var(--gutter)] p-4 rounded-md w-[360px]">
            <div className="text-sm mb-2">Gemini API key</div>
            <input className="vscode-input w-full mb-3" placeholder="AIza..." value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button className="vscode-button" onClick={() => setShowKey(false)}>Cancel</button>
              <button className="vscode-button primary" onClick={saveKey}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
