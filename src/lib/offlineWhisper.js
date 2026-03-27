/**
 * Offline speech-to-text via Whisper (Transformers.js). Does not use Chrome/Google Web Speech.
 * First run downloads the model (~75MB); then it is cached in the browser.
 *
 * In the browser, Transformers.js defaults to loading from `/models/...`. Vite answers unknown paths
 * with `index.html`, so JSON config requests get HTML → "Unexpected token '<', '<!DOCTYPE'...". 
 * We disable local paths and use the Hugging Face hub instead.
 *
 * Important: `getModelFile` looks up the Cache API by `localPath` *before* checking allowLocalModels.
 * A previous session may have cached that HTML under `/models/...`. Clearing `transformers-cache`
 * once fixes poisoned entries; `allowLocalModels = false` alone does not.
 */

const TRANSFORMERS_CACHE_BUST_KEY = 'scb_transformers_cache_bust_v3'

let transcriberPromise = null

function applyBrowserHubEnv(env) {
  if (typeof window === 'undefined') return
  env.allowLocalModels = false
  env.allowRemoteModels = true
}

/**
 * One-shot: delete poisoned entries (SPA HTML cached as model files under /models/...).
 */
async function bustPoisonedTransformersCacheOnce() {
  if (typeof caches === 'undefined') return
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem(TRANSFORMERS_CACHE_BUST_KEY)) {
      return
    }
    await caches.delete('transformers-cache')
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TRANSFORMERS_CACHE_BUST_KEY, '1')
    }
  } catch (e) {
    console.warn('Could not clear transformers browser cache:', e)
  }
}

export function resetOfflineModelCache() {
  transcriberPromise = null
}

/** Whisper emits this when the waveform looks like silence/no usable speech. */
const BLANK_AUDIO_ONLY = /^\s*\[BLANK_AUDIO\]\s*$/i

/**
 * Strip Whisper noise-token output so we do not insert it into the note.
 * @param {string} raw
 */
export function normalizeWhisperText(raw) {
  if (typeof raw !== 'string') return ''
  const t = raw.trim()
  if (!t || BLANK_AUDIO_ONLY.test(t)) return ''
  return t.replace(/\s*\[BLANK_AUDIO\]\s*/gi, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Approximate peak sample level after browser decode (0–1). Null if decode fails.
 * @param {Blob} blob
 */
export async function measureBlobAudioPeak(blob) {
  if (typeof AudioContext === 'undefined') return null
  const ctx = new AudioContext()
  try {
    const arr = await blob.arrayBuffer()
    const audioBuf = await ctx.decodeAudioData(arr.slice(0))
    const data = audioBuf.getChannelData(0)
    let peak = 0
    for (let i = 0; i < data.length; i += 1) {
      const a = Math.abs(data[i])
      if (a > peak) peak = a
    }
    return peak
  } catch {
    return null
  } finally {
    await ctx.close()
  }
}

/**
 * @param {(progress: { progress?: number, status?: string }) => void} [onProgress]
 */
export async function getTranscriber(onProgress) {
  if (transcriberPromise) return transcriberPromise
  const { pipeline, env } = await import('@xenova/transformers')
  applyBrowserHubEnv(env)
  await bustPoisonedTransformersCacheOnce()
  transcriberPromise = pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
    progress_callback: onProgress,
  })
  return transcriberPromise
}

/**
 * @param {Blob} blob - e.g. audio/webm from MediaRecorder
 * @param {(p: { progress?: number, status?: string }) => void} [onProgress]
 */
export async function transcribeBlob(blob, onProgress) {
  const { read_audio, env } = await import('@xenova/transformers')
  applyBrowserHubEnv(env)
  const transcriber = await getTranscriber(onProgress)
  const url = URL.createObjectURL(blob)
  try {
    const audio = await read_audio(url, 16000)
    const result = await transcriber(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
    })
    const out = Array.isArray(result) ? result[0] : result
    const raw = typeof out?.text === 'string' ? out.text : ''
    return normalizeWhisperText(raw)
  } finally {
    URL.revokeObjectURL(url)
  }
}
