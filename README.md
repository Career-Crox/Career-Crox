# Career Crox CRM · React + Node + Supabase

This rebuild replaces the old Flask multi-page flow with a React single-page app and a Node.js API.

## What changed

- React frontend with client-side state, so actions do not reload the full page
- Express backend with secure HTTP-only cookie auth
- Supabase stays server-side through the service role key
- First-run bootstrap screen creates the first manager account instead of shipping demo users
- Built-in candidate import/export in Excel format
- Core modules included:
  - Dashboard
  - Candidates + notes + call/WhatsApp logging
  - Tasks
  - JD Centre
  - Interviews
  - Submissions
  - Team management
  - Notifications
  - Activity log
  - Settings

## Required environment variables

Copy `.env.example` to `.env` and fill these values:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- optional: `PORT`, `APP_URL`, `CORS_ORIGIN`

## Local run

```bash
npm install
npm run build
npm start
```

Open `http://localhost:10000`

## Supabase setup

1. Create a new Supabase project
2. Run `docs/SUPABASE_SCHEMA.sql` in the SQL editor
3. Add your environment variables
4. Start the app
5. Create the first manager account from the first-run setup screen

## Render deployment

This repo is designed for a single Render Web Service.

- Build command: `npm install && npm run build`
- Start command: `npm start`

A sample `render.yaml` is included.

## Notes

- Do **not** expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code
- User passwords are stored as bcrypt hashes by the Node API
- Legacy plain-text passwords from older tables are auto-upgraded to bcrypt on first successful login
