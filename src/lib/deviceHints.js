/**
 * Short device/OS hints for mic and speech UI (avoid Windows-only copy on phones).
 * All functions are safe to call from the client only.
 */

export function isMobileUserAgent() {
  if (typeof navigator === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

export function isAndroid() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

export function isIOS() {
  return typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/** Mic + privacy paths vary by OS */
export function micAndPrivacyHint() {
  if (isAndroid()) {
    return 'Android: Settings → Apps → Chrome → Permissions → Microphone (Allow). Also Settings → Sound and vibration → your device’s mic level if speech is quiet.'
  }
  if (isIOS()) {
    return 'iPhone/iPad: Settings → Privacy & Security → Microphone → turn on for Chrome (or Safari). Use a good network—speech may use online recognition.'
  }
  return 'Windows: Settings → Privacy → Microphone (allow desktop apps) and System → Sound → input device and volume. macOS: System Settings → Privacy & Security → Microphone for your browser.'
}

export function onlineSpeechRecognitionHint() {
  if (isAndroid()) {
    return 'The mic is working, but nothing was transcribed. Allow Chrome to use the microphone, keep Wi‑Fi or mobile data on, and try disabling VPN/ad blockers that might block Google. Battery saver can also limit background network.'
  }
  if (isIOS()) {
    return 'The mic is working, but nothing was transcribed. Try Chrome from the App Store; allow Microphone. iOS Safari may not support Web Speech—Chrome usually works best for Voice.'
  }
  return 'The mic is working, but nothing was transcribed. Turn on “Online speech recognition” in system privacy/speech settings (Windows/macOS), and ensure VPN/firewall/ad blockers are not blocking Google speech services.'
}

export function noSpeechRetriesHint() {
  return `No speech after several tries. ${micAndPrivacyHint()} Speak right after you tap Voice.`
}

export function serviceNotAllowedHint() {
  if (isAndroid()) {
    return 'Speech recognition is blocked or unavailable. In Chrome: Site settings → Microphone → Allow. Also check Android Settings → Apps → Google Play services.'
  }
  if (isIOS()) {
    return 'Speech recognition may be blocked. Try Chrome (App Store) with Microphone allowed, or use Record & transcribe below.'
  }
  return 'Speech recognition is blocked. On Windows 11: Settings → Privacy & security → Speech → turn on “Online speech recognition”.'
}

export function audioCaptureHint() {
  if (isMobileUserAgent()) {
    return 'No microphone signal. Check the browser’s microphone permission (tap the lock icon in the address bar), and that the device is not muted or in a call that uses the mic.'
  }
  return 'No microphone signal. Check that a mic is selected in system sound settings and not muted.'
}

export function stallNoActivityHint() {
  if (isMobileUserAgent()) {
    return 'No microphone activity detected. Tap inside the note, press Voice again, speak clearly, and check the browser allowed the microphone. If the site is in the background, bring it to the front.'
  }
  return 'No microphone activity detected. Click in the note, press Voice again, speak clearly, and check your system input device and volume. On Windows you can try turning off “Exclusive mode” in Sound → device → Advanced.'
}

export function offlineQuietRecordingHint() {
  if (isAndroid()) {
    return 'No speech detected — the recording looks very quiet. In Settings → Sound, raise your mic/input level; then try again and speak for a few seconds.'
  }
  if (isIOS()) {
    return 'No speech detected — the recording looks very quiet. Check Settings → Privacy → Microphone for this app, and try speaking closer to the mic.'
  }
  return 'No speech detected — the recording looks very quiet. Raise the mic input level in system sound settings, then try again and speak for a few seconds.'
}

export function genericNoWordsHint() {
  if (isMobileUserAgent()) {
    return 'No words recognized. Speak closer to the mic, use a quiet room, and record at least 2–3 seconds. Check the browser’s microphone permission.'
  }
  return 'No words recognized (Whisper heard silence or unclear audio). Speak closer to the mic, avoid muted apps, and record at least 2–3 seconds.'
}

export function keyboardPlaceholder() {
  if (isMobileUserAgent()) {
    return 'Write or tap Voice to dictate. **bold**, *italic*, # headings, lists, ``` code'
  }
  return 'Write or use Voice to dictate. **bold**, *italic*, # headings, lists, ``` code'
}

export function browserVoiceUnsupportedMessage() {
  if (isIOS()) {
    return 'Web Speech is not available here. Use Chrome from the App Store, allow Microphone, or use Record & transcribe below.'
  }
  if (isAndroid()) {
    return 'Web Speech is not available in this browser. Open the site in Chrome with Microphone allowed, or use Record & transcribe below.'
  }
  return 'Speech recognition is not available in this browser. Try Chrome or Edge, or use Record & transcribe below.'
}

export function longModeTitle() {
  return 'Continuous: keep listening through pauses (good for lectures). Off: stop after each phrase.'
}

export function voiceButtonTooltip(listening) {
  if (listening) return 'Stop dictation'
  return 'Dictate into the note. Match Language to how you speak. If this fails, use Record & transcribe below.'
}

export function recordingWorkflowHint() {
  return 'While you use Voice, sentences are spaced and broken onto new lines as you go. For the cleanest lecture text, use Record & transcribe → OpenAI (npm run dev:all), or tap Organize when done.'
}

/** When OpenAI proxy is not reachable (e.g. static deploy). */
export function openaiServerUnreachableMessage(isProduction) {
  if (isProduction) {
    return 'OpenAI server mode is not available on this hosted site. Use In-browser engine below, or use the Voice button (works in Chrome on Android/iPhone with HTTPS).'
  }
  return 'Transcribe server not reachable. On your PC run npm run dev:all (or two terminals: npm run transcribe-server and npm run dev). Add OPENAI_API_KEY to .env next to package.json, then restart.'
}
