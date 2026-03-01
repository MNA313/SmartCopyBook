# SmartCopyBook

A simple, focused web app for taking and organizing class notes.

## Features

- **Notes by subject** — Math, Science, English, Other (and custom subjects)
- **Search** — Find notes by title or content
- **Filter by subject** — Click subject chips to filter the list
- **Auto-save** — Notes are saved to your browser as you type
- **Markdown support** — Write formatted notes with **bold**, *italic*, headers, lists, code blocks. Toggle Write/Preview to see the rendered result.
- **Export** — Export any note as a `.md` file to backup or share
- **Light/Dark theme** — Toggle between themes (☀/☾ in the sidebar). Your preference is saved.
- **Note templates** — Create notes from templates: Blank, Lecture, Lab Report, Reading Notes (use the ▾ dropdown on "+ New note")
- **Formatting shortcuts** — `Ctrl+B` bold, `Ctrl+I` italic while editing
- **PWA** — Install as an app (Add to Home Screen / Install) and use offline
- **Keyboard shortcut** — `Ctrl+N` (or `Cmd+N` on Mac) to create a new note

## Run locally

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

## Build for production

```bash
npm run build
```

Output is in the `dist` folder. Serve it with any static file server.

## Tech

- React 18 + Vite 5
- Data stored in `localStorage` (no backend required)

