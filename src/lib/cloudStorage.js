import { requireSupabase } from './supabaseClient'

const defaultSubjects = [
  { name: 'Math', color: '#6366f1' },
  { name: 'Science', color: '#22c55e' },
  { name: 'English', color: '#f59e0b' },
  { name: 'Other', color: '#8888a0' },
]

function uid(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function createNoteId() {
  return uid('n')
}

export function createSubjectId() {
  return uid('s')
}

function normalizeNote(row) {
  return {
    id: row.id,
    subjectId: row.subject_id ?? 'other',
    title: row.title ?? 'Untitled',
    body: row.body ?? '',
    updatedAt: Number(row.updated_at) || Date.now(),
  }
}

function normalizeSubject(row) {
  return {
    id: row.id,
    name: row.name ?? 'Subject',
    color: row.color ?? '#6366f1',
  }
}

export async function signInWithPassword(email, password) {
  const supabase = requireSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUpWithPassword(email, password) {
  const supabase = requireSupabase()
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const supabase = requireSupabase()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const supabase = requireSupabase()
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session ?? null
}

export function onAuthStateChange(handler) {
  const supabase = requireSupabase()
  return supabase.auth.onAuthStateChange((_event, session) => handler(session ?? null))
}

export async function loadSubjects(userId) {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('subjects')
    .select('id,name,color')
    .eq('user_id', userId)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map(normalizeSubject)
}

export async function ensureDefaultSubjects(userId) {
  const existing = await loadSubjects(userId)
  if (existing.length > 0) return existing
  const supabase = requireSupabase()
  const payload = defaultSubjects.map((s) => ({
    id: createSubjectId(),
    user_id: userId,
    name: s.name,
    color: s.color,
  }))
  const { data, error } = await supabase
    .from('subjects')
    .insert(payload)
    .select('id,name,color')
  if (error) throw error
  return (data ?? []).map(normalizeSubject)
}

export async function addSubject(userId, subject) {
  const supabase = requireSupabase()
  const row = {
    id: subject.id || createSubjectId(),
    user_id: userId,
    name: subject.name,
    color: subject.color,
  }
  const { data, error } = await supabase
    .from('subjects')
    .insert(row)
    .select('id,name,color')
    .single()
  if (error) throw error
  return normalizeSubject(data)
}

export async function loadNotes(userId) {
  const supabase = requireSupabase()
  const { data, error } = await supabase
    .from('notes')
    .select('id,subject_id,title,body,updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(normalizeNote)
}

export async function upsertNote(userId, note) {
  const supabase = requireSupabase()
  const row = {
    id: note.id,
    user_id: userId,
    subject_id: note.subjectId,
    title: note.title,
    body: note.body,
    updated_at: Number(note.updatedAt) || Date.now(),
  }
  const { error } = await supabase.from('notes').upsert(row)
  if (error) throw error
}

export async function deleteNote(userId, noteId) {
  const supabase = requireSupabase()
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('user_id', userId)
    .eq('id', noteId)
  if (error) throw error
}
