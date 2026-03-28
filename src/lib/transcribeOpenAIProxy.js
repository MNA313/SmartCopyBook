/**
 * Transcribe audio via the local server (server/transcribe-proxy.mjs) → OpenAI Whisper.
 * Vite proxies /api to the proxy in dev/preview when configured in vite.config.js.
 */

const LOCAL_SERVER_HINT =
  'On your PC run npm run dev:all (or npm run transcribe-server in a second terminal with npm run dev). Add OPENAI_API_KEY to .env in the project folder, then restart.'

export async function checkTranscribeServer() {
  try {
    const r = await fetch('/api/health', { method: 'GET' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return { ok: false, hasKey: false }
    // Vite dev proxy returns 200 { ok: false } when transcribe-server is not running (no HTTP 500 noise).
    if (j.ok === false) return { ok: false, hasKey: false }
    return { ok: true, hasKey: Boolean(j.hasKey) }
  } catch {
    return { ok: false, hasKey: false }
  }
}

export { LOCAL_SERVER_HINT as openAiProxySetupHint }

/**
 * @param {Blob} blob - e.g. audio/webm from MediaRecorder
 * @returns {Promise<string>}
 */
export async function transcribeBlobViaOpenAIProxy(blob) {
  const fd = new FormData()
  fd.append('file', blob, 'recording.webm')
  let r
  try {
    r = await fetch('/api/transcribe', { method: 'POST', body: fd })
  } catch {
    throw new Error(`Could not reach the transcribe server. ${LOCAL_SERVER_HINT}`)
  }
  const raw = await r.text()
  let data = {}
  try {
    data = JSON.parse(raw)
  } catch {
    /* noop */
  }
  if (!r.ok) {
    if (typeof data.error === 'string' && data.error.trim()) {
      throw new Error(data.error)
    }
    if (r.status === 502 || r.status === 503 || r.status === 504) {
      throw new Error(`Transcribe server unavailable (${r.status}). ${LOCAL_SERVER_HINT}`)
    }
    throw new Error(data.error || r.statusText || `HTTP ${r.status}. ${LOCAL_SERVER_HINT}`)
  }
  return typeof data.text === 'string' ? data.text : ''
}
