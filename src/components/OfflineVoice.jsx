import { useState, useRef, useCallback, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { transcribeBlob, getTranscriber, measureBlobAudioPeak } from '../lib/offlineWhisper'
import { checkTranscribeServer, transcribeBlobViaOpenAIProxy } from '../lib/transcribeOpenAIProxy'
import {
  hasBrowserOpenAIKey,
  loadBrowserOpenAIKey,
  saveBrowserOpenAIKey,
  transcribeBlobViaOpenAIDirect,
} from '../lib/openAIDirect'
import {
  offlineQuietRecordingHint,
  genericNoWordsHint,
  openaiServerUnreachableMessage,
} from '../lib/deviceHints'
import styles from './OfflineVoice.module.css'

/**
 * Record mic → Whisper in-browser → insert text at editor selection (no Google Web Speech).
 */
export function OfflineVoice({
  body,
  setBody,
  onUpdate,
  bodyRef,
  getInsertRange,
  onVoiceBodyCommit,
  disabled,
}) {
  const [phase, setPhase] = useState('idle')
  const [status, setStatus] = useState('')
  const [loadPct, setLoadPct] = useState(null)
  const [micDevices, setMicDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [engine, setEngine] = useState(() => (import.meta.env.PROD ? 'browser' : 'openai'))
  const [openaiStatus, setOpenaiStatus] = useState(() =>
    import.meta.env.PROD
      ? { loading: false, reachable: false, hasKey: false }
      : { loading: true, reachable: false, hasKey: false },
  )
  const [openaiKeyInput, setOpenaiKeyInput] = useState(() => loadBrowserOpenAIKey())
  const [showKeyInput, setShowKeyInput] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => {
    let cancelled = false
    async function scan() {
      try {
        const list = await navigator.mediaDevices.enumerateDevices()
        if (!cancelled) setMicDevices(list.filter((d) => d.kind === 'audioinput'))
      } catch {
        /* noop */
      }
    }
    scan()
    navigator.mediaDevices.addEventListener('devicechange', scan)
    return () => {
      cancelled = true
      navigator.mediaDevices.removeEventListener('devicechange', scan)
    }
  }, [])

  useEffect(() => {
    if (engine !== 'openai') return
    let cancelled = false
    setOpenaiStatus((s) => ({ ...s, loading: true }))
    ;(async () => {
      const s = await checkTranscribeServer()
      if (cancelled) return
      setOpenaiStatus({
        loading: false,
        reachable: s.ok,
        hasKey: s.hasKey,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [engine])

  useEffect(() => {
    if (openaiStatus.loading) return
    if (!openaiStatus.reachable && !hasBrowserOpenAIKey() && engine === 'openai') setEngine('browser')
  }, [openaiStatus.loading, openaiStatus.reachable, engine])

  const refreshMicDevices = useCallback(async () => {
    setStatus('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      const list = await navigator.mediaDevices.enumerateDevices()
      setMicDevices(list.filter((d) => d.kind === 'audioinput'))
    } catch (e) {
      setStatus(e?.name === 'NotAllowedError' ? 'Allow microphone to list devices.' : String(e?.message || e))
    }
  }, [])

  const progressHandler = useCallback((p) => {
    if (typeof p?.progress === 'number') {
      setLoadPct(Math.round(p.progress))
    }
    if (p?.status) setStatus(String(p.status))
  }, [])

  const preloadModel = useCallback(async () => {
    setPhase('loading')
    setLoadPct(0)
    setStatus('Downloading Whisper model (first time only)…')
    try {
      await getTranscriber(progressHandler)
      setPhase('idle')
      setStatus('Model ready. Press Record, speak, then Stop & transcribe.')
      setLoadPct(null)
    } catch (e) {
      setPhase('error')
      setStatus(e?.message || String(e))
      setLoadPct(null)
    }
  }, [progressHandler])

  const startRecording = useCallback(async () => {
    setStatus('')
    chunksRef.current = []
    try {
      const audio =
        selectedDeviceId
          ? {
              deviceId: { exact: selectedDeviceId },
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : {
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
      const stream = await navigator.mediaDevices.getUserMedia({ audio })
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const rec = new MediaRecorder(stream, { mimeType: mime })
      mediaRecorderRef.current = rec
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data)
      }
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
      }
      rec.start(100)
      setPhase('recording')
      setStatus('Recording… speak now, then click Stop.')
    } catch (e) {
      setStatus(e?.name === 'NotAllowedError' ? 'Microphone permission denied.' : String(e?.message || e))
      setPhase('error')
    }
  }, [selectedDeviceId])

  const stopAndTranscribe = useCallback(async () => {
    const rec = mediaRecorderRef.current
    if (!rec || rec.state === 'inactive') {
      setPhase('idle')
      return
    }
    setPhase('transcribing')
    setStatus(engine === 'openai' ? 'Transcribing… (OpenAI)' : 'Transcribing… (may take 10–40s on first run)')
    mediaRecorderRef.current = null

    await new Promise((resolve) => {
      rec.addEventListener('stop', resolve, { once: true })
      if (typeof rec.requestData === 'function') rec.requestData()
      rec.stop()
    })

    const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' })
    chunksRef.current = []
    if (blob.size < 800) {
      setStatus('Recording too short. Try again and speak for at least 1 second.')
      setPhase('idle')
      return
    }

    try {
      const text =
        engine === 'openai'
          ? (
              openaiStatus.reachable
                ? await transcribeBlobViaOpenAIProxy(blob)
                : await transcribeBlobViaOpenAIDirect(blob)
            ).trim()
          : (await transcribeBlob(blob, progressHandler)).trim()
      if (!text) {
        if (engine === 'openai') {
          setStatus('No text returned. Check the recording had speech and your OpenAI account has credits/API access.')
          setPhase('idle')
          return
        }
        const peak = await measureBlobAudioPeak(blob)
        const quiet =
          peak !== null &&
          peak < 0.01 &&
          offlineQuietRecordingHint()
        setStatus(quiet || genericNoWordsHint())
        setPhase('idle')
        return
      }

      const ta = bodyRef.current
      if (ta) ta.focus()
      const range = getInsertRange?.()
      const start = range && Number.isFinite(range.start) ? Math.max(0, Math.min(range.start, body.length)) : body.length
      const end = range && Number.isFinite(range.end) ? Math.max(0, Math.min(range.end, body.length)) : body.length
      const insert = (start > 0 && !body.slice(start - 1, start).match(/\s/) ? ' ' : '') + text + ' '
      const newBody = body.slice(0, start) + insert + body.slice(end)

      flushSync(() => {
        setBody(newBody)
        onVoiceBodyCommit?.(newBody)
        onUpdate({ body: newBody })
      })

      const caret = start + insert.length
      requestAnimationFrame(() => {
        const el = bodyRef.current
        if (el) {
          el.focus()
          try {
            el.setSelectionRange(caret, caret)
          } catch {
            /* noop */
          }
        }
      })
      setStatus(`Inserted: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`)
      setPhase('idle')
    } catch (e) {
      setPhase('error')
      setStatus(e?.message || String(e))
    }
  }, [body, setBody, onUpdate, bodyRef, getInsertRange, onVoiceBodyCommit, progressHandler, engine])

  const busy = phase === 'loading' || phase === 'transcribing'

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.title}>Record &amp; transcribe</span>
        <span className={styles.badge}>Whisper</span>
      </div>
      <p className={styles.blurb}>
        Best for <strong>readable lecture notes</strong>: record a segment, then <strong>Stop &amp; transcribe</strong>{' '}
        with <strong>OpenAI</strong> (local server or browser key). That uses
        Whisper and usually beats live Voice for punctuation and flow. <strong>In-browser</strong> runs on your device
        (large first-time download).
      </p>
      <div className={styles.engineRow} role="group" aria-label="Transcription engine">
        <span className={styles.engineLabel}>Engine</span>
        <button
          type="button"
          className={engine === 'openai' ? styles.engineBtnActive : styles.engineBtn}
          disabled={disabled || busy || phase === 'recording'}
          onClick={() => setEngine('openai')}
        >
          OpenAI (recommended)
        </button>
        <button
          type="button"
          className={engine === 'browser' ? styles.engineBtnActive : styles.engineBtn}
          disabled={disabled || busy || phase === 'recording'}
          onClick={() => setEngine('browser')}
        >
          In-browser
        </button>
      </div>
      {engine === 'openai' && (
        <p className={styles.cloudHint} role="status">
          {openaiStatus.loading && 'Checking local transcribe server…'}
          {!openaiStatus.loading &&
            !openaiStatus.reachable &&
            openaiServerUnreachableMessage(import.meta.env.PROD)}
          {!openaiStatus.loading && !openaiStatus.reachable && hasBrowserOpenAIKey() &&
            ' Local server is offline, but a browser OpenAI key is saved, so OpenAI mode can still work.'}
          {!openaiStatus.loading && openaiStatus.reachable && !openaiStatus.hasKey &&
            'Server is running but OPENAI_API_KEY is missing. Copy .env.example to .env next to package.json, set OPENAI_API_KEY=sk-... (no quotes), save, then restart npm run transcribe-server or npm run dev:all.'}
          {!openaiStatus.loading && openaiStatus.reachable && openaiStatus.hasKey &&
            'Ready — uses OpenAI Whisper on the server; your key is not exposed to the page.'}
        </p>
      )}
      {engine === 'openai' && (
        <div className={styles.keyRow}>
          <button type="button" className={styles.btn} onClick={() => setShowKeyInput((v) => !v)}>
            {showKeyInput ? 'Hide key' : 'Use browser OpenAI key'}
          </button>
          {showKeyInput && (
            <>
              <input
                type="password"
                className={styles.keyInput}
                value={openaiKeyInput}
                placeholder="sk-..."
                onChange={(e) => setOpenaiKeyInput(e.target.value)}
              />
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  saveBrowserOpenAIKey(openaiKeyInput)
                  setStatus(openaiKeyInput.trim() ? 'Browser key saved on this device.' : 'Browser key removed.')
                }}
              >
                Save key
              </button>
            </>
          )}
        </div>
      )}
      <div className={styles.micRow}>
        <label className={styles.micLabel} htmlFor="offline-mic-select">
          Microphone
        </label>
        <select
          id="offline-mic-select"
          className={styles.micSelect}
          value={selectedDeviceId}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          disabled={disabled || busy || phase === 'recording'}
        >
          <option value="">Default (system microphone)</option>
          {micDevices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label?.trim() || `Input ${d.deviceId.slice(0, 8)}…`}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={styles.btn}
          disabled={disabled || busy || phase === 'recording'}
          onClick={refreshMicDevices}
          title="Request mic access, then refresh the list with full names"
        >
          Refresh list
        </button>
      </div>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.btn}
          disabled={disabled || busy || phase === 'recording' || engine === 'openai'}
          onClick={preloadModel}
          title={engine === 'openai' ? 'Only needed for In-browser engine' : undefined}
        >
          {loadingLabel(phase, loadPct)}
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={disabled || busy || phase === 'recording'}
          onClick={startRecording}
        >
          Record
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={disabled || phase !== 'recording'}
          onClick={stopAndTranscribe}
        >
          Stop &amp; transcribe
        </button>
      </div>
      {status && (
        <p className={phase === 'error' ? styles.err : styles.status} role="status">
          {status}
        </p>
      )}
    </div>
  )
}

function loadingLabel(phase, loadPct) {
  if (phase === 'loading' && loadPct != null) return `Loading model ${loadPct}%`
  return 'Prepare model'
}
