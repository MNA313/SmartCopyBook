import styles from './EmptyState.module.css'

export function EmptyState({ hasNotes, onCreateNote }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.icon}>◇</div>
        <h1 className={styles.title}>SmartCopyBook</h1>
        <p className={styles.subtitle}>
          {hasNotes
            ? 'Select a note from the sidebar or create a new one.'
            : 'Your class notes, organized by subject. Create your first note to get started.'}
        </p>
        <button type="button" className={styles.cta} onClick={onCreateNote}>
          {hasNotes ? 'New note' : 'Create first note'}
        </button>
        <p className={styles.hint}>
          <kbd>Ctrl</kbd>+<kbd>N</kbd> — New note
        </p>
      </div>
    </div>
  )
}
