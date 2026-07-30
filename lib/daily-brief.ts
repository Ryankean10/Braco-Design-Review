import Anthropic from '@anthropic-ai/sdk'
import { logApiUsage } from '@/lib/logApiUsage'

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// WMO weather code → description
const WMO: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Icy fog', 51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  80: 'Slight showers', 81: 'Moderate showers', 82: 'Heavy showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail',
}

export interface WeatherData {
  description: string
  temp_max_c: number
  temp_min_c: number
  wind_speed_kmh: number
  precipitation_mm: number
  geocoded_location: string
}

export async function fetchWeather(locationText: string): Promise<WeatherData | null> {
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationText)}&count=1&language=en&format=json`
    )
    const geo = await geoRes.json()
    const place = geo.results?.[0]
    if (!place) return null

    const wxRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&daily=temperature_2m_max,temperature_2m_min,wind_speed_10m_max,precipitation_sum,weathercode` +
      `&timezone=Europe%2FLondon&forecast_days=1`
    )
    const wx = await wxRes.json()
    const d = wx.daily

    return {
      description: WMO[d.weathercode?.[0]] ?? 'Unknown',
      temp_max_c: Math.round(d.temperature_2m_max?.[0] ?? 0),
      temp_min_c: Math.round(d.temperature_2m_min?.[0] ?? 0),
      wind_speed_kmh: Math.round(d.wind_speed_10m_max?.[0] ?? 0),
      precipitation_mm: Math.round((d.precipitation_sum?.[0] ?? 0) * 10) / 10,
      geocoded_location: `${place.name}, ${place.admin1 ?? ''}`.trim().replace(/,$/, ''),
    }
  } catch {
    return null
  }
}

export async function generateBriefContent(opts: {
  siteName: string
  briefDate: string
  plannedWorks: string
  personnel: { name: string; role: string; company: string }[]
  holidayAbsences: { name: string }[]
  issuesCarriedOver: { description: string; action: string; owner: string }[]
  weather: WeatherData | null
  thirdParties: string
}): Promise<{ hsFact: string; aiSummary: string }> {
  const prompt = `You are writing a daily site brief for a BESS (Battery Energy Storage System) construction site.

Site: ${opts.siteName}
Date: ${opts.briefDate}
Personnel on site today (${opts.personnel.length}): ${opts.personnel.map(p => `${p.name} (${p.role})`).join(', ') || 'None confirmed'}
Absences today: ${opts.holidayAbsences.map(p => p.name).join(', ') || 'None'}
${opts.thirdParties ? `3rd parties / visitors expected: ${opts.thirdParties}` : ''}
Planned works today: ${opts.plannedWorks || 'Not specified'}
Issues carried over from yesterday: ${opts.issuesCarriedOver.length > 0 ? opts.issuesCarriedOver.map(i => `• ${i.description} (Owner: ${i.owner}, Action: ${i.action})`).join('\n') : 'None'}
Weather forecast: ${opts.weather ? `${opts.weather.description}, ${opts.weather.temp_min_c}–${opts.weather.temp_max_c}°C, wind ${opts.weather.wind_speed_kmh} km/h, rain ${opts.weather.precipitation_mm}mm` : 'Not available'}

Provide two things in JSON:
1. "hsFact": A single practical, specific health & safety fact or reminder (2–3 sentences) directly relevant to today's planned works on a BESS construction site. Make it concrete and actionable, not generic.
2. "aiSummary": A concise site manager briefing paragraph (4–6 sentences) summarising today's picture — who is on site, key works, any carried-over issues to resolve, and any weather impacts to be aware of. Professional UK construction tone.

Respond with only valid JSON: {"hsFact":"...","aiSummary":"..."}`

  const msg = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })
  logApiUsage({ companyId: null, endpoint: 'daily-brief', model: msg.model, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens }).catch(() => {})

  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : ''
  try {
    const parsed = JSON.parse(text.replace(/^```json?\n?/, '').replace(/\n?```$/, ''))
    return { hsFact: parsed.hsFact ?? '', aiSummary: parsed.aiSummary ?? '' }
  } catch {
    return { hsFact: '', aiSummary: text.slice(0, 600) }
  }
}

