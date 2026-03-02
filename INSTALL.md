# SmartCopyBook — Installation Guide

This guide explains how to install and run SmartCopyBook on your computer.

## Prerequisites

- **Node.js** (version 18 or newer recommended)
- **npm** (comes with Node.js)

To check if you have them installed:

```bash
node --version
npm --version
```

If not installed, download Node.js from [nodejs.org](https://nodejs.org/).

---

## Quick Start

### 1. Clone or download the project

If you have the project as a folder, open a terminal in that folder.

If cloning from GitHub:

```bash
git clone https://github.com/YOUR_USERNAME/SmartCopyBook.git
cd SmartCopyBook
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the development server

```bash
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Other Commands

| Command | Description |
|--------|-------------|
| `npm run dev` | Start development server (hot reload) |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |

---

## Production Build

To build the app for deployment:

```bash
npm run build
```

The output is in the `dist` folder. You can:

- Upload `dist` to any static hosting (Netlify, Vercel, GitHub Pages)
- Serve it with any web server (e.g. `npx serve dist`)

---

## PWA (Install as App)

SmartCopyBook can be installed as an app:

- **Chrome/Edge**: Use the install icon in the address bar, or menu → "Install SmartCopyBook"
- **Mobile**: Add to Home Screen from the browser menu

Once installed, it works offline.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `npm install` fails | Ensure Node.js 18+ is installed; try deleting `node_modules` and `package-lock.json`, then run `npm install` again |
| Port 5173 in use | Vite will suggest another port, or use `npm run dev -- --port 3000` |
| Blank page after build | Serve the `dist` folder from the root path (e.g. `https://yoursite.com/` not `https://yoursite.com/app/`) |
