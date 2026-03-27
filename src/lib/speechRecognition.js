/**
 * Web Speech API (SpeechRecognition). Chrome/Edge/Safari (webkit); Firefox often unsupported.
 */
export function getSpeechRecognition() {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition || window.webkitSpeechRecognition || null
}

export function isSpeechRecognitionSupported() {
  return !!getSpeechRecognition()
}
