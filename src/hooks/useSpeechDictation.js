import { useRef, useEffect, useState, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { getSpeechRecognition } from '../lib/speechRecognition'
import {
  onlineSpeechRecognitionHint,
  noSpeechRetriesHint,
  serviceNotAllowedHint,
  audioCaptureHint,
  stallNoActivityHint,
} from '../lib/deviceHints'
import { formatVoiceNote } from '../lib/formatVoiceNote'

function normalizeSpeechLang(raw) {
  if (!raw || typeof raw !== 'string') return 'en-US'
  const t = raw.trim()
  if (/^en$/i.test(t)) return 'en-US'
  return t
}

function devLog(...args) {
  if (import.meta.env.DEV) console.debug('[SmartCopyBook voice]', ...args)
}

/** Rebuild final text from one result index per slot — avoids duplicated words when Chrome fires overlapping finals. */
function buildFinalFromMap(results, finalByIndex, baseIndex = 0) {
  let out = ''
  for (let i = baseIndex; i < results.length; i++) {
    if (finalByIndex.has(i)) out += finalByIndex.get(i)
  }
  return out
}

/** Join utterances when the engine restarts after a pause (indices reset; we commit the previous chunk). */
function joinUtterances(before, after) {
  if (!after) return before
  if (!before) return after
  if (/[\s\n]$/.test(before) || /^[\s\n]/.test(after)) return before + after
  return `${before} ${after}`
}

/** Keep the caret visible after dictation inserts text. */
function focusTextareaAtCaret(textarea, caret, onDone) {
  const run = () => {
    if (!textarea) return
    textarea.focus({ preventScroll: false })
    const len = textarea.value.length
    const safe = Math.max(0, Math.min(caret, len))
    try {
      textarea.setSelectionRange(safe, safe)
    } catch {
      /* noop */
    }
    const before = textarea.value.slice(0, safe)
    const row = before.split('\n').length - 1
    const lh = parseFloat(window.getComputedStyle(textarea).lineHeight) || 22
    const target = Math.max(0, row * lh - textarea.clientHeight * 0.35)
    textarea.scrollTop = Math.min(target, Math.max(0, textarea.scrollHeight - textarea.clientHeight))
    onDone?.()
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(run)
  })
}

/**
 * Inserts live transcript at the textarea selection when dictation starts.
 * Does not call getUserMedia() before SpeechRecognition (avoids Chrome mic conflicts).
 */
