# ECOWAS Statistics Meeting website

A responsive full-stack website inspired by the supplied design for the Directors General of Statistics Annual Meeting, 16–20 November 2026, Monrovia, Liberia.

## Stack
- Front end: HTML, CSS, vanilla JavaScript
- Back end: Node.js + Express REST API
- Storage: JSON database file (`data/database.json`) and uploaded files in `uploads/`

## Requirements
- Node.js 18 or newer
- npm

## Run locally
```bash
npm install
npm start
```
Open http://localhost:3000

For development with automatic server restarts:
```bash
npm run dev
```

## Features
- Responsive event landing page
- Participant registration with email validation and duplicate-email protection
- Agenda and news API endpoints
- Document uploads (10 MB max; PDF, Office, CSV, and common image files)
- Document listing and download
- Rate limiting and Helmet security headers
- Optional token-protected admin API

## API
- `GET /api/health` — service status
- `GET /api/agenda` — agenda items
- `GET /api/news` — announcements
- `GET /api/documents` — public document list
- `POST /api/register` — register a participant (`fullName`, `email`, `organization`, `country`)
- `POST /api/upload` — multipart upload with field name `file`
- `GET /api/documents/:id/download` — download a file

### Optional admin endpoints
Set an environment variable before starting the server:
```bash
# macOS/Linux
ADMIN_TOKEN="replace-with-a-long-random-secret" npm start

# PowerShell
$env:ADMIN_TOKEN="replace-with-a-long-random-secret"; npm start
```
Then send the token as `x-admin-token`:
- `GET /api/admin/registrations`
- `POST /api/admin/agenda` with JSON `{ "day": "Day 1", "time": "09:00", "title": "Opening session", "description": "Welcome and introductions" }`
- `POST /api/admin/news` with JSON `{ "title": "Announcement", "body": "Details..." }`

Example:
```bash
curl http://localhost:3000/api/admin/registrations -H "x-admin-token: YOUR_SECRET"
```

## Production notes
This is a functional starter project, not an officially endorsed ECOWAS system. Before production deployment:
1. Replace the illustrative logo and stock photography with approved assets.
2. Configure HTTPS and secure hosting.
3. Use a managed database (PostgreSQL/MySQL) rather than JSON storage for multiple server instances.
4. Restrict uploads to authenticated organizers and scan uploaded files for malware.
5. Add organizer consent/privacy notices and retention rules for personal data.
6. Set a strong `ADMIN_TOKEN` in the hosting environment; never hard-code secrets.
7. Confirm venue details and the official event agenda with the organizers.
