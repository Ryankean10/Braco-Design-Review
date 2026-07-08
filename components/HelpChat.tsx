'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2, Bug } from 'lucide-react'

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
        content: 'Hi! Ask me anything about GridGate, or describe a bug and I\'ll log it for the team.',
      }])
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

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
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.message, isBugReport: data.isBugReport }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong — please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">

      {/* Panel */}
      {open && (
        <div className="flex flex-col rounded-2xl overflow-hidden"
          style={{
            width: 320, height: 440,
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ background: '#3b82f6', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle size={12} color="white" />
              </div>
              <div>
                <p className="text-white font-semibold" style={{ fontSize: 12, lineHeight: 1 }}>GridGate Assistant</p>
                <p className="text-blue-200" style={{ fontSize: 10, marginTop: 2 }}>Help & bug reports</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
              <X size={12} color="white" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="rounded-xl px-3 py-2"
                  style={{
                    maxWidth: '82%',
                    fontSize: 12,
                    lineHeight: 1.5,
                    ...(m.role === 'user'
                      ? { background: '#3b82f6', color: 'white' }
                      : { background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border)' })
                  }}>
                  {m.content.split('\n').map((line, j, arr) => (
                    <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
                  ))}
                  {m.isBugReport && (
                    <div className="flex items-center gap-1 mt-1.5 pt-1.5"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.25)', color: '#fde68a', fontSize: 10 }}>
                      <Bug size={9} />
                      <span>Bug logged — team notified</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-xl px-3 py-2.5"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: '300ms' }} />
                  </div>
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
                className="flex-1 resize-none rounded-xl px-3 py-2 focus:outline-none focus:ring-2"
                style={{
                  fontSize: 12, lineHeight: 1.5,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  maxHeight: 72,
                  focusRingColor: '#3b82f6',
                }}
              />
              <button onClick={send} disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-opacity disabled:opacity-30 shrink-0"
                style={{ background: '#3b82f6' }}>
                <Send size={12} color="white" />
              </button>
            </div>
            <p className="text-center mt-1.5" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95"
        style={{ background: '#3b82f6' }}
        title="GridGate Assistant"
      >
        {open ? <X size={18} color="white" /> : <MessageCircle size={18} color="white" />}
      </button>
    </div>
  )
}
