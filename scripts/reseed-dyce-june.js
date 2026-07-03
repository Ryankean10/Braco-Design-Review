const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const pdf = require('pdf-parse');
const Anthropic = require('@anthropic-ai/sdk');

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').trim().split('\n')
    .filter(l => l.includes('='))
    .map(l => [l.split('=')[0], l.split('=').slice(1).join('=')])
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

function repairJson(s) {
  let repaired = s.replace(/,\s*$/, '').replace(/,\s*\{[^}]*$/, '');
  const stack = [];
  let inStr = false, esc = false;
  for (const ch of repaired) {
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (!inStr) {
      if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
      else if (ch === '}' || ch === ']') stack.pop();
    }
  }
  return repaired + stack.reverse().join('');
}

async function getPdfText(filePath) {
  const { data, error } = await supabase.storage.from('construction-programmes').download(filePath);
  if (error) throw error;
  const buf = Buffer.from(await data.arrayBuffer());
  const res = await pdf(buf);
  return res.text;
}

async function run() {
  const { data: all } = await supabase.from('construction_programmes').select('*').order('uploaded_at', { ascending: true });
  const prog = all.find(p => p.revision.trim() === 'June Submission');
  const prev = all.filter(p => p.site_id === prog.site_id && p.uploaded_at < prog.uploaded_at).pop();

  console.log('Current:', prog.revision, '| Previous:', prev.revision);
  const [curText, prevText] = await Promise.all([getPdfText(prog.file_path), getPdfText(prev.file_path)]);
  console.log('Text lengths — current:', curText.length, 'previous:', prevText.length);

  const today = new Date().toISOString().split('T')[0];

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 6000,
    messages: [{
      role: 'user',
      content: `You are a construction programme analyst for BESS projects. Today is ${today}.

Analyse the P6 construction programme and return ONLY a JSON object with these exact keys:
{
  "summary": "2-3 sentence overall status summary",
  "overall_status": "On Track|At Risk|Delayed",
  "completion_date_current": "YYYY-MM-DD",
  "completion_date_previous": "YYYY-MM-DD or null",
  "slippage_days": number,
  "status_today": ["bullet string", ...],
  "critical_path": ["activity string", ...],
  "upcoming_activities": [{ "name": "string", "due_date": "YYYY-MM-DD", "days_away": number, "impact": "High|Medium|Low" }, ...],
  "key_changes": [{ "activity": "string", "description": "string" }, ...],
  "risks": ["risk string", ...],
  "recommendations": ["action string", ...],
  "analysed_at": "ISO timestamp"
}

status_today: 5-8 bullets describing where we are right now based on today's date.
critical_path: up to 15 current critical path activities.
upcoming_activities: activities due within 60 days, sorted by due_date.
key_changes: what changed since previous revision (up to 10).
risks: up to 8 risks.
recommendations: up to 8 recommendations.

PREVIOUS REVISION:
${prevText.slice(0, 40000)}

CURRENT REVISION:
${curText.slice(0, 80000)}`
    }]
  });

  let raw = msg.content[0].text;
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) raw = m[0];
  let analysis;
  try { analysis = JSON.parse(raw); }
  catch { console.log('Repairing JSON...'); analysis = JSON.parse(repairJson(raw)); }
  if (!analysis.analysed_at) analysis.analysed_at = new Date().toISOString();

  console.log('Keys:', Object.keys(analysis).join(', '));
  const { error } = await supabase.from('construction_programmes').update({ analysis }).eq('id', prog.id);
  if (error) console.error('Save failed:', error.message);
  else console.log('Saved OK');
}

run().catch(console.error);
