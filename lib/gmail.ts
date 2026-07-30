// IMAP inbox client — replaces the previous Gmail API implementation.
// Uses imapflow to poll Scotplantai@yacht-gitana.com via IMAP over TLS.

import { ImapFlow } from 'imapflow'

function makeClient() {
  return new ImapFlow({
    host:   process.env.IMAP_HOST!,
    port:   Number(process.env.IMAP_PORT ?? 993),
    secure: true,
    auth: {
      user: process.env.IMAP_USER!,
      pass: process.env.IMAP_PASSWORD!,
    },
    logger: false,
  })
}

export interface GmailMessage {
  id: string       // IMAP UID (as string for backwards compatibility)
  threadId: string // same as id — IMAP has no thread concept
  from: string
  fromName: string
  subject: string
  date: Date
  bodyText: string
}

function parseFromHeader(from: string): { email: string; name: string } {
  const match = from.match(/^"?([^"<]*)"?\s*<?([^>]+)>?$/)
  if (match) return { name: match[1].trim(), email: match[2].trim().toLowerCase() }
  return { name: '', email: from.trim().toLowerCase() }
}

// Returns IMAP UIDs (as strings) of unread messages in INBOX
export async function listUnreadMessages(maxResults = 50): Promise<string[]> {
  const client = makeClient()
  await client.connect()
  try {
    await client.mailboxOpen('INBOX')
    const uids: string[] = []
    for await (const msg of client.fetch({ seen: false }, { uid: true })) {
      uids.push(String(msg.uid))
      if (uids.length >= maxResults) break
    }
    return uids
  } finally {
    await client.logout()
  }
}

export async function getMessage(uid: string): Promise<GmailMessage> {
  const client = makeClient()
  await client.connect()
  try {
    await client.mailboxOpen('INBOX')
    let result: GmailMessage | null = null
    for await (const msg of client.fetch({ uid: Number(uid) }, { uid: true, envelope: true, source: true })) {
      const source = msg.source?.toString('utf-8') ?? ''
      // Extract plain text body from raw source (simple heuristic)
      let bodyText = ''
      const textMatch = source.match(/Content-Type: text\/plain[^\r\n]*\r?\n(?:[^\r\n]+\r?\n)*\r?\n([\s\S]*?)(?:\r?\n--|\r?\n\r?\n--|\s*$)/)
      if (textMatch) {
        bodyText = textMatch[1]
      } else {
        // Fallback: strip MIME headers and take the bulk of content
        bodyText = source.replace(/^[\s\S]*?\r?\n\r?\n/, '').slice(0, 8000)
      }

      // Decode quoted-printable if needed
      bodyText = bodyText.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))

      const fromRaw = msg.envelope?.from?.[0]
      const fromEmail = (fromRaw?.address ?? '').toLowerCase()
      const fromName = fromRaw?.name ?? ''

      result = {
        id: String(msg.uid),
        threadId: String(msg.uid),
        from: fromEmail,
        fromName,
        subject: msg.envelope?.subject ?? '',
        date: msg.envelope?.date ?? new Date(),
        bodyText: bodyText.slice(0, 8000),
      }
    }
    if (!result) throw new Error(`Message UID ${uid} not found`)
    return result
  } finally {
    await client.logout()
  }
}

export async function markAsRead(uid: string): Promise<void> {
  const client = makeClient()
  await client.connect()
  try {
    await client.mailboxOpen('INBOX')
    await client.messageFlagsAdd({ uid: Number(uid) }, ['\\Seen'])
  } finally {
    await client.logout()
  }
}

// Move message to a named subfolder (equivalent to Gmail's applyLabel)
export async function applyLabel(uid: string, labelName: string): Promise<void> {
  const client = makeClient()
  await client.connect()
  try {
    await client.mailboxOpen('INBOX')
    // Try to copy to the folder; ignore if folder doesn't exist
    try {
      await client.messageMove({ uid: Number(uid) }, labelName)
    } catch {
      console.warn(`IMAP folder "${labelName}" not found — skipping move`)
    }
  } finally {
    await client.logout()
  }
}
