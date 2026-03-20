Freelancer HR CRM

This build is ready for Render + Supabase.

Production stack:
- Flask UI on Render
- Supabase Postgres for live data

What changed:
- login reads from database, not hardcoded local users
- candidate/profile updates are database-driven
- candidates page has compact actions + batch dialer
- profile opening issue fixed from candidates table
- Add Profile removed from sidebar and kept as a small top button on Candidates
- premium font + higher contrast theme cleanup

Use:
1) Run SQL from 3_SUPABASE
2) Put 2_GITHUB_UPLOAD on GitHub
3) Add DATABASE_URL + SECRET_KEY on Render
4) Redeploy
