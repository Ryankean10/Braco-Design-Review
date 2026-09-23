'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, CheckCircle } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  accentColor: string
  logoUrl: string | null
  companyName: string
}

export default function OnboardChat({ accentColor, logoUrl, companyName }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Kick off the conversation with the opening greeting
    fetchNext([])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function fetchNext(msgs: Message[]) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
      const updated = [...msgs, { role: 'assistant' as const, content: data.message }]
      setMessages(updated)
      if (data.done) setDone(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || loading || done) return
    const updated = [...messages, { role: 'user' as const, content: text }]
    setMessages(updated)
    setInput('')
    await fetchNext(updated)
  }

  async function submit() {
    setSubmitLoading(true)
    setError('')
    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, done: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit')
      setSubmitted(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0f172a' }}>
        <div className="text-center max-w-md">
          <CheckCircle size={56} style={{ color: accentColor }} className="mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-3">Thanks — we'll be in touch</h1>
          <p className="text-slate-400 leading-relaxed">
            Your enquiry has been sent to the Safet Consultancy team. Someone will reach out to you shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f172a' }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
        {logoUrl ? (
          <img src={logoUrl} alt={companyName} className="h-7 w-auto object-contain" />
        ) : (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ background: accentColor }}
          >
            {companyName[0]}
          </div>
        )}
        <div>
          <p className="text-white font-semibold text-sm leading-tight">{companyName}</p>
          <p className="text-slate-400 text-xs">New Client Enquiry</p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl w-full mx-auto">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
              style={
                m.role === 'user'
                  ? { background: accentColor, color: '#fff' }
                  : { background: '#1e293b', color: '#e2e8f0' }
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3" style={{ background: '#1e293b' }}>
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-white/10 px-4 py-4 max-w-2xl w-full mx-auto">
        {done ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-slate-400 text-sm">Ready to send your enquiry to the team?</p>
            <button
              onClick={submit}
              disabled={submitLoading}
              className="px-8 py-3 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-60"
              style={{ background: accentColor }}
            >
              {submitLoading ? 'Sending…' : 'Submit Enquiry'}
            </button>
          </div>
        ) : (
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
              }}
              placeholder="Type your reply…"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none disabled:opacity-50"
              style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="p-3 rounded-xl text-white transition-opacity disabled:opacity-40"
              style={{ background: accentColor }}
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
