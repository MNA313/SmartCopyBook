const KEY_NOTES = 'smartcopybook_notes'
const KEY_SUBJECTS = 'smartcopybook_subjects'

const defaultSubjects = [
  { id: 'math', name: 'Math', color: '#6366f1' },
  { id: 'science', name: 'Science', color: '#22c55e' },
  { id: 'english', name: 'English', color: '#f59e0b' },
  { id: 'other', name: 'Other', color: '#8888a0' },
]

export function loadNotes() {
  try {
    const raw = localStorage.getItem(KEY_NOTES)
    const notes = raw ? JSON.parse(raw) : []
    return notes.map((n) => ({
      ...n,
      title: n.title ?? 'Untitled',
      body: n.body ?? '',
      subjectId: n.subjectId ?? 'other',
      updatedAt: n.updatedAt ?? Date.now(),
    }))
  } catch {
    return []
  }
}

export function saveNotes(notes) {
  localStorage.setItem(KEY_NOTES, JSON.stringify(notes))
}

export function loadSubjects() {
  try {
    const raw = localStorage.getItem(KEY_SUBJECTS)
    return raw ? JSON.parse(raw) : defaultSubjects
  } catch {
    return defaultSubjects
  }
}

export function saveSubjects(subjects) {
  localStorage.setItem(KEY_SUBJECTS, JSON.stringify(subjects))
}

export function createNoteId() {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}
