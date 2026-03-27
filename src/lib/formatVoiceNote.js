/**
 * Tidy browser speech-to-text: spacing and one line per sentence so notes are easier to read.
 * Used on every speech update (live) and when you stop dictation.
 * For even cleaner transcripts, use Record & transcribe → OpenAI (Whisper).
 */
export function formatVoiceNote(text) {
  if (!text || typeof text !== 'string') return ''
  let s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  s = s.replace(/[ \t\f\v]+/g, ' ')
  s = s.replace(/\s+([.,!?;:])/g, '$1')
  // Break into lines after sentence endings (readable “structured” block)
  s = s.replace(/([.!?])\s+/g, '$1\n')
  s = s.replace(/\n{3,}/g, '\n\n')
  return s.trim()
}
