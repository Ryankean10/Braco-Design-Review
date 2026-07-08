'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2, Bug, ChevronDown } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  isBugReport?: boolean
}

export default function HelpChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: 'Hi! I\'m the GridGate Assistant. I can help you find things in the app or answer questions about how it works.\n\nIf you\'ve spotted a bug or something isn\'t working, just describe it and I\'ll log it for the team.',
      }])
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/help/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content }))
        })
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        isBugReport: data.isBugReport,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105"
        style={{ background: 'var(--accent)' }}
        title="GridGate Assistant"
      >
        {open
          ? <ChevronDown size={20} color="white" />
          : <MessageCircle size={20} color="white" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-20 right-6 z-50 w-80 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ height: 420, background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ background: 'var(--accent)', color: 'white' }}>
            <div className="flex items-center gap-2">
              <MessageCircle size={14} />
              <span className="text-sm font-semibold">GridGate Assistant</span>
            </div>
            <button onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed"
                  style={m.role === 'user'
                    ? { background: 'var(--accent)', color: 'white' }
                    : { background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
                  }
                >
                  {m.content.split('\n').map((line, j) => (
                    <span key={j}>{line}{j < m.content.split('\n').length - 1 && <br />}</span>
                  ))}
                  {m.isBugReport && (
                    <div className="mt-2 pt-2 flex items-center gap-1.5"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.2)', color: '#fde68a' }}>
                      <Bug size={10} />
                      <span className="text-xs font-medium">Bug report sent to the team</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-xl px-3 py-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <Loader2 size={12} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask a question or report a bug…"
                className="flex-1 resize-none rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', maxHeight: 80,
                }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center disabled:opacity-40 transition-opacity"
                style={{ background: 'var(--accent)' }}
              >
                <Send size={12} color="white" />
              </button>
            </div>
            <p className="text-center mt-1.5" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  )
}
