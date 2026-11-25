# FinLens — Finance, Clearly.

Personal finance, lending, EMI tracker, investment portfolio, and debt manager backed by Google Sheets and Google Apps Script, secured with server-hashed PIN authentication.

## Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite PWA (`src/`)
- **Backend Proxy**: Express server (`server.ts`, `server/apiApp.ts`) and Vercel serverless endpoints (`api/auth/*`, `api/finance/*`) that proxy `/api/*` requests to Google Apps Script
- **Database**: Google Sheets via Google Apps Script Web App (`apps-script/*.gs`)

> **Important:** Because the frontend calls `/api/*` endpoints that hold your `GAS_WEB_APP_URL` and `GAS_API_SECRET`, deploy this project to a host that runs `/api/*` routes (such as **Vercel**, **Render**, **Railway**, **Fly.io**, or **Google Cloud Run**)—not a static-only host like GitHub Pages unless `VITE_API_BASE_URL` points to a separately hosted backend.

---

## 1. Google Apps Script Setup

1. Create a Google Sheet (or open your existing tracking workbook).
2. Open **Extensions → Apps Script** and copy all files from `apps-script/` into the project.
3. In **Project Settings → Script Properties**, configure:
   - `SPREADSHEET_ID`: Your Google Sheet ID (if not bound directly to the sheet)
   - `API_SECRET`: A strong random secret string
4. Run any spreadsheet function once in the Apps Script editor to grant **SpreadsheetApp** permissions.
5. Click **Deploy → New deployment → Web app**:
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
6. Copy the generated `https://script.google.com/macros/s/.../exec` Web App URL.

---

## 2. Environment Variables

Set these environment variables on your hosting provider (never commit `.env` files to GitHub):

| Variable | Required | Description |
| --- | --- | --- |
| `GAS_WEB_APP_URL` | Yes | Deployed Google Apps Script Web App URL (`https://script.google.com/macros/s/.../exec`) |
| `GAS_API_SECRET` | Yes | Must match `API_SECRET` in Apps Script Script Properties |
| `FINANCE_RECOVERY_KEY` | No | Optional recovery key |
| `VITE_API_BASE_URL` | No | Only if hosting frontend and backend on separate domains |
| `CORS_ORIGIN` | No | Allowed frontend origin when `VITE_API_BASE_URL` is used |

---

## 3. Deployment Options

### Option A: Vercel
1. Import the GitHub repository into Vercel (Vite preset is auto-detected; `vercel.json` and `api/` serverless endpoints handle SPA + `/api/*` routing automatically).
2. Add `GAS_WEB_APP_URL` and `GAS_API_SECRET` in **Vercel Project Settings → Environment Variables**.
3. Deploy.

### Option B: Render / Railway / Node.js Host
1. Connect the GitHub repository (`render.yaml` is included for Render Blueprints).
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Add `GAS_WEB_APP_URL` and `GAS_API_SECRET` in the host's Environment Variables.

### Option C: Docker / Cloud Run / Fly.io
Use the included `Dockerfile`:
```bash
docker build -t finlens .
docker run -p 3000:3000 -e GAS_WEB_APP_URL="..." -e GAS_API_SECRET="..." finlens
```
