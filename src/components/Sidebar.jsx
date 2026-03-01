import { useState, useRef, useEffect } from 'react'
import { NOTE_TEMPLATES } from '../lib/templates'
import styles from './Sidebar.module.css'

export function Sidebar({
  subjects,
  notes,
  activeId,
  search,
  onSearchChange,
  filterSubject,
  onFilterSubject,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onAddSubject,
  theme,
  onToggleTheme,
}) {
  const [showAddSubject, setShowAddSubject] = useState(false)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [showTemplateMenu, setShowTemplateMenu] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!showTemplateMenu) return
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowTemplateMenu(false)
    }
    document.addEventListener('click', onClickOutside)
    return () => document.removeEventListener('click', onClickOutside)
  }, [showTemplateMenu])

  const handleAddSubject = (e) => {
    e?.preventDefault()
    const name = newSubjectName.trim()
    if (!name) return
    onAddSubject(name)
    setNewSubjectName('')
    setShowAddSubject(false)
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>◇</span>
          <span>SmartCopyBook</span>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <div className={styles.newNoteWrap} ref={menuRef}>
            <button
              type="button"
              className={styles.newNote}
              onClick={() => setShowTemplateMenu((v) => !v)}
              title="New note (Ctrl+N)"
            >
              + New note ▾
            </button>
            {showTemplateMenu && (
              <div className={styles.templateMenu}>
                {NOTE_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={styles.templateItem}
                    onClick={() => {
                      onCreateNote(t.id)
                      setShowTemplateMenu(false)
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.searchWrap}>
        <span className={styles.searchIcon} aria-hidden>⌕</span>
        <input
          type="search"
          placeholder="Search notes…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={styles.search}
        />
      </div>

      <div className={styles.subjects}>
        <button
          type="button"
          className={`${styles.subjectChip} ${filterSubject === null ? styles.active : ''}`}
          onClick={() => onFilterSubject(null)}
        >
          All
        </button>
        {subjects.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`${styles.subjectChip} ${filterSubject === s.id ? styles.active : ''}`}
            style={{ '--chip-color': s.color }}
            onClick={() => onFilterSubject(s.id)}
          >
            <span className={styles.chipDot} style={{ background: s.color }} />
            {s.name}
          </button>
        ))}
        {showAddSubject ? (
          <form onSubmit={handleAddSubject} className={styles.addSubjectForm}>
            <input
              autoFocus
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="Subject name"
              className={styles.addSubjectInput}
              onBlur={() => !newSubjectName.trim() && setShowAddSubject(false)}
            />
            <button type="submit" className={styles.addSubjectBtn}>Add</button>
          </form>
        ) : (
          <button
            type="button"
            className={styles.addSubjectTrigger}
            onClick={() => setShowAddSubject(true)}
          >
            + Subject
          </button>
        )}
      </div>

      <nav className={styles.notes}>
        <div className={styles.notesLabel}>Notes</div>
        {notes.length === 0 ? (
          <p className={styles.empty}>No notes yet. Create one above.</p>
        ) : (
          <ul className={styles.notesList}>
            {notes.map((n) => {
              const subj = subjects.find((s) => s.id === n.subjectId)
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`${styles.noteItem} ${activeId === n.id ? styles.active : ''}`}
                    onClick={() => onSelectNote(n.id)}
                  >
                    <span
                      className={styles.noteDot}
                      style={{ background: subj?.color ?? 'var(--text-muted)' }}
                    />
                    <span className={styles.noteTitle}>{n.title || 'Untitled'}</span>
                    <span className={styles.noteDate}>
                      {formatDate(n.updatedAt)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </nav>
    </aside>
  )
}

function formatDate(ts) {
  if (ts == null) return ''
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const diff = (now - d) / (24 * 60 * 60 * 1000)
  if (diff < 7) return `${Math.floor(diff)}d ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
