/**
 * Local proxy for OpenAI audio transcriptions. Keeps OPENAI_API_KEY off the browser.
 * Run: npm run transcribe-server
 * Requires OPENAI_API_KEY in project root .env (see .env.example).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import multer from 'multer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envNextToPackageJson = path.join(__dirname, '..', '.env')
const envInCwd = path.resolve(process.cwd(), '.env')
// Prefer .env next to package.json; also load cwd so alternate working directories still pick up a key.
dotenv.config({ path: envNextToPackageJson })
dotenv.config({ path: envInCwd })

/** Strip BOM / whitespace — common when editing .env on Windows. */
function getOpenAIKey() {
  const raw = process.env.OPENAI_API_KEY
  if (typeof raw !== 'string') return ''
  return raw.replace(/^\uFEFF/, '').trim()
}

const PORT = Number(process.env.TRANSCRIBE_PORT || 8787)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
})

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasKey: Boolean(getOpenAIKey()) })
})

/** Turn raw lecture transcript / rough notes into structured Markdown (same key as Whisper). */
app.post('/api/summarize', async (req, res) => {
  const key = getOpenAIKey()
  if (!key) {
    return res.status(500).json({
      error:
        'Missing OPENAI_API_KEY. Copy .env.example to .env in the project folder, set OPENAI_API_KEY=sk-... (no quotes needed), save the file, then restart npm run transcribe-server (or npm run dev:all).',
    })
  }
  const text = typeof req.body?.text === 'string' ? req.body.text : ''
  const trimmed = text.trim()
  if (!trimmed) {
    return res.status(400).json({ error: 'No text to organize.' })
  }
  if (trimmed.length > 120_000) {
    return res.status(400).json({
      error: 'This note is too long for one request. Split the text or shorten the selection.',
    })
  }

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

  try {
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
          {
            role: 'user',
            content: `Organize the following lecture or note content:\n\n${trimmed}`,
          },
        ],
      }),
    })
    const raw = await r.text()
    if (!r.ok) {
      let msg = raw
      try {
        const j = JSON.parse(raw)
        msg = j.error?.message || j.message || raw
      } catch {
        /* use raw */
      }
      return res.status(502).json({ error: msg || `OpenAI HTTP ${r.status}` })
    }
    const data = JSON.parse(raw)
    const content = data?.choices?.[0]?.message?.content
    const markdown = typeof content === 'string' ? content.trim() : ''
    if (!markdown) {
      return res.status(502).json({ error: 'Empty response from model.' })
    }
    res.json({ markdown })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e?.message || String(e) })
  }
})

app.post('/api/transcribe', upload.single('file'), async (req, res) => {
  const key = getOpenAIKey()
  if (!key) {
    return res.status(500).json({
      error:
        'Missing OPENAI_API_KEY. Copy .env.example to .env in the project folder, set OPENAI_API_KEY=sk-... (no quotes needed), save the file, then restart npm run transcribe-server (or npm run dev:all).',
    })
  }
  if (!req.file?.buffer) {
    return res.status(400).json({ error: 'Expected multipart field "file" with audio.' })
  }

  const name = req.file.originalname || 'recording.webm'
  const type = req.file.mimetype || 'audio/webm'

  const form = new FormData()
  form.append('file', new Blob([req.file.buffer], { type }), name)
  form.append('model', 'whisper-1')

  try {
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    })
    const raw = await r.text()
    if (!r.ok) {
      let msg = raw
      try {
        const j = JSON.parse(raw)
        msg = j.error?.message || j.message || raw
      } catch {
        /* use raw */
      }
      return res.status(502).json({ error: msg || `OpenAI HTTP ${r.status}` })
    }
    const data = JSON.parse(raw)
    res.json({ text: typeof data.text === 'string' ? data.text : '' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e?.message || String(e) })
  }
})

const server = app.listen(PORT, () => {
  console.log(`SmartCopyBook transcribe proxy → http://localhost:${PORT}`)
  console.log('  POST /api/transcribe  (multipart field: file)')
  console.log('  POST /api/summarize  (JSON: { text })')
  console.log('  GET  /api/health')
})

server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.error(
      `\nPort ${PORT} is already in use (another transcribe-server may still be running).\n` +
        `  • Close the other terminal, or end the process using that port.\n` +
        `  • Or set TRANSCRIBE_PORT=8788 in .env (same value Vite reads for /api proxy) and restart.\n`,
    )
  } else {
    console.error(err)
  }
  process.exit(1)
})
