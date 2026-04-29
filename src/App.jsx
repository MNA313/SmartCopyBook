import { useState, useEffect, useCallback, useRef } from 'react'
import { getTemplate } from './lib/templates'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { EmptyState } from './components/EmptyState'
import { AuthPanel } from './components/AuthPanel'
import { hasSupabaseConfig } from './lib/supabaseClient'
import {
  createNoteId,
  addSubject as addSubjectCloud,
  deleteNote as deleteNoteCloud,
  ensureDefaultSubjects,
  getSession,
  loadNotes,
  onAuthStateChange,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  upsertNote,
} from './lib/cloudStorage'
import styles from './App.module.css'

const THEME_KEY = 'smartcopybook_theme'

export default function App() {
  const [notes, setNotes] = useState([])
  const [subjects, setSubjects] = useState([])
  const [session, setSession] = useState(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [syncError, setSyncError] = useState('')
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const saveTimersRef = useRef(new Map())

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setLoadingData(false)
      return
    }
    let alive = true
    getSession()
      .then((s) => {
        if (alive) setSession(s)
      })
      .catch((e) => {
        if (alive) setSyncError(e?.message || 'Could not connect to Supabase.')
      })
    const { data } = onAuthStateChange((s) => setSession(s))
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  const loadUserData = useCallback(async (userId) => {
    setLoadingData(true)
    setSyncError('')
    try {
      const [userSubjects, userNotes] = await Promise.all([
        ensureDefaultSubjects(userId),
        loadNotes(userId),
      ])
      setSubjects(userSubjects)
      setNotes(userNotes)
      setActiveId(userNotes[0]?.id ?? null)
    } catch (e) {
      setSyncError(e?.message || 'Could not load your notes.')
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    if (!hasSupabaseConfig) return
    if (!session?.user?.id) {
      setLoadingData(false)
      setNotes([])
      setSubjects([])
      setActiveId(null)
      return
    }
    loadUserData(session.user.id)
  }, [session?.user?.id, loadUserData])

  const handleSignIn = async (email, password) => {
    setAuthBusy(true)
    try {
      await signInWithPassword(email, password)
    } finally {
      setAuthBusy(false)
    }
  }

  const handleSignUp = async (email, password) => {
    setAuthBusy(true)
    try {
      await signUpWithPassword(email, password)
    } finally {
      setAuthBusy(false)
    }
  }

  const handleSignOut = async () => {
    setAuthBusy(true)
    try {
      await signOut()
      for (const timer of saveTimersRef.current.values()) clearTimeout(timer)
      saveTimersRef.current.clear()
    } catch (e) {
      setSyncError(e?.message || 'Could not sign out.')
    } finally {
      setAuthBusy(false)
    }
  }

  const createNote = useCallback((subjectId, templateId = 'blank') => {
    if (!session?.user?.id) return null
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
    upsertNote(session.user.id, newNote).catch((e) => {
      setSyncError(e?.message || 'Could not create note.')
    })
    return id
  }, [session?.user?.id, subjects])

  const handleNewNote = useCallback((templateId = 'blank') => {
    createNote(filterSubject || subjects[0]?.id, templateId)
    setMobileNavOpen(false)
  }, [createNote, filterSubject, subjects])

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        handleNewNote()
      }
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleNewNote])

  const selectNote = useCallback((id) => {
    setActiveId(id)
    setMobileNavOpen(false)
  }, [])

  const activeNote = notes.find((n) => n.id === activeId)

  const updateNote = useCallback((id, updates) => {
    if (!session?.user?.id) return
    let outgoing = null
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? (outgoing = { ...n, ...updates, updatedAt: Date.now() }) : n
      )
    )
    if (!outgoing) return
    const currentTimer = saveTimersRef.current.get(id)
    if (currentTimer) clearTimeout(currentTimer)
    const t = setTimeout(() => {
      upsertNote(session.user.id, outgoing).catch((e) => {
        setSyncError(e?.message || 'Could not save note updates.')
      })
      saveTimersRef.current.delete(id)
    }, 450)
    saveTimersRef.current.set(id, t)
  }, [session?.user?.id])

  const handleEditorUpdate = useCallback(
    (updates) => {
      if (activeId) updateNote(activeId, updates)
    },
    [activeId, updateNote],
  )

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

  const deleteNote = useCallback((id) => {
    if (!session?.user?.id) return
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== id)
      return next
    })
    if (activeId === id) {
      const remaining = notes.filter((n) => n.id !== id)
      setActiveId(remaining[0]?.id ?? null)
    }
    const t = saveTimersRef.current.get(id)
    if (t) {
      clearTimeout(t)
      saveTimersRef.current.delete(id)
    }
    deleteNoteCloud(session.user.id, id).catch((e) => {
      setSyncError(e?.message || 'Could not delete note.')
    })
  }, [activeId, notes, session?.user?.id])

  const addSubject = useCallback((name, color = '#6366f1') => {
    if (!session?.user?.id) return null
    const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const row = { id, name, color }
    setSubjects((prev) => [...prev, row])
    addSubjectCloud(session.user.id, row).catch((e) => {
      setSyncError(e?.message || 'Could not add subject.')
    })
    return id
  }, [session?.user?.id])

  const activeTitle = activeNote?.title?.trim() || 'SmartCopyBook'

  const sidebarTouchStartX = useRef(null)
  const onSidebarTouchStart = useCallback((e) => {
    if (e.touches.length === 1) sidebarTouchStartX.current = e.touches[0].clientX
  }, [])
  const onSidebarTouchEnd = useCallback((e) => {
    const start = sidebarTouchStartX.current
    sidebarTouchStartX.current = null
    if (start == null || !e.changedTouches?.length) return
    const dx = e.changedTouches[0].clientX - start
    if (dx < -52) setMobileNavOpen(false)
  }, [])

  if (!hasSupabaseConfig) {
    return (
      <AuthPanel
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        busy={authBusy}
        configError="Missing Supabase configuration. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart."
      />
    )
  }

  if (!session) {
    return (
      <AuthPanel
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        busy={authBusy}
        configError={syncError}
      />
    )
  }

  if (loadingData) {
    return <div className={styles.loading}>Loading your notes…</div>
  }

  return (
    <div className={styles.app}>
      {mobileNavOpen && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close notes menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <div
        className={`${styles.sidebarShell} ${mobileNavOpen ? styles.sidebarShellOpen : ''}`}
        onTouchStart={onSidebarTouchStart}
        onTouchEnd={onSidebarTouchEnd}
      >
        <Sidebar
          subjects={subjects}
          notes={filteredNotes}
          activeId={activeId}
          search={search}
          onSearchChange={setSearch}
          filterSubject={filterSubject}
          onFilterSubject={setFilterSubject}
          onSelectNote={selectNote}
          onCreateNote={handleNewNote}
          onDeleteNote={deleteNote}
          onAddSubject={addSubject}
          theme={theme}
          onToggleTheme={toggleTheme}
          userEmail={session.user.email}
          onSignOut={handleSignOut}
        />
      </div>
      <main className={styles.main}>
        {syncError && <p className={styles.syncError}>{syncError}</p>}
        <header className={styles.mobileBar}>
          <button
            type="button"
            className={styles.menuBtn}
            onClick={() => setMobileNavOpen(true)}
            aria-expanded={mobileNavOpen}
            aria-controls="app-sidebar"
            aria-label="Open notes list"
          >
            ☰
          </button>
          <span className={styles.mobileTitle}>{activeTitle}</span>
        </header>
        {activeNote ? (
          <Editor
            note={activeNote}
            subject={subjects.find((s) => s.id === activeNote.subjectId)}
            onUpdate={handleEditorUpdate}
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
