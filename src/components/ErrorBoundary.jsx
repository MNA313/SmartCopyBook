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
            <button
              type="button"
              className={styles.retry}
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
