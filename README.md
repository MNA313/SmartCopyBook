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

### Reliable voice-to-text (OpenAI Whisper)

In-app **Offline dictation → Engine → OpenAI** sends audio to a tiny local server, which calls OpenAI’s Whisper API. Your API key stays in a server-side `.env` file (not in the browser).

1. Copy `.env.example` to `.env` in the project root and set `OPENAI_API_KEY` ([OpenAI API keys](https://platform.openai.com/api-keys)).
2. Start Vite and the transcribe proxy together:

   ```bash
   npm run dev:all
   ```

   Or run two terminals: `npm run transcribe-server` and `npm run dev`.

3. In the app, use **Record** → **Stop & transcribe** with engine **OpenAI (recommended)**.

If you see **`EADDRINUSE` / port 8787 in use**, another `transcribe-server` is probably still running (e.g. another terminal). Close that window, or set `TRANSCRIBE_PORT=8788` in `.env` and restart **both** Vite and the transcribe server so they stay in sync.

### Test on another phone or laptop (same Wi‑Fi)

Browsers only treat **`localhost`** as a “secure” site for the microphone on plain **http**. On another device you must use **HTTPS** and your PC’s LAN IP, or the mic will not work.

1. On the **computer that runs the dev server**, start with LAN mode (HTTPS + listen on all interfaces):

   ```bash
   npm run dev:all:lan
   ```

   (Voice + OpenAI: same command — the transcribe proxy still runs only on your PC; other devices talk to it through Vite’s `/api` proxy.)

2. Find this PC’s IPv4 address (e.g. **Settings → Network** or `ipconfig` in Command Prompt). Example: `192.168.1.42`.

3. On the **other device** (same Wi‑Fi), open:

   `https://192.168.1.42:5173`  
   (use your real IP; **https**, not http)

4. Accept the **certificate warning** (dev certificate). Then allow **microphone** when the browser asks.

5. If Windows Firewall prompts, **allow** access for Node/Vite on **private** networks.

**Without LAN mode**, `http://192.168.x.x:5173` may load the UI but **block the microphone** — that is normal browser behavior.

#### Android (Chrome)

1. Connect your **phone and your PC to the same Wi‑Fi** (not “guest” Wi‑Fi if that isolates devices).
2. On the PC, run **`npm run android`** (same as `npm run dev:all:lan`).
3. On the phone, open **Chrome** and go to **`https://YOUR_PC_IP:5173`** (replace with the IPv4 from `ipconfig`).
4. Chrome will warn about the certificate — use **Advanced → Continue** (unsafe) for this local dev cert only.
5. When the site asks, allow **microphone** (and **notifications** if you use install prompts). If mic is blocked: Chrome ⋮ → **Site settings** for that URL, or Android **Settings → Apps → Chrome → Permissions**.
6. Optional: Chrome ⋮ → **Add to Home screen** to open the app like an app (data still stays in Chrome’s storage for that origin).

If the page does not load, check **Windows Firewall** (allow Node on private networks) and that the phone is not on a VPN that separates it from the PC.

## Publish online (easiest options first)

If Cloudflare or Git feels difficult, try these in order:

| Option | What you do | Good for |
|--------|-------------|----------|
| **1. Netlify — drag & drop** | Run `npm run build`, then drag the **`dist`** folder into [app.netlify.com/drop](https://app.netlify.com/drop) | No terminal deploy tools; no Git required |
| **2. Vercel** | Run `npm run deploy:vercel` (or `npx vercel` after `npm run build`) | One-time browser login; smooth for Vite |
| **3. Netlify / Git** | Connect GitHub in Netlify (see below) | Auto-deploy on every push |
| **4. Cloudflare Pages** | See [Deploy to Cloudflare Pages](#deploy-to-cloudflare-pages) | If you prefer Cloudflare |

### Vercel (recommended “one command” flow)

1. Create a free account at [vercel.com](https://vercel.com) (GitHub sign-in is easiest).
2. In this project folder, in PowerShell or Terminal:

   ```bash
   npm install
   npm run build
   npx vercel
   ```

   First run: sign in in the browser and accept defaults (links this folder to a Vercel project). After that, use **`npm run deploy:vercel`** to rebuild and push to **production** in one step.

3. Vercel prints a live **`https://….vercel.app`** URL.

To deploy again after edits: `npm run deploy:vercel`. To connect the GitHub repo for automatic deploys: [vercel.com/new](https://vercel.com/new) → **Import** this repository (build: `npm run build`, output: **`dist`** — usually auto-detected with **`vercel.json`**).

## Deploy to Netlify (open on any device)

You get an **`https://something.netlify.app`** link that works on **any** phone, tablet, or PC (Wi‑Fi or cellular). This project includes **`netlify.toml`** (build command + SPA redirect) and **`public/_redirects`** (copied into `dist` when you build).

### 1. Build the site on your PC

```bash
cd C:\Users\Aeecha\Downloads\Primo
npm install
npm run build
```

You should see a **`dist`** folder.

### 2. Deploy — choose one method

**A. Drag and drop (quickest)**

1. Sign in at [app.netlify.com](https://app.netlify.com/).
2. **Sites** → **Add new site** → **Deploy manually** (or “Deploy with drag‑and‑drop”).
3. Drag the **`dist`** folder onto the page (the folder Vite created, not the whole project).
4. Netlify prints a live URL (you can rename the site under **Site settings → Domain management**).

**B. Connect GitHub (deploy on every push)**

1. Push this project to a GitHub repository.
2. In Netlify: **Add new site** → **Import an existing project** → choose **GitHub** and the repo.
3. Leave settings as Netlify reads them from **`netlify.toml`**: build command `npm run build`, publish directory **`dist`**.
4. **Deploy site**. Future commits to your branch rebuild automatically.

**C. Netlify CLI (from your machine)**

```bash
npm install -g netlify-cli
netlify login
cd C:\Users\Aeecha\Downloads\Primo
npm run build
netlify deploy --prod --dir=dist
```

Follow the prompts the first time to link the folder to a Netlify site.

## Deploy to Cloudflare Pages

Same static build as Netlify: **`npm run build`** → publish **`dist`**. This repo already has **`public/_redirects`** (SPA fallback) and **`public/_headers`** (cache hints for HTML / service worker / assets).

### Easiest path if Git or the dashboard confuses you (upload from your PC)

An assistant **cannot** log into your Cloudflare account for you. You only need to do **one browser login**, then a script uploads **`dist`** — no Git connection, no **Deploy command** field.

1. Open **PowerShell** in this project folder (where **`package.json`** is).  
   If Windows blocks the script, run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
2. **First time only** — sign in to Cloudflare (opens the browser):  
   `npx wrangler login`
3. Deploy (default project name **`smartcopybook-live`** — the script **creates** this Pages project if it does not exist, then uploads):  
   `.\scripts\deploy-cloudflare-pages.ps1`  
   If you **already** have a Pages project (e.g. **`smart0001`**), use that name so deploy finds it:  
   `.\scripts\deploy-cloudflare-pages.ps1 -ProjectName "smart0001"`  
   To see names: `npx wrangler pages project list`
4. When Wrangler finishes, it prints your **`*.pages.dev`** URL.  
   Re-run the same script anytime after `git pull` / edits to publish a new version.

**Common error:** `Project not found` / `8000007` — you used a **`--project-name`** that does not exist in your account. Fix: use **`-ProjectName`** with an existing project from **`wrangler pages project list`**, or let the script create **`smartcopybook-live`** by running it without renaming.

### Connect GitHub (recommended)

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Select your GitHub repo and branch (e.g. **`main`**).
3. **Build settings**:
   - **Framework preset**: **None** (recommended) or Vite — if deploy fails after a successful build, switch to **None** and set the command/output manually.
   - **Build command**: `npm run build`
   - **Build output directory**: `dist` (must match exactly; not `public` or `.`)
   - **Root directory**: `/` (project root)
4. **Deploy command** (under **Settings → Builds & deployments → Build configurations**, or in the initial import wizard): leave this **empty** / **disabled** / default.  
   **Do not** set it to `npx wrangler deploy`. That command is for **Cloudflare Workers** only; Wrangler then tries to parse **`vite.config.js`** as a Worker project and fails with **`Error parsing file: vite.config.js`**.  
   For **Pages**, the platform uploads the **`dist`** folder for you after the build — **no deploy command** is required.
5. **Environment variables** (optional but helps): **`NODE_VERSION`** = `20` (or rely on the repo **`.nvmrc`** if your Pages build image picks it up).
6. **Save and Deploy**. You get a **`*.pages.dev`** URL.

### If the build succeeds but “Deploying to Cloudflare’s global network” fails

- **Log shows `Executing user deploy command: npx wrangler deploy`** → Remove that deploy command in the dashboard (see step 4 above). Use **`npx wrangler pages deploy dist`** only from your **own terminal** when you want CLI upload — never as the Git **deploy** step.
- Create the project under **Workers & Pages → Pages → Connect to Git**, not as a standalone **Worker** (Workers expect something like **`src/index.ts`**).
- Do **not** add a root **`wrangler.toml`** with Worker fields (**`name`** + **`compatibility_date`**) unless you are using **Pages Functions**; that can confuse the deploy step. This repo ships **static files only** — dashboard build settings are enough.
- Double-check **Build output directory** is **`dist`** (the folder Vite writes after `npm run build`).

### Deploy from your PC (Wrangler CLI)

```bash
npm install
npm run build
npx wrangler pages deploy dist --project-name=YOUR_PROJECT_NAME
```

The first run will prompt you to log in. Replace **`YOUR_PROJECT_NAME`** with your Pages project name (e.g. **`smart0001`**).

### After deploy (Netlify or Cloudflare)

- Open the **`.netlify.app`** or **`.pages.dev`** URL on any device.
- **Notes** live in each browser’s **localStorage** for that URL — devices do not share notes unless you export/import `.md` files.
- **Offline dictation → OpenAI** only runs with the **local** dev server on your PC. On the hosted site, use **In-browser** dictation or the main **Voice** button, or run **`npm run dev:all`** locally when you need OpenAI.

## Build for production

```bash
npm run build
```

Output is in **`dist`**. Upload that folder to Netlify, Cloudflare Pages, or any static host; SPA routing uses **`public/_redirects`** (copied into `dist`). Netlify also reads **`netlify.toml`**; Cloudflare Pages can use **`public/_headers`**.

## Tech

- React 18 + Vite 5
- Data stored in `localStorage` (no backend required)

