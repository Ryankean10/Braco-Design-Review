// Gmail API client using OAuth2 refresh token (no googleapis dependency)

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1'

let cachedToken: { token: string; expires: number } | null = null

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires - 60_000) return cachedToken.token

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GMAIL_CLIENT_ID!,
      client_secret: process.env.GMAIL_CLIENT_SECRET!,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Gmail token error: ${JSON.stringify(data)}`)
  cachedToken = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 }
  return cachedToken.token
}

async function gmailFetch(path: string, options: RequestInit = {}) {
  const token = await getAccessToken()
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) throw new Error(`Gmail API ${path} → ${res.status} ${await res.text()}`)
  return res.json()
}

export interface GmailMessage {
  id: string
  threadId: string
  from: string
  fromName: string
  subject: string
  date: Date
  bodyText: string
}

function decodeBase64Url(s: string): string {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

function extractPart(payload: any, mimeType: string): string {
  if (payload.mimeType === mimeType && payload.body?.data) return decodeBase64Url(payload.body.data)
  if (payload.parts) {
    for (const part of payload.parts) {
      const found = extractPart(part, mimeType)
      if (found) return found
    }
  }
  return ''
}

function parseFromHeader(from: string): { email: string; name: string } {
  const match = from.match(/^"?([^"<]*)"?\s*<?([^>]+)>?$/)
  if (match) return { name: match[1].trim(), email: match[2].trim().toLowerCase() }
  return { name: '', email: from.trim().toLowerCase() }
}

export async function listUnreadMessages(maxResults = 50): Promise<string[]> {
  const data = await gmailFetch(
    `/users/me/messages?q=is:unread&maxResults=${maxResults}`
  )
  return (data.messages ?? []).map((m: any) => m.id)
}

export async function getMessage(id: string): Promise<GmailMessage> {
  const data = await gmailFetch(`/users/me/messages/${id}?format=full`)
  const headers: Record<string, string> = {}
  for (const h of data.payload?.headers ?? []) headers[h.name.toLowerCase()] = h.value

  const { name: fromName, email: from } = parseFromHeader(headers['from'] ?? '')
  const bodyText = extractPart(data.payload, 'text/plain') || extractPart(data.payload, 'text/html')

  return {
    id: data.id,
    threadId: data.threadId,
    from,
    fromName,
    subject: headers['subject'] ?? '',
    date: new Date(parseInt(data.internalDate)),
    bodyText: bodyText.slice(0, 8000), // cap for Claude
  }
}

export async function markAsRead(id: string): Promise<void> {
  await gmailFetch(`/users/me/messages/${id}/modify`, {
    method: 'POST',
    body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
  })
}
