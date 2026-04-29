const OPENAI_KEY_STORAGE = 'smartcopybook_openai_api_key'

function parseJsonSafe(text) {
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

export function loadBrowserOpenAIKey() {
  if (typeof localStorage === 'undefined') return ''
  const raw = localStorage.getItem(OPENAI_KEY_STORAGE) || ''
  return String(raw).trim()
}

export function saveBrowserOpenAIKey(key) {
  if (typeof localStorage === 'undefined') return
  const clean = String(key || '').trim()
  if (!clean) {
    localStorage.removeItem(OPENAI_KEY_STORAGE)
    return
  }
  localStorage.setItem(OPENAI_KEY_STORAGE, clean)
}

export function hasBrowserOpenAIKey() {
  return !!loadBrowserOpenAIKey()
}

function requireKey(providedKey) {
  const key = String(providedKey || loadBrowserOpenAIKey() || '').trim()
  if (!key) {
    throw new Error('Add an OpenAI API key first to use AI without the local server.')
  }
  return key
}

export async function transcribeBlobViaOpenAIDirect(blob, providedKey) {
  const key = requireKey(providedKey)
  const form = new FormData()
  form.append('file', blob, 'recording.webm')
  form.append('model', 'whisper-1')

  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  const raw = await r.text()
  const data = parseJsonSafe(raw)
  if (!r.ok) {
    throw new Error(data?.error?.message || data?.error || `OpenAI transcribe failed (${r.status}).`)
  }
  return typeof data.text === 'string' ? data.text : ''
}

export async function summarizeLectureNotesViaOpenAIDirect(rawText, providedKey) {
  const key = requireKey(providedKey)
  const text = typeof rawText === 'string' ? rawText.trim() : ''
  if (!text) throw new Error('Add some text to your note first.')

  const system = [
    'You help students turn raw lecture transcripts or rough notes into clear study notes.',
    'Output ONLY Markdown (no surrounding ``` fence around the whole answer).',
    'Use the same language as the input for headings and bullets.',
    'Include these sections with ## headings (adapt titles to the input language):',
    '## Summary — 2–4 sentences',
    '## Key points — bullet list',
    '## Terms & definitions — short bullets (term: meaning)',
    '## Follow-up — questions or ideas to review',
    'If the input is messy or repetitive, clean it up without inventing facts.',
  ].join(' ')

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Organize the following lecture or note content:\n\n${text}` },
      ],
    }),
  })
  const raw = await r.text()
  const data = parseJsonSafe(raw)
  if (!r.ok) {
    throw new Error(data?.error?.message || data?.error || `OpenAI summarize failed (${r.status}).`)
  }
  const content = data?.choices?.[0]?.message?.content
  const markdown = typeof content === 'string' ? content.trim() : ''
  if (!markdown) throw new Error('No organized text was returned.')
  return markdown
}
