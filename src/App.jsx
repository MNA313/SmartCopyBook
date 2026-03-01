import { useState, useEffect, useCallback } from 'react'
import { loadNotes, saveNotes, loadSubjects, saveSubjects, createNoteId } from './lib/storage'
import { getTemplate } from './lib/templates'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { EmptyState } from './components/EmptyState'
import styles from './App.module.css'

const THEME_KEY = 'smartcopybook_theme'

export default function App() {
  const [notes, setNotes] = useState([])
  const [subjects, setSubjects] = useState([])
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])
  const [activeId, setActiveId] = useState(null)
  const [search, setSearch] = useState('')
  const [filterSubject, setFilterSubject] = useState(null)

  useEffect(() => {
    setNotes(loadNotes())
    setSubjects(loadSubjects())
  }, [])

  useEffect(() => {
    saveNotes(notes)
  }, [notes])

  useEffect(() => {
    saveSubjects(subjects)
  }, [subjects])

  const createNote = useCallback((subjectId, templateId = 'blank') => {
    const id = createNoteId()
    const subject = subjects.find((s) => s.id === subjectId) || subjects[0]
    const template = getTemplate(templateId)
    const title = template.title || `Untitled ${subject?.name || 'Note'}`
    const newNote = {
      id,
      subjectId: subject?.id || 'other',
      title,
      body: typeof template.body === 'function' ? template.body() : (template.body || ''),
      updatedAt: Date.now(),
    }
    setNotes((prev) => [newNote, ...prev])
    setActiveId(id)
    return id
  }, [subjects])

  const handleNewNote = useCallback((templateId = 'blank') => {
    createNote(filterSubject || subjects[0]?.id, templateId)
  }, [createNote, filterSubject, subjects])

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        handleNewNote()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleNewNote])

  const activeNote = notes.find((n) => n.id === activeId)

  const filteredNotes = notes.filter((n) => {
    const title = n.title ?? ''
    const body = n.body ?? ''
    const matchSearch =
      !search ||
      title.toLowerCase().includes(search.toLowerCase()) ||
      body.toLowerCase().includes(search.toLowerCase())
    const matchSubject = !filterSubject || n.subjectId === filterSubject
    return matchSearch && matchSubject
  })

  const updateNote = useCallback((id, updates) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n
      )
    )
  }, [])

  const deleteNote = useCallback((id) => {
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id)
      return next
    })
    if (activeId === id) {
      const remaining = notes.filter((n) => n.id !== id)
      setActiveId(remaining[0]?.id ?? null)
    }
  }, [activeId, notes])

  const addSubject = useCallback((name, color = '#6366f1') => {
    const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    setSubjects((prev) => [...prev, { id, name, color }])
    return id
  }, [])

  return (
    <div className={styles.app}>
      <Sidebar
        subjects={subjects}
        notes={filteredNotes}
        activeId={activeId}
        search={search}
        onSearchChange={setSearch}
        filterSubject={filterSubject}
        onFilterSubject={setFilterSubject}
        onSelectNote={setActiveId}
        onCreateNote={handleNewNote}
        onDeleteNote={deleteNote}
        onAddSubject={addSubject}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main className={styles.main}>
        {activeNote ? (
          <Editor
            note={activeNote}
            subject={subjects.find((s) => s.id === activeNote.subjectId)}
            onUpdate={(updates) => updateNote(activeNote.id, updates)}
            onDelete={() => deleteNote(activeNote.id)}
          />
        ) : (
          <EmptyState
            hasNotes={notes.length > 0}
            onCreateNote={handleNewNote}
          />
        )}
      </main>
    </div>
  )
}