export function useSpeechDictation({
  body,
  setBody,
  onUpdate,
  bodyRef,
  getInsertRange,
  speechLang = 'en-US',
  continuous = true,
  onCaretAfterVoice,
  onVoiceBodyCommit,
  isActive,
  noteId,
}) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState(null)
  const recRef = useRef(null)
  /** resultIndex → final transcript for that slot (dedupes overlapping onresult events) */
  const finalByIndexRef = useRef(new Map())
  /** Text from earlier utterances in this Voice session (engine restarts after pauses when not continuous, or between segments). */
  const committedVoiceRef = useRef('')
  /** Latest finals-only transcript for the current utterance (committed on recognition.onend before restart). */
  const lastFinalRef = useRef('')
  /** Only merge result indices >= this (avoids duplicating after onend when `results` is not reset). */
  const resultBaseRef = useRef(0)
  /** Last `results.length` seen in onresult (used at onend for resultBaseRef). */
  const lastResultsLengthRef = useRef(0)
  const sessionRef = useRef({ prefix: '', suffix: '' })
  const shouldListenRef = useRef(false)
  const noSpeechStreakRef = useRef(0)
  const stallTimerRef = useRef(null)
  const transcribeFailTimerRef = useRef(null)
  const sawAnyResultRef = useRef(false)
  const heardAudioRef = useRef(false)
  const restartTimerRef = useRef(null)
  const startingRef = useRef(false)

  /** Parent often passes inline handlers; must not change stop/start identity every render or cleanup() aborts recognition. */
  const onUpdateRef = useRef(onUpdate)
  const onVoiceBodyCommitRef = useRef(onVoiceBodyCommit)
  const onCaretAfterVoiceRef = useRef(onCaretAfterVoice)
  onUpdateRef.current = onUpdate
  onVoiceBodyCommitRef.current = onVoiceBodyCommit
  onCaretAfterVoiceRef.current = onCaretAfterVoice

  const latestBodyRef = useRef(body)
  latestBodyRef.current = body

  const clearTimers = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current)
      stallTimerRef.current = null
    }
    if (transcribeFailTimerRef.current) {
      clearTimeout(transcribeFailTimerRef.current)
      transcribeFailTimerRef.current = null
    }
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    shouldListenRef.current = false
    clearTimers()

    const ta = bodyRef.current
    const { prefix, suffix } = sessionRef.current
    if (ta && typeof prefix === 'string' && typeof suffix === 'string') {
      const full = ta.value
      if (full.startsWith(prefix) && full.endsWith(suffix)) {
        const middle = full.slice(prefix.length, full.length - suffix.length)
        const formatted = formatVoiceNote(middle)
        if (formatted !== middle) {
          const next = prefix + formatted + suffix
          flushSync(() => {
            setBody(next)
            onVoiceBodyCommitRef.current?.(next)
            onUpdateRef.current?.({ body: next })
          })
          const caret = prefix.length + formatted.length
          focusTextareaAtCaret(ta, caret, () => {
            onCaretAfterVoiceRef.current?.(caret, caret)
          })
        }
      }
    }

    sawAnyResultRef.current = false
    heardAudioRef.current = false
    noSpeechStreakRef.current = 0
    finalByIndexRef.current = new Map()
    committedVoiceRef.current = ''
    lastFinalRef.current = ''
    resultBaseRef.current = 0
    lastResultsLengthRef.current = 0
    const rec = recRef.current
    recRef.current = null
    if (rec) {
      rec.onend = null
      rec.onerror = null
      rec.onresult = null
      rec.onaudiostart = null
      rec.onaudioend = null
      rec.onspeechstart = null
      rec.onspeechend = null
      try {
        rec.abort()
      } catch {
        try {
          rec.stop()
        } catch {
          /* noop */
        }
      }
    }
    setListening(false)
  }, [clearTimers, setBody])

  /** Always call latest stop() from effects — never depend on `stop` identity or cleanup re-runs abort recognition. */
  const stopRef = useRef(stop)
  stopRef.current = stop

  const start = useCallback(async () => {
    if (startingRef.current) return
    const SpeechRecognition = getSpeechRecognition()
    if (!SpeechRecognition) {
      setError('Voice input is not supported in this browser.')
      return
    }

    startingRef.current = true
    try {
      setError(null)
      clearTimers()
      sawAnyResultRef.current = false
      heardAudioRef.current = false
      noSpeechStreakRef.current = 0
      finalByIndexRef.current = new Map()
      committedVoiceRef.current = ''
      lastFinalRef.current = ''
      resultBaseRef.current = 0
      lastResultsLengthRef.current = 0

      if (typeof window !== 'undefined' && !window.isSecureContext) {
        setError(
          'Voice needs a secure page (HTTPS or localhost). Do not open the app as a raw file:// URL.',
        )
        return
      }

      const ta = bodyRef.current
      const bodySnapshot =
        ta && typeof ta.value === 'string' ? ta.value : latestBodyRef.current
      if (ta) {
        ta.focus()
        const range = getInsertRange?.()
        if (range && Number.isFinite(range.start) && Number.isFinite(range.end)) {
          const a = Math.max(0, Math.min(range.start, bodySnapshot.length))
          const b = Math.max(0, Math.min(range.end, bodySnapshot.length))
          ta.setSelectionRange(a, b)
        }
      }
      const startIdx = ta ? ta.selectionStart : bodySnapshot.length
      const endIdx = ta ? ta.selectionEnd : bodySnapshot.length
      sessionRef.current = {
        prefix: bodySnapshot.slice(0, startIdx),
        suffix: bodySnapshot.slice(endIdx),
      }

      const clearStallTimers = () => {
        if (stallTimerRef.current) {
          clearTimeout(stallTimerRef.current)
          stallTimerRef.current = null
        }
        if (transcribeFailTimerRef.current) {
          clearTimeout(transcribeFailTimerRef.current)
          transcribeFailTimerRef.current = null
        }
      }

      const markHeardAudio = () => {
        heardAudioRef.current = true
        clearStallTimers()
        transcribeFailTimerRef.current = setTimeout(() => {
          transcribeFailTimerRef.current = null
          if (!shouldListenRef.current) return
          if (sawAnyResultRef.current) return
          setError(onlineSpeechRecognitionHint())
        }, 22000)
      }

      const attachHandlers = (recognition) => {
        recognition.onaudiostart = () => {
          markHeardAudio()
        }

        recognition.onresult = (event) => {
          clearStallTimers()
          sawAnyResultRef.current = true
          noSpeechStreakRef.current = 0

          const map = finalByIndexRef.current
          const { results } = event

          // `results` sometimes resets to a short array after a restart; old base would skip real words.
          if (results.length < resultBaseRef.current) {
            resultBaseRef.current = 0
            map.clear()
          }

          for (let i = event.resultIndex; i < results.length; i++) {
            const r = results[i]
            if (r.isFinal) {
              map.set(i, r[0]?.transcript ?? '')
            }
          }

          const base = resultBaseRef.current
          const finalAccum = buildFinalFromMap(results, map, base)
          let interimTranscript = ''
          const interimFrom = Math.max(event.resultIndex, base)
          for (let i = interimFrom; i < results.length; i++) {
            if (!results[i].isFinal) {
              interimTranscript += results[i][0]?.transcript ?? ''
            }
          }

          lastFinalRef.current = formatVoiceNote(finalAccum)

          lastResultsLengthRef.current = results.length

          const { prefix, suffix } = sessionRef.current
          const committed = committedVoiceRef.current
          const utteranceRaw = finalAccum + interimTranscript
          const utteranceFormatted = formatVoiceNote(utteranceRaw)
          const voiceMiddle = joinUtterances(committed, utteranceFormatted)
          const newBody = prefix + voiceMiddle + suffix
          const caretAfterSpeech = prefix.length + voiceMiddle.length

          flushSync(() => {
            setBody(newBody)
            onVoiceBodyCommitRef.current?.(newBody)
            onUpdateRef.current?.({ body: newBody })
          })
          const ta2 = bodyRef.current
          if (ta2) {
            focusTextareaAtCaret(ta2, caretAfterSpeech, () => {
              const n = ta2.value.length
              const s = Math.max(0, Math.min(caretAfterSpeech, n))
              onCaretAfterVoiceRef.current?.(s, s)
            })
          }
        }

        recognition.onerror = (event) => {
          if (event.error === 'aborted') return

          devLog('onerror', event.error, event.message)

          if (event.error === 'no-speech') {
            noSpeechStreakRef.current += 1
            if (noSpeechStreakRef.current >= 8) {
              setError(noSpeechRetriesHint())
              shouldListenRef.current = false
              recRef.current = null
              setListening(false)
            }
            return
          }

          noSpeechStreakRef.current = 0

          if (event.error === 'not-allowed') {
            setError('Microphone access was denied for speech recognition.')
          } else if (event.error === 'network') {
            setError(
              'Speech recognition requires an internet connection. Check your connection, VPN, or ad blocker.',
            )
          } else if (event.error === 'service-not-allowed') {
            setError(serviceNotAllowedHint())
          } else if (event.error === 'audio-capture') {
            setError(audioCaptureHint())
          } else if (event.error === 'muted') {
            setError('The microphone is muted. Unmute it in system or browser settings.')
          } else {
            setError(event.message || `Voice error: ${event.error}`)
          }
          shouldListenRef.current = false
          recRef.current = null
          setListening(false)
        }

        recognition.onend = () => {
          if (!shouldListenRef.current) return
          if (recRef.current !== recognition) return

          // Commit finished utterance here — not on onstart (onstart can repeat while `results` stays cumulative → doubled words).
          const add = lastFinalRef.current
          if (add) {
            committedVoiceRef.current = joinUtterances(committedVoiceRef.current, add)
          }
          lastFinalRef.current = ''
          finalByIndexRef.current = new Map()
          resultBaseRef.current = lastResultsLengthRef.current

          restartTimerRef.current = setTimeout(() => {
            restartTimerRef.current = null
            if (!shouldListenRef.current || recRef.current !== recognition) return
            try {
              recognition.start()
            } catch (e) {
              devLog('restart failed', e)
            }
          }, 280)
        }
      }

      const recognition = new SpeechRecognition()
      recognition.continuous = continuous
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      recognition.lang = normalizeSpeechLang(speechLang)

      recRef.current = recognition
      attachHandlers(recognition)

      shouldListenRef.current = true
      setListening(true)

      stallTimerRef.current = setTimeout(() => {
        stallTimerRef.current = null
        if (!shouldListenRef.current) return
        if (sawAnyResultRef.current || heardAudioRef.current) return
        setError(stallNoActivityHint())
      }, 14000)

      try {
        recognition.start()
      } catch (e) {
        devLog('recognition.start failed', e)
        setError('Could not start voice input.')
        shouldListenRef.current = false
        recRef.current = null
        setListening(false)
      }
    } finally {
      startingRef.current = false
    }
  }, [setBody, bodyRef, getInsertRange, clearTimers, speechLang, continuous])

  const toggle = useCallback(async () => {
    if (listening) {
      stop()
    } else {
      await start()
    }
  }, [listening, start, stop])

  const prevNoteIdRef = useRef(undefined)

  useEffect(() => {
    if (!isActive) stopRef.current()
  }, [isActive])

  useEffect(() => {
    if (prevNoteIdRef.current !== undefined && prevNoteIdRef.current !== noteId) {
      stopRef.current()
    }
    prevNoteIdRef.current = noteId
  }, [noteId])

  useEffect(
    () => () => {
      stopRef.current()
    },
    [],
  )

  return {
    listening,
    error,
    start,
    stop,
    toggle,
    clearError: () => setError(null),
  }
}
