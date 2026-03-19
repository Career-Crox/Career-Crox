
# Career Crox - Freelancer HR CRM Lite

यह speed-first Flask CRM pack है.

## Demo login
- MGR001 / 1234
- TL001 / 1234
- RC201 / 1234

## Main features
- Recruiter only own data
- TL / Manager all data
- Save + Submit for Approval
- Submission tracker
- Today / Upcoming / Due interviews
- Dynamic master options with add new
- Tasks with notification
- Attendance & Break tracking
- Reports + schedule settings
- Performance Center
- Dialer actions
- Row click opens profile
- Select all in major tables

## Local run
```bash
pip install -r requirements.txt
python app.py
```

## Render deploy
- Root directory: this folder
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn app:app`

## Speed choices used in this lite pack
- No heavy live background polling
- No websocket / no large JS bundles
- Reports generated on demand
- Compact tables
- SQLite demo DB with indexes
- Only essential UI animations
