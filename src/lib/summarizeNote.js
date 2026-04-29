/**
 * Calls the local dev proxy (npm run transcribe-server) — same OPENAI_API_KEY as Whisper.
 * Vite proxies /api to that server in dev; without it, requests fail.
 */

import {
  hasBrowserOpenAIKey,
  summarizeLectureNotesViaOpenAIDirect,
} from './openAIDirect'
const LOCAL_SERVER_HINT =
  'Start the API on your PC: open a terminal in the project folder and run npm run dev:all (or run npm run transcribe-server while npm run dev is already running). Then reload this page.'

function parseJsonSafe(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function summarizeLectureNotes(rawText) {
  const text = typeof rawText === 'string' ? rawText.trim() : ''
  if (!text) {
    throw new Error('Add some text to your note first.')
  }

  let r
  try {
    r = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  } catch {
    if (hasBrowserOpenAIKey()) {
      return summarizeLectureNotesViaOpenAIDirect(text)
    }
    throw new Error(`Organize could not connect to the server. ${LOCAL_SERVER_HINT}`)
  }

  const bodyText = await r.text()
  const data = parseJsonSafe(bodyText) || {}

  if (!r.ok) {
    if (typeof data.error === 'string' && data.error.trim() && !hasBrowserOpenAIKey()) {
      throw new Error(data.error)
    }
    if (r.status === 502 || r.status === 503 || r.status === 504) {
      throw new Error(`Organize failed (${r.status}). ${LOCAL_SERVER_HINT}`)
    }
    if (hasBrowserOpenAIKey()) {
      return summarizeLectureNotesViaOpenAIDirect(text)
    }
    throw new Error(
      data.error ||
        `Organize failed (${r.status}). ${LOCAL_SERVER_HINT} If the server is running, add OPENAI_API_KEY to .env and restart it.`,
    )
  }

  const markdown = typeof data.markdown === 'string' ? data.markdown.trim() : ''
  if (!markdown) {
    throw new Error('No organized text was returned.')
  }
  return markdown
}
