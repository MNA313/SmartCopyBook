import { useState, useEffect, useRef } from 'react'
import { marked } from 'marked'
import styles from './Editor.module.css'

export function Editor({ note, subject, onUpdate, onDelete }) {
  const [title, setTitle] = useState(note.title ?? '')
  const [body, setBody] = useState(note.body ?? '')
  const [mode, setMode] = useState('write')
  const bodyRef = useRef(null)
  const saveTimeoutRef = useRef(null)

  useEffect(() => {
    setTitle(note.title ?? '')
    setBody(note.body ?? '')
  }, [note.id])

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
    setBody(v)
    debouncedSave(() => ({ body: v }))
  }

  const wrapSelection = (before, after = before) => {
    const ta = bodyRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = body.slice(start, end)
    const newText = body.slice(0, start) + before + selected + after + body.slice(end)
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
      setBody(newBody)
      onUpdate({ body: newBody })
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 1
      })
    }
  }

  const [previewHtml, setPreviewHtml] = useState('')
  useEffect(() => {
    const result = marked.parse(body || '')
    if (typeof result?.then === 'function') {
      result.then((h) => setPreviewHtml(h ?? ''))
    } else {
      setPreviewHtml(result ?? '')
    }
  }, [body])

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

      <input
        type="text"
        className={styles.titleInput}
        value={title}
        onChange={handleTitleChange}
        placeholder="Note title"
      />

      {mode === 'write' ? (
        <textarea
          ref={bodyRef}
          className={styles.bodyInput}
          value={body}
          onChange={handleBodyChange}
          onKeyDown={handleKeyDown}
          placeholder="Start typing… Ctrl+B bold, Ctrl+I italic. Use **bold**, *italic*, # headers, - lists, ``` code"
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
