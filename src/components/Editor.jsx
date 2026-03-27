import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { isSpeechRecognitionSupported } from '../lib/speechRecognition'
import {
  loadVoiceLang,
  saveVoiceLang,
  loadVoiceContinuous,
  saveVoiceContinuous,
  VOICE_LANG_OPTIONS,
} from '../lib/voiceSettings'
import { useSpeechDictation } from '../hooks/useSpeechDictation'
import { OfflineVoice } from './OfflineVoice'
import {
  keyboardPlaceholder,
  browserVoiceUnsupportedMessage,
  longModeTitle,
  voiceButtonTooltip,
  recordingWorkflowHint,
} from '../lib/deviceHints'
import { summarizeLectureNotes } from '../lib/summarizeNote'
import styles from './Editor.module.css'

export function Editor({ note, subject, onUpdate, onDelete }) {
  const [title, setTitle] = useState(note.title ?? '')
  const [body, setBody] = useState(note.body ?? '')
  const [mode, setMode] = useState('write')
  const [previewHtml, setPreviewHtml] = useState('')
  const bodyRef = useRef(null)
  /** Preserves caret when the Voice button is clicked (textarea would otherwise lose selection). */
  const bodySelectionRef = useRef({ start: 0, end: 0 })
  const saveTimeoutRef = useRef(null)
  /** Latest body for debounced save — avoids overwriting voice with a stale typed string. */
  const bodyForSaveRef = useRef(note.body ?? '')

  useEffect(() => {
    bodyForSaveRef.current = body
  }, [body])

  useEffect(() => {
    setTitle(note.title ?? '')
    const nextBody = note.body ?? ''
    setBody(nextBody)
    bodyForSaveRef.current = nextBody
    const len = nextBody.length
    bodySelectionRef.current = { start: len, end: len }
  }, [note.id])

  const captureBodySelection = () => {
    const ta = bodyRef.current
    if (!ta) return
    bodySelectionRef.current = {
      start: ta.selectionStart,
      end: ta.selectionEnd,
    }
  }

  const getInsertRange = useCallback(() => ({ ...bodySelectionRef.current }), [])

  const onCaretAfterVoice = useCallback((start, end) => {
    bodySelectionRef.current = { start, end }
  }, [])

  const onVoiceBodyCommit = useCallback((newBody) => {
    bodyForSaveRef.current = newBody
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
  }, [])

  const [voiceLang, setVoiceLang] = useState(() => loadVoiceLang())
  const [voiceContinuous, setVoiceContinuous] = useState(() => loadVoiceContinuous())
  const [organizeBusy, setOrganizeBusy] = useState(false)
  const [organizeError, setOrganizeError] = useState(null)

  const voiceLangOptions = useMemo(() => {
    if (VOICE_LANG_OPTIONS.some((o) => o.value === voiceLang)) return VOICE_LANG_OPTIONS
    return [{ value: voiceLang, label: `${voiceLang} (browser)` }, ...VOICE_LANG_OPTIONS]
  }, [voiceLang])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const debouncedSave = (getUpdates) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      onUpdate(getUpdates())
      saveTimeoutRef.current = null
    }, 300)
  }

  const handleTitleChange = (e) => {
    const v = e.target.value
    setTitle(v)
    debouncedSave(() => ({ title: v || 'Untitled' }))
  }

  const handleBodyChange = (e) => {
    const v = e.target.value
    bodyForSaveRef.current = v
    setBody(v)
    debouncedSave(() => ({ body: bodyForSaveRef.current }))
  }

  const wrapSelection = (before, after = before) => {
    const ta = bodyRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = body.slice(start, end)
    const newText = body.slice(0, start) + before + selected + after + body.slice(end)
    bodyForSaveRef.current = newText
    setBody(newText)
    onUpdate({ body: newText })
    requestAnimationFrame(() => {
      ta.focus()
      ta.selectionStart = start + before.length
      ta.selectionEnd = end + before.length
    })
  }

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault()
      wrapSelection('**')
      return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault()
      wrapSelection('*')
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = bodyRef.current
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newBody = body.slice(0, start) + '\t' + body.slice(end)
      bodyForSaveRef.current = newBody
      setBody(newBody)
      onUpdate({ body: newBody })
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 1
      })
    }
  }

  const voiceSupported = isSpeechRecognitionSupported()
  const {
    listening: voiceListening,
    error: voiceError,
    toggle: toggleVoice,
    clearError: clearVoiceError,
  } = useSpeechDictation({
    body,
    setBody,
    onUpdate,
    bodyRef,
    getInsertRange,
    speechLang: voiceLang,
    continuous: voiceContinuous,
    onCaretAfterVoice,
    onVoiceBodyCommit,
    isActive: mode === 'write',
    noteId: note.id,
  })

  useEffect(() => {
    if (mode !== 'preview') return
    let cancelled = false
    import('marked')
      .then(({ marked }) => {
        if (cancelled) return
        try {
          const result = marked.parse(body || '')
          if (typeof result?.then === 'function') {
            return result.then((h) => {
              if (!cancelled) setPreviewHtml(h ?? '')
            })
          }
          setPreviewHtml(result ?? '')
        } catch (e) {
          console.error(e)
          if (!cancelled) setPreviewHtml('<p>Could not render preview.</p>')
        }
      })
      .catch((e) => {
        console.error(e)
        if (!cancelled) setPreviewHtml('<p>Could not render preview.</p>')
      })
    return () => {
      cancelled = true
    }
  }, [body, mode])

  const handleOrganizeNote = async () => {
    setOrganizeError(null)
    const raw = body.trim()
    if (!raw || organizeBusy) return
    setOrganizeBusy(true)
    try {
      const md = await summarizeLectureNotes(body)
      const sep = '\n\n---\n\n'
      const newBody = body.replace(/\s+$/, '') + sep + md
      bodyForSaveRef.current = newBody
      setBody(newBody)
      onUpdate({ body: newBody })
      requestAnimationFrame(() => {
        const ta = bodyRef.current
        if (!ta) return
        const len = newBody.length
        ta.focus()
        ta.setSelectionRange(len, len)
        bodySelectionRef.current = { start: len, end: len }
      })
    } catch (e) {
      setOrganizeError(e?.message || 'Could not organize this note.')
    } finally {
      setOrganizeBusy(false)
    }
  }

  const handleExport = () => {
    const content = `# ${title || 'Untitled'}\n\n${body}`
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(title || 'note').replace(/[^a-z0-9]/gi, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.editor}>
      <header className={styles.header}>
        <div className={styles.meta}>
          {subject && (
            <span
              className={styles.subjectTag}
              style={{ '--tag-color': subject.color }}
            >
              <span className={styles.tagDot} style={{ background: subject.color }} />
              {subject.name}
            </span>
          )}
          <span className={styles.updated}>
            Updated {formatRelative(note.updatedAt)}
          </span>
        </div>
        <div className={styles.actions}>
          <div className={styles.modeTabs}>
            <button
              type="button"
              className={`${styles.modeTab} ${mode === 'write' ? styles.active : ''}`}
              onClick={() => setMode('write')}
            >
              Write
            </button>
            <button
              type="button"
              className={`${styles.modeTab} ${mode === 'preview' ? styles.active : ''}`}
              onClick={() => setMode('preview')}
            >
              Preview
            </button>
          </div>
          {voiceSupported && mode === 'write' && (
            <>
              <label className={styles.voiceLangLabel}>
                <span className={styles.voiceLangSpan}>Language</span>
                <select
                  className={styles.voiceSelect}
                  value={voiceLang}
                  disabled={voiceListening}
                  onChange={(e) => {
                    const v = e.target.value
                    setVoiceLang(v)
                    saveVoiceLang(v)
                  }}
                  title="Language you are speaking"
                >
                  {voiceLangOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.voiceContinuousLabel} title={longModeTitle()}>
                <input
                  type="checkbox"
                  checked={voiceContinuous}
                  disabled={voiceListening}
                  onChange={(e) => {
                    const v = e.target.checked
                    setVoiceContinuous(v)
                    saveVoiceContinuous(v)
                  }}
                />
                <span>Continuous</span>
              </label>
            </>
          )}
          {voiceSupported && mode === 'write' && (
            <button
              type="button"
              className={`${styles.voiceBtn} ${voiceListening ? styles.voiceListening : ''}`}
              onPointerDown={() => captureBodySelection()}
              onMouseDown={(e) => {
                e.preventDefault()
                captureBodySelection()
              }}
              onClick={async () => {
                clearVoiceError()
                await toggleVoice()
              }}
              title={voiceButtonTooltip(voiceListening)}
              aria-pressed={voiceListening}
              aria-label={voiceListening ? 'Stop voice input' : 'Start voice input'}
            >
              <MicIcon />
              <span className={styles.voiceLabel}>
                {voiceListening ? 'Listening…' : 'Voice'}
              </span>
            </button>
          )}
          <button
            type="button"
            className={styles.exportBtn}
            onClick={handleOrganizeNote}
            disabled={organizeBusy || !body.trim()}
            title="Structure this note into a summary and key points (needs npm run dev:all and OPENAI_API_KEY on your PC)"
          >
            {organizeBusy ? 'Organizing…' : 'Organize'}
          </button>
          <button
            type="button"
            className={styles.exportBtn}
            onClick={handleExport}
            title="Export as Markdown"
          >
            Export
          </button>
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={onDelete}
            title="Delete note"
          >
            Delete
          </button>
        </div>
      </header>
      {organizeError && mode === 'write' && (
        <p className={styles.voiceError} role="status">
          {organizeError}
        </p>
      )}
      {voiceError && mode === 'write' && (
        <p className={styles.voiceError} role="status">
          {voiceError}
        </p>
      )}
      {!voiceSupported && mode === 'write' && (
        <p className={styles.voiceBrowserHint} role="status">
          {browserVoiceUnsupportedMessage()}
        </p>
      )}
      {mode === 'write' && (
        <section className={styles.offlineSection} aria-label="Recorded dictation">
          <OfflineVoice
            body={body}
            setBody={setBody}
            onUpdate={onUpdate}
            bodyRef={bodyRef}
            getInsertRange={getInsertRange}
            onVoiceBodyCommit={onVoiceBodyCommit}
            disabled={false}
          />
        </section>
      )}

      <input
        type="text"
        className={styles.titleInput}
        value={title}
        onChange={handleTitleChange}
        placeholder="Note title"
      />

      {mode === 'write' && (
        <p className={styles.workflowHint}>{recordingWorkflowHint()}</p>
      )}

      {mode === 'write' ? (
        <textarea
          ref={bodyRef}
          className={styles.bodyInput}
          value={body}
          onChange={handleBodyChange}
          onKeyDown={handleKeyDown}
          onSelect={captureBodySelection}
          onKeyUp={captureBodySelection}
          onClick={captureBodySelection}
          onBlur={captureBodySelection}
          placeholder={keyboardPlaceholder()}
          spellCheck="true"
        />
      ) : (
        <div
          className={styles.preview}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      )}
    </div>
  )
}

function MicIcon() {
  return (
    <svg
      className={styles.voiceIcon}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

function formatRelative(ts) {
  if (ts == null) return ''
  const d = new Date(ts)
  const now = new Date()
  const sec = Math.floor((now - d) / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString()
}
