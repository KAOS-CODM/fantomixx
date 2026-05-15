# Fantomixx

Fantomixx is a self-hosted comic library web app backed by **PocketBase**. It provides:

- Public site: browse comics, view comic details and read chapters.
- Admin area: create/update comic metadata, upload covers, and batch upload **CBZ** chapter archives.

The server is an **Express** app that serves the static frontend from `public/` and exposes a JSON API under `/api`.

---

## Features

### Public (read-only)

- Home / featured “Hot Comics” cards (loads via `/api/comics`).
- Comic listing and comic details pages.
- Chapter viewer that loads and renders CBZ contents in the browser.
- Dynamic navigation and footer via JSON files:
  - `functions/data/nav.json` → `/api/nav`
  - `functions/data/footer.json` → `/api/footer`

### Admin (authenticated)

- Login/logout pages and protected admin route.
- Comic metadata upsert (supports XML import via the admin UI).
- Upload comic cover images and store the resulting URL on the comic record.
- Batch upload chapters as **CBZ** archives and create chapter records.
- Delete comics and chapters.

---

## Tech stack

- **Node.js + Express (ES modules)**
- **PocketBase** (used for collections: `comics`, `chapters`, `admins`)
- **multer** for file uploads
- **PocketBase files** URLs via `pb.files.getURL()`

---

## Project structure

- `functions/server.js` – Express server + API routes + admin helpers
- `functions/pb.js` – PocketBase client initialization
- `functions/schema.sql` – (example) database schema / reference
- `functions/pb_migrations/` – PocketBase migrations history
- `functions/data/` – `nav.json`, `footer.json`
- `public/` – frontend HTML/CSS/JS
- `admin/` – admin HTML + UI assets served by the same server

---

## Prerequisites

1. **PocketBase** running somewhere reachable by the app.
2. Node.js installed.

### Required environment variables

Create an `.env` file (in `functions/`) or set variables in your environment.

From the code:

- `PORT` – Express port (default: `3000`)
- `SESSION_SECRET` – Express session secret
- `PB_URL` – PocketBase base URL (default: `http://127.0.0.1:8090`)

---

## Setup & running locally

### 1) Install dependencies

```bash
cd functions
npm install
```

### 2) Configure PocketBase

Ensure your PocketBase has collections that match the app usage:

- `comics`
- `chapters`
- `admins`

The app expects fields such as (based on usage in `server.js`):

- `comics`: `title`, `description`, `shortdescription`, `author`, `penciller`, `genre`, `source`, `status`, `cover`, `cover_url`
- `chapters`: `comic_id`, `title`, `order`, `cbz_url`, `cbz_file`

> Tip: If you already have your PocketBase instance configured, just ensure the collection/field names align.

### 3) Start the API server

```bash
cd functions
npm run dev
```

Then open:

- Public site: `http://localhost:3000/` (and other routes like `/comic`, `/chapter`, etc.)
- Admin: `http://localhost:3000/admin-login` (and after login, `GET /admin`)

---

## API reference

Base URL: `http://localhost:3000/api`

### Public

- `GET /api/test`
- `GET /api/comics`
  - Returns full list of comics sorted by `-created`.
- `GET /api/comics/:id`
  - Returns the comic and its chapters.
  - Each chapter includes `cbz` as a downloadable/renderable URL:
    - `pb.files.getURL(chapter, chapter.cbz_url)` when `cbz_url` exists.
- `GET /api/genres`
  - Builds a genre → comics map from `comic.genre` (comma-separated).
- `GET /api/nav`
  - Loads `functions/data/nav.json`.
- `GET /api/footer`
  - Loads `functions/data/footer.json`.

### Admins (authenticated)

Admin auth is checked by `requireAdmin()`:

- If the PocketBase client token is valid OR
- `req.session.isAdmin` is set.

Routes:

- `GET /api/admin/comics?from=&to=` – paginated list
- `GET /api/admin/comics/:id` – comic + chapters
- `POST /api/admin/comics` – create/update comic metadata (upsert)
- `POST /api/admin/comics/:id/cover`
  - `multipart/form-data` with field name `cover`
  - Uploads the cover file to PocketBase and saves `cover_url`.
- `POST /api/admin/chapters/upload`
  - `multipart/form-data` with:
    - `comic_id` (string)
    - `chapters` (array of uploaded `.cbz` files; up to 50 per request)
    - optional `chaptersMeta` JSON to explicitly map filenames → `{ chapterId, title }`
  - Creates chapter records and returns per-file results.
- `DELETE /api/admin/comics/:id`
  - Deletes chapters first, then deletes the comic record.
- `DELETE /api/admin/comics/:comicId/chapters/:chapterId`
  - Deletes a chapter.

Auth endpoints:

- `POST /api/admin/login`
  - Expects JSON: `{ email, password }`
  - Stores session and returns success.
- `POST /api/admin/logout`
- `GET /api/admin/session`
  - For frontend session checks.

Admin page routes:

- `GET /admin` (protected)
- `GET /admin-login`

---

## Admin workflow (high level)

1. **Login** at `/admin-login`.
2. **Create/Update comic metadata**:
   - Fill fields in the UI or load the XML template.
   - Save via `POST /api/admin/comics`.
3. **Upload cover**:
   - Select an image and upload it.
   - Server updates `cover_url`.
4. **Batch upload chapters**:
   - Provide `comic_id` and upload multiple `.cbz` files.
   - If you don’t provide `chaptersMeta`, the server tries to infer `chapterId` from the first number found in each filename.
   - Upload triggers `POST /api/admin/chapters/upload`.

---

## CBZ handling

- CBZ files are uploaded as part of chapter creation.
- The app stores a reference in PocketBase (field usage in code: `cbz_url` and/or `cbz_file`).
- The reader frontend fetches the chapter payload and uses `jszip` to render the CBZ contents in the browser.

---

## Notes / troubleshooting

- If featured comics don’t load, confirm:
  - `/api/comics` returns data.
  - Your PocketBase `comics` collection exists and has `cover_url` or `cover` uploaded.
- If admin actions fail:
  - Ensure the admin user exists in PocketBase `admins` collection.
  - Confirm the admin record is `active`.
- If uploads fail:
  - Verify field names match what the server expects (`cover`, `chapters`).

---

## License

Not specified in the repository. Add a LICENSE file if you want to publish permissions clearly.
