import { useState } from 'react'
import styles from './AuthPanel.module.css'

export function AuthPanel({ onSignIn, onSignUp, configError, busy }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const submit = async (mode) => {
    setError('')
    setInfo('')
    try {
      if (!email.trim() || !password.trim()) {
        throw new Error('Enter both email and password.')
      }
      if (password.length < 6) {
        throw new Error('Password should be at least 6 characters.')
      }
      if (mode === 'signin') {
        await onSignIn(email.trim(), password)
      } else {
        await onSignUp(email.trim(), password)
        setInfo('Account created. Check your inbox if email confirmation is enabled.')
      }
    } catch (e) {
      setError(e?.message || 'Authentication failed.')
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Welcome to SmartCopyBook</h1>
        <p className={styles.subtitle}>Sign in to keep your notes private and synced across devices.</p>
        {configError && <p className={styles.error}>{configError}</p>}
        <input
          type="email"
          className={styles.input}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          type="password"
          className={styles.input}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <p className={styles.error}>{error}</p>}
        {info && <p className={styles.info}>{info}</p>}
        <div className={styles.row}>
          <button type="button" className={styles.primary} disabled={busy || !!configError} onClick={() => submit('signin')}>
            {busy ? 'Please wait…' : 'Sign in'}
          </button>
          <button type="button" className={styles.ghost} disabled={busy || !!configError} onClick={() => submit('signup')}>
            Create account
          </button>
        </div>
      </div>
    </div>
  )
}