export function formatBriefEmail(opts: {
  siteName: string
  briefDate: string
  personnel: { name: string; role: string; company: string }[]
  holidayAbsences: { name: string }[]
  thirdParties: string
  plannedWorks: string
  ramsNotes: string
  issuesCarriedOver: { description: string; action: string; owner: string }[]
  weather: WeatherData | null
  hsFact: string
  aiSummary: string
  briefUrl: string
}): { subject: string; html: string; text: string } {
  const subject = `Daily Site Brief — ${opts.siteName} — ${opts.briefDate}`

  const weatherStr = opts.weather
    ? `${opts.weather.description} | ${opts.weather.temp_min_c}–${opts.weather.temp_max_c}°C | Wind: ${opts.weather.wind_speed_kmh} km/h | Rain: ${opts.weather.precipitation_mm}mm`
    : 'Not available'

  const personnelRows = opts.personnel.map(p =>
    `<tr><td style="padding:4px 8px;border-bottom:1px solid #2a2a2a">${p.name}</td><td style="padding:4px 8px;border-bottom:1px solid #2a2a2a">${p.role}</td><td style="padding:4px 8px;border-bottom:1px solid #2a2a2a">${p.company}</td></tr>`
  ).join('')

  const issueRows = opts.issuesCarriedOver.map(i =>
    `<tr><td style="padding:4px 8px;border-bottom:1px solid #2a2a2a">${i.description}</td><td style="padding:4px 8px;border-bottom:1px solid #2a2a2a">${i.owner}</td><td style="padding:4px 8px;border-bottom:1px solid #2a2a2a">${i.action}</td></tr>`
  ).join('')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#0f0f0f;color:#e2e8f0;margin:0;padding:20px}
.card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:20px;margin-bottom:16px}
h1{color:#fff;font-size:20px;margin:0 0 4px}
h2{color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px}
h3{color:#60a5fa;font-size:14px;margin:0 0 8px}
p{margin:0 0 8px;font-size:14px;line-height:1.5;color:#cbd5e1}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;padding:4px 8px;color:#64748b;font-weight:600;border-bottom:1px solid #334155}
.badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600}
.weather{background:#1e3a5f;border:1px solid #1d4ed8;border-radius:8px;padding:12px;font-size:13px}
.hs{background:#1a2e1a;border:1px solid #166534;border-radius:8px;padding:12px;font-size:13px;color:#86efac}
.btn{display:inline-block;background:#3b82f6;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;margin-top:8px}
</style></head>
<body>
<div style="max-width:640px;margin:0 auto">
  <div class="card">
    <h2>Daily Site Brief</h2>
    <h1>${opts.siteName}</h1>
    <p style="color:#64748b;font-size:13px">${opts.briefDate}</p>
    ${opts.aiSummary ? `<p style="margin-top:12px">${opts.aiSummary}</p>` : ''}
  </div>

  <div class="card">
    <h3>☀️ Weather Forecast</h3>
    <div class="weather">${weatherStr}</div>
  </div>

  <div class="card">
    <h3>👷 Personnel On Site (${opts.personnel.length})</h3>
    ${opts.personnel.length > 0 ? `
    <table><thead><tr><th>Name</th><th>Role</th><th>Company</th></tr></thead>
    <tbody>${personnelRows}</tbody></table>` : '<p style="color:#64748b">No appointments confirmed for today.</p>'}
    ${opts.holidayAbsences.length > 0 ? `<p style="margin-top:8px;font-size:12px;color:#f59e0b">⚠ Absent (approved leave): ${opts.holidayAbsences.map(p => p.name).join(', ')}</p>` : ''}
  </div>

  ${opts.thirdParties ? `<div class="card"><h3>🏢 3rd Parties / Visitors</h3><p>${opts.thirdParties}</p></div>` : ''}

  <div class="card">
    <h3>🔧 Planned Works Today</h3>
    <p>${opts.plannedWorks || '<em style="color:#64748b">Not specified</em>'}</p>
    ${opts.ramsNotes ? `<p style="margin-top:8px;font-size:12px;color:#94a3b8"><strong>RAMS / Method Statement notes:</strong> ${opts.ramsNotes}</p>` : ''}
  </div>

  ${issueRows ? `<div class="card">
    <h3>⚠️ Issues Carried Over from Yesterday</h3>
    <table><thead><tr><th>Issue</th><th>Owner</th><th>Action</th></tr></thead>
    <tbody>${issueRows}</tbody></table>
  </div>` : ''}

  ${opts.hsFact ? `<div class="card">
    <h3>🦺 Health & Safety — Today's Reminder</h3>
    <div class="hs">${opts.hsFact}</div>
  </div>` : ''}

  <div style="text-align:center;margin-top:8px">
    <a href="${opts.briefUrl}" class="btn">View Full Brief Online</a>
  </div>
  <p style="text-align:center;font-size:11px;color:#475569;margin-top:16px">
    Scotplant AI · Daily Site Brief · Generated automatically
  </p>
</div>
</body></html>`

  const text = [
    `DAILY SITE BRIEF — ${opts.siteName} — ${opts.briefDate}`,
    '',
    opts.aiSummary,
    '',
    `WEATHER: ${weatherStr}`,
    '',
    `PERSONNEL ON SITE (${opts.personnel.length}):`,
    ...opts.personnel.map(p => `  • ${p.name} — ${p.role} (${p.company})`),
    opts.holidayAbsences.length > 0 ? `\nABSENT (leave): ${opts.holidayAbsences.map(p => p.name).join(', ')}` : '',
    opts.thirdParties ? `\n3RD PARTIES: ${opts.thirdParties}` : '',
    '',
    `PLANNED WORKS: ${opts.plannedWorks || 'Not specified'}`,
    opts.ramsNotes ? `RAMS NOTES: ${opts.ramsNotes}` : '',
    '',
    opts.issuesCarriedOver.length > 0 ? ['ISSUES CARRIED OVER:', ...opts.issuesCarriedOver.map(i => `  • ${i.description} (${i.owner}: ${i.action})`)].join('\n') : '',
    opts.hsFact ? `\nH&S REMINDER: ${opts.hsFact}` : '',
    '',
    `View brief: ${opts.briefUrl}`,
  ].filter(Boolean).join('\n')

  return { subject, html, text }
}
