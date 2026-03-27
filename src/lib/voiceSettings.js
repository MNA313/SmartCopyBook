const LANG_KEY = 'smartcopybook_voice_lang'
const CONT_KEY = 'smartcopybook_voice_continuous'

export const VOICE_LANG_OPTIONS = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'en-PH', label: 'English (Philippines)' },
  { value: 'fil-PH', label: 'Filipino (Philippines)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'es-MX', label: 'Spanish (Mexico)' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
  { value: 'ja-JP', label: 'Japanese' },
  { value: 'zh-CN', label: 'Chinese (Mandarin)' },
  { value: 'ko-KR', label: 'Korean' },
  { value: 'hi-IN', label: 'Hindi (India)' },
]

function normalizeLang(raw) {
  if (!raw || typeof raw !== 'string') return 'en-US'
  const t = raw.trim()
  if (/^en$/i.test(t)) return 'en-US'
  return t
}

export function loadVoiceLang() {
  try {
    const s = localStorage.getItem(LANG_KEY)
    if (s && typeof s === 'string') return s
  } catch {
    /* noop */
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return normalizeLang(navigator.language)
  }
  return 'en-US'
}

export function saveVoiceLang(lang) {
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    /* noop */
  }
}

/** `true` = one long session; `false` = pause between phrases (sometimes more reliable on some devices). */
export function loadVoiceContinuous() {
  try {
    const s = localStorage.getItem(CONT_KEY)
    if (s === '0') return false
    if (s === '1') return true
  } catch {
    /* noop */
  }
  return true
}

export function saveVoiceContinuous(value) {
  try {
    localStorage.setItem(CONT_KEY, value ? '1' : '0')
  } catch {
    /* noop */
  }
}
