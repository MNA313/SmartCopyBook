import { Component } from 'react'
import styles from './ErrorBoundary.module.css'

export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('SmartCopyBook error:', error, info)
  }

  clearCacheAndReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch (e) {
      console.warn('Cache clear failed:', e)
    }
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <div className={styles.wrap}>
          <div className={styles.card}>
            <div className={styles.icon}>⚠</div>
            <h1 className={styles.title}>Something went wrong</h1>
            <p className={styles.message}>
              {this.state.error?.message || 'An error occurred.'}
            </p>
            <p className={styles.hint}>
              After a new deploy, an old offline copy can still run. Use the button below to load the latest
              version.
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.retry} onClick={() => this.setState({ error: null })}>
                Try again
              </button>
              <button type="button" className={styles.clearCache} onClick={this.clearCacheAndReload}>
                Clear cache &amp; reload
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
