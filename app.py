
import csv
import os
import sqlite3
from collections import defaultdict
from contextlib import closing
from datetime import datetime, timedelta
from functools import wraps
from pathlib import Path
from uuid import uuid4

from flask import Flask, flash, g, jsonify, redirect, render_template, request, send_file, session, url_for
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
STATIC_DIR = BASE_DIR / "static"
UPLOAD_DIR = STATIC_DIR / "uploads"
REPORT_DIR = DATA_DIR / "reports"

for folder in (DATA_DIR, STATIC_DIR, UPLOAD_DIR, REPORT_DIR):
    folder.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "career_crox_lite.db"

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "career-crox-lite-dev-secret")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024


# ---------- generic helpers ----------
def now():
    return datetime.now()


def now_str():
    return now().strftime("%Y-%m-%d %H:%M:%S")


def today_str():
    return now().strftime("%Y-%m-%d")


def dt_to_input(value):
    if not value:
        return ""
    value = value.replace(" ", "T")
    return value[:16]


def get_db():
    if "db" not in g:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def teardown_db(exc=None):
    db = g.pop("db", None)
    if db:
        db.close()


def q_all(sql, params=()):
    return get_db().execute(sql, params).fetchall()


def q_one(sql, params=()):
    return get_db().execute(sql, params).fetchone()


def execute(sql, params=()):
    db = get_db()
    cur = db.execute(sql, params)
    db.commit()
    return cur


def execute_many(sql, rows):
    db = get_db()
    db.executemany(sql, rows)
    db.commit()


def safe_int(value, default=0):
    try:
        return int(float(value))
    except Exception:
        return default


def create_notification(user_code, title, message, kind="info"):
    execute(
        """
        insert into notifications (user_code, title, message, kind, is_read, created_at)
        values (?, ?, ?, ?, 0, ?)
        """,
        (user_code, title, message, kind, now_str()),
    )


def recruiter_only_filter(table_alias=""):
    prefix = f"{table_alias}." if table_alias else ""
    if session.get("role") == "recruiter":
        return f" where {prefix}recruiter_code=? ", [session.get("user_code")]
    return "", []


def current_user():
    code = session.get("user_code")
    if not code:
        return None
    return q_one("select * from users where user_code=?", (code,))


def login_required(fn):
    @wraps(fn)
    def wrapped(*args, **kwargs):
        if not session.get("user_code"):
            return redirect(url_for("login"))
        return fn(*args, **kwargs)
    return wrapped


def roles_required(*roles):
    def deco(fn):
        @wraps(fn)
        def wrapped(*args, **kwargs):
            if session.get("role") not in roles:
                flash("Access denied.", "error")
                return redirect(url_for("dashboard"))
            return fn(*args, **kwargs)
        return wrapped
    return deco


def is_recruiter():
    return session.get("role") == "recruiter"


def is_leader():
    return session.get("role") in ("manager", "tl")


# ---------- database + seed ----------
def bootstrap():
    with closing(sqlite3.connect(DB_PATH)) as db:
        with open(BASE_DIR / "schema.sql", "r", encoding="utf-8") as f:
            db.executescript(f.read())
        cur = db.cursor()
        count = cur.execute("select count(*) from users").fetchone()[0]
        if count:
            db.commit()
            return

        # seed users
        users = [
            ("MGR001", "Aaryansh Manager", "manager", "1234", "manager@careercrox.local", 1, 1, now_str()),
            ("TL001", "Ritika TL", "tl", "1234", "tl@careercrox.local", 1, 1, now_str()),
            ("RC201", "Arjun Recruiter", "recruiter", "1234", "arjun@careercrox.local", 1, 1, now_str()),
            ("RC202", "Rabia Recruiter", "recruiter", "1234", "rabia@careercrox.local", 1, 1, now_str()),
            ("RC203", "Tahseen Recruiter", "recruiter", "1234", "tahseen@careercrox.local", 1, 1, now_str()),
            ("RC204", "Pragya Recruiter", "recruiter", "1234", "pragya@careercrox.local", 1, 1, now_str()),
        ]
        cur.executemany(
            """
            insert into users (user_code, full_name, role, password, email, is_active, is_visible, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            users,
        )

        masters = [
            ("location", "Noida", "active", "system", now_str()),
            ("location", "Gurgaon", "active", "system", now_str()),
            ("location", "Mumbai", "active", "system", now_str()),
            ("location", "Bangalore", "active", "system", now_str()),
            ("location", "Chennai", "active", "system", now_str()),
            ("location", "Pune", "active", "system", now_str()),
            ("qualification", "HSC", "active", "system", now_str()),
            ("qualification", "Graduate", "active", "system", now_str()),
            ("degree", "Non-Graduate", "active", "system", now_str()),
            ("degree", "Graduation", "active", "system", now_str()),
            ("career_gap", "0", "active", "system", now_str()),
            ("career_gap", "1-6 months", "active", "system", now_str()),
            ("career_gap", "6+ months", "active", "system", now_str()),
            ("process", "Customer Support", "active", "system", now_str()),
            ("process", "Blended Process", "active", "system", now_str()),
            ("process", "Sales", "active", "system", now_str()),
            ("process", "Chat Process", "active", "system", now_str()),
            ("interview_availability", "Immediate", "active", "system", now_str()),
            ("interview_availability", "Today Evening", "active", "system", now_str()),
            ("interview_availability", "Tomorrow", "active", "system", now_str()),
            ("call_connected", "Yes", "active", "system", now_str()),
            ("call_connected", "No", "active", "system", now_str()),
            ("call_connected", "Partially", "active", "system", now_str()),
        ]
        cur.executemany(
            "insert into master_options (category, value, status, created_by, created_at) values (?,?,?,?,?)",
            masters,
        )

        # seed profiles
        profiles = [
            ("RC201", "Arjun Recruiter", "Priya Sharma", "9999911111", "priya@mail.com", "Graduate", "Noida", "Noida", "Graduation", "Customer Support", "2", "2", "22000", "28000", "0", "Yes", "Yes", "Tomorrow", "Good communication", "saved", "approved", today_str(), "2026-03-19 10:00:00", "2026-03-19 10:00:00"),
            ("RC201", "Arjun Recruiter", "Vikas Yadav", "9999922222", "vikas@mail.com", "Graduate", "Gurgaon", "Mumbai", "Graduation", "Blended Process", "1", "1", "18000", "22000", "0", "Yes", "Yes", "Immediate", "Draft and pending check", "submitted", "pending_approval", today_str(), "2026-03-19 10:20:00", "2026-03-19 10:20:00"),
            ("RC202", "Rabia Recruiter", "Sana Khan", "9999933333", "sana@mail.com", "Graduate", "Delhi", "Gurgaon", "Graduation", "Sales", "3", "3", "25000", "32000", "0", "Yes", "Yes", "Today Evening", "Experienced and clear", "submitted", "approved", today_str(), "2026-03-19 11:00:00", "2026-03-19 11:00:00"),
            ("RC203", "Tahseen Recruiter", "Karan Gupta", "9999944444", "karan@mail.com", "HSC", "Thane", "Mumbai", "Non-Graduate", "Chat Process", "1", "1", "16000", "19000", "1-6 months", "Partially", "Yes", "Tomorrow", "Can work blended", "saved", "approved", today_str(), "2026-03-19 12:05:00", "2026-03-19 12:05:00"),
            ("RC204", "Pragya Recruiter", "Not Interested Lead", "9999955555", "", "", "", "", "", "", "", "", "", "", "", "No", "No", "", "Candidate not looking for job", "saved", "saved", today_str(), "2026-03-19 12:35:00", "2026-03-19 12:35:00"),
        ]
        cur.executemany(
            """
            insert into profiles (
                recruiter_code, recruiter_name, candidate_name, phone, email, qualification, location,
                preferred_location, degree, process, total_experience, relevant_experience,
                inhand_monthly, ctc_monthly, career_gap, call_connected, job_interest,
                interview_availability, notes, draft_status, workflow_status, submission_date,
                created_at, updated_at
            ) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            profiles,
        )

        rows = cur.execute("select id, recruiter_code, recruiter_name, candidate_name, workflow_status from profiles").fetchall()
        for rid, rc, rn, cn, wf in rows:
            if wf in ("pending_approval", "approved"):
                cur.execute(
                    """
                    insert into submissions (profile_id, recruiter_code, recruiter_name, submitted_at, status)
                    values (?, ?, ?, ?, ?)
                    """,
                    (rid, rc, rn, now_str(), wf),
                )

        interviews = [
            (1, "RC201", "Arjun Recruiter", "Priya Sharma", (now() + timedelta(hours=4)).strftime("%Y-%m-%d %H:%M:%S"), "HR Round", "scheduled", "Noida", now_str()),
            (2, "RC201", "Arjun Recruiter", "Vikas Yadav", (now() + timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S"), "Ops Round", "scheduled", "Google Meet", now_str()),
            (3, "RC202", "Rabia Recruiter", "Sana Khan", (now() - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"), "Final", "due", "Gurgaon", now_str()),
        ]
        cur.executemany(
            """
            insert into interviews (
                profile_id, recruiter_code, recruiter_name, candidate_name, interview_at, stage, status, location, created_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            interviews,
        )

        task_rows = [
            ("RC201", "TL001", "Quality check", "Please update interview availability for 2 pending candidates.", "open", now_str()),
            ("RC202", "RC201", "Call follow-up", "Need one backup profile for blended process.", "pending", now_str()),
            ("RC203", "MGR001", "Recording upload", "Upload candidate intro recording before EOD.", "open", now_str()),
        ]
        cur.executemany(
            """
            insert into tasks (assigned_to, assigned_by, title, details, status, created_at)
            values (?, ?, ?, ?, ?, ?)
            """,
            task_rows,
        )

        notes = [
            (1, "RC201", "Profile looks solid. Keep this one ready.", now_str()),
            (1, "TL001", "Interview timing shared with candidate.", now_str()),
            (3, "MGR001", "Good profile for quick movement.", now_str()),
        ]
        cur.executemany(
            "insert into profile_notes (profile_id, added_by, note_text, created_at) values (?, ?, ?, ?)",
            notes,
        )

        call_logs = [
            ("RC201", "Arjun Recruiter", today_str(), "09:15:00", 18, 9, 47, now_str()),
            ("RC202", "Rabia Recruiter", today_str(), "10:10:00", 12, 6, 31, now_str()),
            ("RC203", "Tahseen Recruiter", today_str(), "11:05:00", 15, 7, 36, now_str()),
            ("RC204", "Pragya Recruiter", today_str(), "11:40:00", 8, 3, 19, now_str()),
        ]
        cur.executemany(
            """
            insert into call_logs (recruiter_code, recruiter_name, call_date, call_time, total_calls, connected_calls, talktime_minutes, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            call_logs,
        )

        breaks = [
            ("RC201", "Arjun Recruiter", today_str(), "Tea Break", "15:00", 1, 12, now_str()),
            ("RC202", "Rabia Recruiter", today_str(), "Lunch", "13:30", 1, 28, now_str()),
            ("RC203", "Tahseen Recruiter", today_str(), "Short Break", "16:20", 2, 19, now_str()),
        ]
        cur.executemany(
            """
            insert into attendance_breaks (user_code, user_name, attendance_date, break_type, break_time, break_count, break_minutes, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            breaks,
        )

        report_settings = [
            ("TL001", 30, 1, now_str()),
            ("MGR001", 30, 1, now_str()),
            ("RC201", 1440, 1, now_str()),
            ("RC202", 1440, 1, now_str()),
            ("RC203", 1440, 1, now_str()),
            ("RC204", 1440, 1, now_str()),
        ]
        cur.executemany(
            "insert into report_settings (user_code, every_minutes, is_enabled, updated_at) values (?, ?, ?, ?)",
            report_settings,
        )

        seeds_notify = [
            ("TL001", "Approval pending", "One submitted profile is waiting for approval.", "warning", 0, now_str()),
            ("MGR001", "Team report ready", "Daily team summary can be generated from reports.", "info", 0, now_str()),
            ("RC201", "Task assigned", "A new task has been assigned to you.", "info", 0, now_str()),
            ("RC202", "Interview due", "One interview is due for follow-up.", "warning", 0, now_str()),
        ]
        cur.executemany(
            "insert into notifications (user_code, title, message, kind, is_read, created_at) values (?, ?, ?, ?, ?, ?)",
            seeds_notify,
        )

        db.commit()


# ---------- master options ----------
def get_master_values(category, include_pending=False):
    sql = "select * from master_options where category=?"
    params = [category]
    if not include_pending:
        sql += " and status='active'"
    sql += " order by value"
    return q_all(sql, params)


def maybe_add_master_option(category, new_value, created_by):
    new_value = (new_value or "").strip()
    if not new_value:
        return None
    existing = q_one(
        "select * from master_options where lower(category)=lower(?) and lower(value)=lower(?)",
        (category, new_value),
    )
    if existing:
        return existing["value"]

    status = "active" if session.get("role") in ("manager", "tl") else "pending"
    execute(
        """
        insert into master_options (category, value, status, created_by, created_at)
        values (?, ?, ?, ?, ?)
        """,
        (category, new_value, status, created_by, now_str()),
    )
    if status == "pending":
        for code in [r["user_code"] for r in q_all("select user_code from users where role in ('manager','tl')")]:
            create_notification(code, "Master option approval", f"New {category} option '{new_value}' needs approval.", "warning")
    return new_value


# ---------- profile helpers ----------
MANDATORY_INTERESTED_FIELDS = [
    "qualification",
    "location",
    "preferred_location",
    "degree",
    "process",
    "interview_availability",
]


def build_profile_payload(form, files=None):
    user = current_user()
    recruiter_code = user["user_code"]
    recruiter_name = user["full_name"]

    payload = {
        "recruiter_code": recruiter_code,
        "recruiter_name": recruiter_name,
        "candidate_name": form.get("candidate_name", "").strip(),
        "phone": form.get("phone", "").strip(),
        "email": form.get("email", "").strip(),
        "qualification": form.get("qualification", "").strip(),
        "location": form.get("location", "").strip(),
        "preferred_location": form.get("preferred_location", "").strip(),
        "degree": form.get("degree", "").strip(),
        "process": form.get("process", "").strip(),
        "total_experience": form.get("total_experience", "").strip(),
        "relevant_experience": form.get("relevant_experience", "").strip(),
        "inhand_monthly": form.get("inhand_monthly", "").strip(),
        "ctc_monthly": form.get("ctc_monthly", "").strip(),
        "career_gap": form.get("career_gap", "").strip(),
        "call_connected": form.get("call_connected", "").strip(),
        "job_interest": form.get("job_interest", "").strip(),
        "interview_availability": form.get("interview_availability", "").strip(),
        "notes": form.get("notes", "").strip(),
        "submission_date": form.get("submission_date", today_str()).strip() or today_str(),
    }

    # inline add-new fields
    for category, field in [
        ("location", "location"),
        ("location", "preferred_location"),
        ("process", "process"),
        ("qualification", "qualification"),
        ("degree", "degree"),
        ("career_gap", "career_gap"),
        ("interview_availability", "interview_availability"),
    ]:
        new_value = form.get(f"{field}_new", "").strip()
        if new_value:
            payload[field] = maybe_add_master_option(category, new_value, recruiter_code)

    if payload["job_interest"] in ("Yes", "Interested", "yes", "interested"):
        missing = []
        if not payload["candidate_name"]:
            missing.append("Candidate Name")
        for key in MANDATORY_INTERESTED_FIELDS:
            if not payload.get(key):
                missing.append(key.replace("_", " ").title())
        if missing:
            raise ValueError("Interested profile में ये fields जरूरी हैं: " + ", ".join(missing))
    else:
        if not payload["candidate_name"]:
            payload["candidate_name"] = "Untitled Lead"

    # derived ranges
    rel_exp = safe_int(payload["relevant_experience"])
    if rel_exp <= 0:
        payload["relevant_experience_range"] = "0"
    elif rel_exp <= 1:
        payload["relevant_experience_range"] = "0-1 year"
    elif rel_exp <= 3:
        payload["relevant_experience_range"] = "1-3 years"
    else:
        payload["relevant_experience_range"] = "3+ years"

    inhand = safe_int(payload["inhand_monthly"])
    if inhand <= 0:
        payload["relevant_inhand_range"] = "0"
    elif inhand <= 15000:
        payload["relevant_inhand_range"] = "Up to 15k"
    elif inhand <= 25000:
        payload["relevant_inhand_range"] = "15k-25k"
    else:
        payload["relevant_inhand_range"] = "25k+"

    resume = request.files.get("resume_file")
    recording = request.files.get("recording_file")
    resume_name = ""
    recording_name = ""

    if resume and resume.filename:
        resume_name = f"{uuid4().hex}_{secure_filename(resume.filename)}"
        resume.save(UPLOAD_DIR / resume_name)
    if recording and recording.filename:
        recording_name = f"{uuid4().hex}_{secure_filename(recording.filename)}"
        recording.save(UPLOAD_DIR / recording_name)

    payload["resume_file"] = resume_name
    payload["recording_file"] = recording_name
    return payload


def save_profile(payload, profile_id=None, action="save"):
    draft_status = "saved"
    workflow_status = "saved"

    if action == "submit":
        draft_status = "submitted"
        workflow_status = "pending_approval"

    cols = [
        "recruiter_code", "recruiter_name", "candidate_name", "phone", "email", "qualification", "location",
        "preferred_location", "degree", "process", "total_experience", "relevant_experience",
        "inhand_monthly", "ctc_monthly", "career_gap", "call_connected", "job_interest",
        "interview_availability", "notes", "submission_date", "resume_file", "recording_file",
        "relevant_experience_range", "relevant_inhand_range"
    ]

    values = [payload.get(c, "") for c in cols]

    if profile_id:
        old = q_one("select * from profiles where id=?", (profile_id,))
        if not old:
            raise ValueError("Profile not found.")
        if is_recruiter() and old["recruiter_code"] != session.get("user_code"):
            raise ValueError("Access denied.")
        keep_resume = old["resume_file"] if not payload["resume_file"] else payload["resume_file"]
        keep_recording = old["recording_file"] if not payload["recording_file"] else payload["recording_file"]
        update_values = [
            payload["recruiter_code"], payload["recruiter_name"], payload["candidate_name"], payload["phone"], payload["email"],
            payload["qualification"], payload["location"], payload["preferred_location"], payload["degree"], payload["process"],
            payload["total_experience"], payload["relevant_experience"], payload["inhand_monthly"], payload["ctc_monthly"],
            payload["career_gap"], payload["call_connected"], payload["job_interest"], payload["interview_availability"],
            payload["notes"], payload.get("submission_date",""), keep_resume, keep_recording,
            payload["relevant_experience_range"], payload["relevant_inhand_range"], draft_status, now_str(), profile_id,
        ]
        execute(
            """
            update profiles set
                recruiter_code=?, recruiter_name=?, candidate_name=?, phone=?, email=?, qualification=?, location=?,
                preferred_location=?, degree=?, process=?, total_experience=?, relevant_experience=?,
                inhand_monthly=?, ctc_monthly=?, career_gap=?, call_connected=?, job_interest=?,
                interview_availability=?, notes=?, submission_date=?, resume_file=?, recording_file=?,
                relevant_experience_range=?, relevant_inhand_range=?, draft_status=?, updated_at=?
            where id=?
            """,
            update_values,
        )
        if action == "submit":
            execute("update profiles set workflow_status='pending_approval' where id=?", (profile_id,))
            _add_submission(profile_id, old["recruiter_code"], old["recruiter_name"], "pending_approval")
        return profile_id

    cur = execute(
        f"""
        insert into profiles (
            recruiter_code, recruiter_name, candidate_name, phone, email, qualification, location,
            preferred_location, degree, process, total_experience, relevant_experience,
            inhand_monthly, ctc_monthly, career_gap, call_connected, job_interest,
            interview_availability, notes, submission_date, resume_file, recording_file,
            relevant_experience_range, relevant_inhand_range, draft_status, workflow_status,
            created_at, updated_at
        ) values ({",".join(["?"] * 28)})
        """,
        values + [draft_status, workflow_status, now_str(), now_str()],
    )
    profile_id = cur.lastrowid
    if action == "submit":
        _add_submission(profile_id, payload["recruiter_code"], payload["recruiter_name"], "pending_approval")
    return profile_id


def _add_submission(profile_id, recruiter_code, recruiter_name, status):
    execute(
        """
        insert into submissions (profile_id, recruiter_code, recruiter_name, submitted_at, status)
        values (?, ?, ?, ?, ?)
        """,
        (profile_id, recruiter_code, recruiter_name, now_str(), status),
    )
    leaders = q_all("select user_code from users where role in ('manager','tl')")
    for row in leaders:
        create_notification(row["user_code"], "Profile submitted for approval", f"{recruiter_name} submitted a profile for approval.", "warning")


def can_access_profile(profile):
    if not profile:
        return False
    return is_leader() or profile["recruiter_code"] == session.get("user_code")


# ---------- reporting ----------
def get_recruiter_rows():
    return q_all("select * from users where role='recruiter' and is_active=1 order by full_name")


def build_metrics_for_user(user_code):
    user = q_one("select * from users where user_code=?", (user_code,))
    if not user:
        return {}
    profiles_total = q_one("select count(*) c from profiles where recruiter_code=?", (user_code,))["c"]
    submissions_total = q_one("select count(*) c from submissions where recruiter_code=?", (user_code,))["c"]
    approvals_pending = q_one("select count(*) c from profiles where recruiter_code=? and workflow_status='pending_approval'", (user_code,))["c"]
    interviews_total = q_one("select count(*) c from interviews where recruiter_code=?", (user_code,))["c"]
    calls_row = q_one("select coalesce(sum(total_calls),0) total_calls, coalesce(sum(connected_calls),0) connected_calls, coalesce(sum(talktime_minutes),0) talktime from call_logs where recruiter_code=?", (user_code,))
    open_tasks = q_one("select count(*) c from tasks where assigned_to=? and status in ('open','pending')", (user_code,))["c"]
    updates_logged = q_one("select count(*) c from profile_notes where added_by=?", (user_code,))["c"]
    breaks_row = q_one("select coalesce(sum(break_count),0) c, coalesce(sum(break_minutes),0) m from attendance_breaks where user_code=?", (user_code,))
    last_seen = q_one("select max(created_at) seen from call_logs where recruiter_code=?", (user_code,))["seen"] or q_one("select max(updated_at) seen from profiles where recruiter_code=?", (user_code,))["seen"]

    score = submissions_total * 5 + interviews_total * 3 + calls_row["connected_calls"] * 2 + updates_logged
    return {
        "user_code": user_code,
        "full_name": user["full_name"],
        "designation": user["role"].title() if user["role"] != "tl" else "Team Lead",
        "candidates": profiles_total,
        "submissions": submissions_total,
        "pending_approvals": approvals_pending,
        "calls": calls_row["total_calls"],
        "connected_calls": calls_row["connected_calls"],
        "talktime": calls_row["talktime"],
        "updates": updates_logged,
        "interviews": interviews_total,
        "open_tasks": open_tasks,
        "break_count": breaks_row["c"],
        "break_minutes": breaks_row["m"],
        "last_seen": last_seen or "-",
        "state": "Active" if user["is_active"] else "Inactive",
        "score": score,
        "billed_visibility": max(0, submissions_total * 1000),
    }


def team_metrics(filter_code=None):
    if is_recruiter():
        return [build_metrics_for_user(session["user_code"])]
    codes = [r["user_code"] for r in q_all("select user_code from users where role in ('recruiter','tl') order by role desc, full_name")]
    if filter_code and filter_code != "all":
        codes = [c for c in codes if c == filter_code]
    return [build_metrics_for_user(code) for code in codes]


def save_generated_report(owner_user_code, target_user_code="all", report_type="team"):
    metrics = team_metrics(None if target_user_code == "all" else target_user_code)
    report_date = today_str()
    top_name = "N/A"
    low_name = "N/A"
    if metrics:
        ordered = sorted(metrics, key=lambda x: x["score"], reverse=True)
        top_name = ordered[0]["full_name"]
        low_name = ordered[-1]["full_name"]

    total_profiles = sum(m["candidates"] for m in metrics)
    total_submissions = sum(m["submissions"] for m in metrics)
    total_interviews = sum(m["interviews"] for m in metrics)
    total_calls = sum(m["calls"] for m in metrics)

    report_json = {
        "rows": metrics,
        "top": top_name,
        "low": low_name,
        "total_profiles": total_profiles,
        "total_submissions": total_submissions,
        "total_interviews": total_interviews,
        "total_calls": total_calls,
    }
    execute(
        """
        insert into reports (
            owner_user_code, target_user_code, report_date, report_type, total_profiles,
            total_submissions, total_interviews, total_calls, top_performer, low_performer,
            report_json, created_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            owner_user_code, target_user_code, report_date, report_type, total_profiles,
            total_submissions, total_interviews, total_calls, top_name, low_name,
            json_dumps(report_json), now_str()
        ),
    )
    create_notification(owner_user_code, "Report generated", f"{report_type.title()} report for {report_date} is ready.", "success")


def json_dumps(data):
    import json
    return json.dumps(data, ensure_ascii=False)


def json_loads(data):
    import json
    try:
        return json.loads(data or "{}")
    except Exception:
        return {}


bootstrap()

# ---------- context ----------
@app.context_processor
def inject_globals():
    user = current_user()
    unread = 0
    if user:
        unread = q_one("select count(*) c from notifications where user_code=? and is_read=0", (user["user_code"],))["c"]
    return {
        "me": user,
        "today": today_str(),
        "unread_notifications": unread,
        "current_path": request.path,
    }


@app.route("/favicon.ico")
def favicon():
    return redirect(url_for("static", filename="img/career-crox-brand-icon.png"))


# ---------- auth ----------
@app.route("/", methods=["GET", "POST"])
def login():
    if session.get("user_code"):
        return redirect(url_for("dashboard"))
    if request.method == "POST":
        code = request.form.get("user_code", "").strip().upper()
        password = request.form.get("password", "").strip()
        user = q_one(
            "select * from users where user_code=? and password=? and is_active=1",
            (code, password),
        )
        if not user:
            flash("Invalid login details.", "error")
            return render_template("login.html")
        session["user_code"] = user["user_code"]
        session["full_name"] = user["full_name"]
        session["role"] = user["role"]
        return redirect(url_for("dashboard"))
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ---------- dashboard ----------
@app.route("/dashboard")
@login_required
def dashboard():
    user = current_user()
    if is_recruiter():
        where = " where recruiter_code=? "
        params = [user["user_code"]]
    else:
        where = ""
        params = []

    cards = {
        "profiles_today": q_one("select count(*) c from profiles " + where + (" and " if where else " where ") + "date(created_at)=date('now')", params)["c"],
        "total_profiles": q_one("select count(*) c from profiles " + where, params)["c"],
        "pending_approvals": q_one("select count(*) c from profiles " + (where + " and " if where else " where ") + "workflow_status='pending_approval'", params)["c"],
        "interviews_today": q_one("select count(*) c from interviews " + recruiter_only_filter("")[0].replace("recruiter_code", "recruiter_code") + (" and " if recruiter_only_filter("")[0] else " where ") + "date(interview_at)=date('now')", recruiter_only_filter("")[1])["c"],
        "open_tasks": q_one("select count(*) c from tasks where assigned_to=? and status in ('open','pending')", (user["user_code"],))["c"] if is_recruiter() else q_one("select count(*) c from tasks where status in ('open','pending')")["c"],
        "reports": q_one("select count(*) c from reports where owner_user_code=?", (user["user_code"],))["c"] if is_recruiter() else q_one("select count(*) c from reports")["c"],
    }
    recent_profiles = q_all("select * from profiles " + where + " order by id desc limit 6", params)
    recent_submissions = q_all("select * from submissions " + (" where recruiter_code=? " if is_recruiter() else "") + " order by id desc limit 6", (user["user_code"],) if is_recruiter() else ())
    notifications = q_all("select * from notifications where user_code=? order by id desc limit 6", (user["user_code"],))
    perf_rows = team_metrics(None if not is_recruiter() else user["user_code"])
    return render_template("dashboard.html", cards=cards, recent_profiles=recent_profiles, recent_submissions=recent_submissions, notifications=notifications, perf_rows=perf_rows)


# ---------- profiles ----------
@app.route("/profiles")
@login_required
def profiles():
    q = request.args.get("q", "").strip()
    filters = []
    params = []
    if is_recruiter():
        filters.append("recruiter_code=?")
        params.append(session["user_code"])

    if q:
        like = f"%{q}%"
        filters.append("(candidate_name like ? or recruiter_code like ? or phone like ? or email like ? or process like ? or cast(id as text) like ?)")
        params += [like, like, like, like, like, like]

    sql = "select * from profiles"
    if filters:
        sql += " where " + " and ".join(filters)
    sql += " order by id desc limit 100"
    rows = q_all(sql, params)
    return render_template("profiles.html", rows=rows, search=q)


@app.route("/profile/new", methods=["GET", "POST"])
@login_required
def profile_new():
    if request.method == "POST":
        action = request.form.get("action", "save")
        try:
            payload = build_profile_payload(request.form)
            profile_id = save_profile(payload, action=action)
            note = payload.get("notes", "").strip()
            if note:
                execute("insert into profile_notes (profile_id, added_by, note_text, created_at) values (?,?,?,?)", (profile_id, session["user_code"], note, now_str()))
            flash("Profile submitted for approval." if action == "submit" else "Profile saved.", "success")
            return redirect(url_for("profile_detail", profile_id=profile_id))
        except ValueError as e:
            flash(str(e), "error")
    return render_template("profile_form.html", profile=None, masters=_masters_bundle(), notes=[])


@app.route("/profile/<int:profile_id>", methods=["GET", "POST"])
@login_required
def profile_detail(profile_id):
    profile = q_one("select * from profiles where id=?", (profile_id,))
    if not can_access_profile(profile):
        flash("Access denied.", "error")
        return redirect(url_for("profiles"))

    if request.method == "POST":
        action = request.form.get("action", "save")
        try:
            payload = build_profile_payload(request.form)
            save_profile(payload, profile_id=profile_id, action=action)
            note = request.form.get("notes", "").strip()
            if note:
                execute("insert into profile_notes (profile_id, added_by, note_text, created_at) values (?,?,?,?)", (profile_id, session["user_code"], note, now_str()))
                if session["role"] in ("manager", "tl") and profile["recruiter_code"] != session["user_code"]:
                    create_notification(profile["recruiter_code"], "Profile updated", f"{session['full_name']} updated notes for {profile['candidate_name']}.", "info")
            flash("Profile updated.", "success")
            return redirect(url_for("profile_detail", profile_id=profile_id))
        except ValueError as e:
            flash(str(e), "error")

    notes = q_all("select * from profile_notes where profile_id=? order by id desc", (profile_id,))
    return render_template("profile_form.html", profile=profile, masters=_masters_bundle(), notes=notes)


@app.route("/approve-profile/<int:profile_id>/<decision>")
@login_required
@roles_required("manager", "tl")
def approve_profile(profile_id, decision):
    profile = q_one("select * from profiles where id=?", (profile_id,))
    if not profile:
        flash("Profile not found.", "error")
        return redirect(url_for("approvals"))
    if decision not in ("approved", "rejected", "rescheduled"):
        flash("Invalid action.", "error")
        return redirect(url_for("approvals"))

    execute("update profiles set workflow_status=?, updated_at=? where id=?", (decision, now_str(), profile_id))
    execute("update submissions set status=? where id=(select id from submissions where profile_id=? order by id desc limit 1)", (decision, profile_id))
    create_notification(profile["recruiter_code"], "Approval update", f"{profile['candidate_name']} profile {decision}.", "success" if decision == "approved" else "warning")
    flash(f"Profile {decision}.", "success")
    return redirect(url_for("approvals"))


@app.route("/approvals")
@login_required
@roles_required("manager", "tl")
def approvals():
    pending_profiles = q_all("select * from profiles where workflow_status='pending_approval' order by id desc")
    pending_masters = q_all("select * from master_options where status='pending' order by id desc")
    return render_template("approvals.html", pending_profiles=pending_profiles, pending_masters=pending_masters)


@app.route("/approve-master/<int:master_id>/<decision>")
@login_required
@roles_required("manager", "tl")
def approve_master(master_id, decision):
    new_status = "active" if decision == "approve" else "rejected"
    row = q_one("select * from master_options where id=?", (master_id,))
    if row:
        execute("update master_options set status=? where id=?", (new_status, master_id))
        create_notification(row["created_by"], "Master option update", f"{row['category']} option '{row['value']}' {new_status}.", "info")
    return redirect(url_for("approvals"))


def _masters_bundle():
    return {
        "locations": get_master_values("location"),
        "qualifications": get_master_values("qualification"),
        "degrees": get_master_values("degree"),
        "processes": get_master_values("process"),
        "career_gaps": get_master_values("career_gap"),
        "interview_availability": get_master_values("interview_availability"),
        "call_connected": get_master_values("call_connected"),
    }


# ---------- submissions ----------
@app.route("/submissions")
@login_required
def submissions():
    tab = request.args.get("tab", "all")
    filters = []
    params = []
    if is_recruiter():
        filters.append("s.recruiter_code=?")
        params.append(session["user_code"])
    if tab != "all":
        filters.append("s.status=?")
        params.append(tab)
    sql = """
        select s.*, p.candidate_name, p.phone, p.process, p.workflow_status
        from submissions s
        join profiles p on p.id=s.profile_id
    """
    if filters:
        sql += " where " + " and ".join(filters)
    sql += " order by s.id desc limit 120"
    rows = q_all(sql, params)
    return render_template("submissions.html", rows=rows, tab=tab)


# ---------- interviews ----------
@app.route("/interviews", methods=["GET", "POST"])
@login_required
def interviews():
    if request.method == "POST" and is_leader():
        profile_id = safe_int(request.form.get("profile_id"))
        profile = q_one("select * from profiles where id=?", (profile_id,))
        if profile:
            when = request.form.get("interview_at", "").replace("T", " ")
            if len(when) == 16:
                when += ":00"
            execute(
                """
                insert into interviews (profile_id, recruiter_code, recruiter_name, candidate_name, interview_at, stage, status, location, created_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    profile_id,
                    profile["recruiter_code"],
                    profile["recruiter_name"],
                    profile["candidate_name"],
                    when,
                    request.form.get("stage", "HR Round"),
                    "scheduled",
                    request.form.get("location", ""),
                    now_str(),
                ),
            )
            create_notification(profile["recruiter_code"], "Interview scheduled", f"{profile['candidate_name']} interview scheduled on {when}.", "success")
            flash("Interview scheduled.", "success")
        return redirect(url_for("interviews"))

    tab = request.args.get("tab", "today")
    filters = []
    params = []
    if is_recruiter():
        filters.append("i.recruiter_code=?")
        params.append(session["user_code"])
    if tab == "today":
        filters.append("date(i.interview_at)=date('now')")
    elif tab == "upcoming":
        filters.append("date(i.interview_at)>date('now')")
    elif tab == "due":
        filters.append("date(i.interview_at)<date('now') and i.status!='completed'")

    sql = """
        select i.*, p.phone, p.process, p.id as profile_id
        from interviews i
        join profiles p on p.id=i.profile_id
    """
    if filters:
        sql += " where " + " and ".join(filters)
    sql += " order by i.interview_at asc"
    rows = q_all(sql, params)
    selectable = q_all("select id, candidate_name, recruiter_code from profiles order by id desc limit 100") if is_leader() else []
    return render_template("interviews.html", rows=rows, tab=tab, selectable=selectable)


# ---------- tasks ----------
@app.route("/tasks", methods=["GET", "POST"])
@login_required
def tasks():
    if request.method == "POST":
        target_code = request.form.get("assigned_to", "").strip().upper()
        user = q_one("select * from users where user_code=?", (target_code,))
        if user:
            execute(
                """
                insert into tasks (assigned_to, assigned_by, title, details, status, created_at)
                values (?, ?, ?, ?, ?, ?)
                """,
                (
                    target_code,
                    session["user_code"],
                    request.form.get("title", "").strip(),
                    request.form.get("details", "").strip(),
                    request.form.get("status", "open"),
                    now_str(),
                ),
            )
            create_notification(target_code, "New task assigned", request.form.get("title", "Task assigned"), "info")
            flash("Task assigned.", "success")
        else:
            flash("Employee not found.", "error")
        return redirect(url_for("tasks"))

    q = request.args.get("q", "").strip()
    sql = """
        select t.*,
               u.full_name as target_name,
               a.full_name as assigned_by_name
        from tasks t
        left join users u on u.user_code=t.assigned_to
        left join users a on a.user_code=t.assigned_by
    """
    filters = []
    params = []
    if is_recruiter():
        filters.append("t.assigned_to=?")
        params.append(session["user_code"])
    if q:
        like = f"%{q}%"
        filters.append("(t.title like ? or t.details like ? or t.assigned_to like ? or u.full_name like ?)")
        params += [like, like, like, like]
    if filters:
        sql += " where " + " and ".join(filters)
    sql += " order by t.id desc limit 120"
    rows = q_all(sql, params)
    users = q_all("select user_code, full_name from users where is_active=1 and is_visible=1 order by full_name")
    return render_template("tasks.html", rows=rows, users=users, search=q)


# ---------- notifications ----------
@app.route("/notifications")
@login_required
def notifications():
    rows = q_all("select * from notifications where user_code=? order by id desc limit 120", (session["user_code"],))
    execute("update notifications set is_read=1 where user_code=?", (session["user_code"],))
    return render_template("notifications.html", rows=rows)


# ---------- attendance ----------
@app.route("/attendance", methods=["GET", "POST"])
@login_required
def attendance():
    if request.method == "POST":
        code = session["user_code"] if is_recruiter() else request.form.get("user_code", session["user_code"])
        name_row = q_one("select full_name from users where user_code=?", (code,))
        if name_row:
            execute(
                """
                insert into attendance_breaks (user_code, user_name, attendance_date, break_type, break_time, break_count, break_minutes, created_at)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    code,
                    name_row["full_name"],
                    request.form.get("attendance_date", today_str()),
                    request.form.get("break_type", "Break"),
                    request.form.get("break_time", ""),
                    safe_int(request.form.get("break_count", 1)),
                    safe_int(request.form.get("break_minutes", 0)),
                    now_str(),
                ),
            )
            flash("Break entry saved.", "success")
        return redirect(url_for("attendance"))

    metrics = team_metrics(None if not is_recruiter() else session["user_code"])
    rows = q_all(
        "select * from attendance_breaks " + ("where user_code=? " if is_recruiter() else "") + " order by id desc limit 120",
        (session["user_code"],) if is_recruiter() else (),
    )
    return render_template("attendance.html", metrics=metrics, rows=rows, users=q_all("select user_code, full_name from users where role='recruiter' order by full_name"))


# ---------- reports ----------
@app.route("/reports", methods=["GET", "POST"])
@login_required
def reports():
    if request.method == "POST":
        if request.form.get("form_type") == "schedule":
            every = safe_int(request.form.get("every_minutes", 30), 30)
            enabled = 1 if request.form.get("is_enabled") == "on" else 0
            existing = q_one("select id from report_settings where user_code=?", (session["user_code"],))
            if existing:
                execute("update report_settings set every_minutes=?, is_enabled=?, updated_at=? where user_code=?", (every, enabled, now_str(), session["user_code"]))
            else:
                execute("insert into report_settings (user_code, every_minutes, is_enabled, updated_at) values (?, ?, ?, ?)", (session["user_code"], every, enabled, now_str()))
            flash("Report schedule saved. Lite build में heavy auto-cron बंद रखा गया है, manual generate तेज़ रहेगा.", "success")
        else:
            target = request.form.get("target_user_code", "all")
            report_type = request.form.get("report_type", "team")
            if is_recruiter():
                target = session["user_code"]
                report_type = "personal"
            save_generated_report(session["user_code"], target, report_type)
            flash("Report generated.", "success")
        return redirect(url_for("reports"))

    role = session["role"]
    if is_recruiter():
        rows = q_all("select * from reports where owner_user_code=? or target_user_code=? order by id desc limit 50", (session["user_code"], session["user_code"]))
    else:
        rows = q_all("select * from reports order by id desc limit 120")
    settings = q_one("select * from report_settings where user_code=?", (session["user_code"],))
    users = q_all("select user_code, full_name from users where role='recruiter' order by full_name")
    return render_template("reports.html", rows=rows, settings=settings, users=users, role=role)


@app.route("/report/export/<int:report_id>/<fmt>")
@login_required
def export_report(report_id, fmt):
    row = q_one("select * from reports where id=?", (report_id,))
    if not row:
        flash("Report not found.", "error")
        return redirect(url_for("reports"))
    if is_recruiter() and row["owner_user_code"] != session["user_code"] and row["target_user_code"] != session["user_code"]:
        flash("Access denied.", "error")
        return redirect(url_for("reports"))

    payload = json_loads(row["report_json"])
    rows = payload.get("rows", [])
    file_base = REPORT_DIR / f"report_{report_id}_{fmt}"
    if fmt == "csv":
        path = str(file_base.with_suffix(".csv"))
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["Name", "Code", "Candidates", "Open Tasks", "Calls", "Updates", "Interviews", "Last Seen", "State", "Billed Visibility"])
            for item in rows:
                writer.writerow([item["full_name"], item["user_code"], item["candidates"], item["open_tasks"], item["calls"], item["updates"], item["interviews"], item["last_seen"], item["state"], item["billed_visibility"]])
        return send_file(path, as_attachment=True)

    if fmt == "excel":
        from openpyxl import Workbook
        path = str(file_base.with_suffix(".xlsx"))
        wb = Workbook()
        ws = wb.active
        ws.title = "Report"
        ws.append(["Name", "Code", "Candidates", "Open Tasks", "Calls", "Updates", "Interviews", "Last Seen", "State", "Billed Visibility"])
        for item in rows:
            ws.append([item["full_name"], item["user_code"], item["candidates"], item["open_tasks"], item["calls"], item["updates"], item["interviews"], item["last_seen"], item["state"], item["billed_visibility"]])
        wb.save(path)
        return send_file(path, as_attachment=True)

    flash("Unknown export format.", "error")
    return redirect(url_for("reports"))


# ---------- performance ----------
@app.route("/performance")
@login_required
def performance():
    filter_code = request.args.get("user_code", "all")
    rows = team_metrics(None if filter_code == "all" else filter_code)
    summary = {
        "calls_logged": sum(r["calls"] for r in rows),
        "updates_logged": sum(r["updates"] for r in rows),
        "interview_actions": sum(r["interviews"] for r in rows),
        "billed_visibility": sum(r["billed_visibility"] for r in rows),
    }
    ordered = sorted(rows, key=lambda x: x["score"], reverse=True)
    alerts = []
    if ordered:
        low = ordered[-1]
        if low["score"] <= 4:
            alerts.append(f"{low['full_name']} needs attention. Current score is low.")
    users = q_all("select user_code, full_name, role from users where role in ('recruiter','tl') order by role desc, full_name")
    return render_template("performance.html", rows=rows, summary=summary, alerts=alerts, users=users, selected_code=filter_code)


# ---------- dialer ----------
@app.route("/dialer")
@login_required
def dialer():
    q = request.args.get("q", "").strip()
    sql = "select * from profiles"
    params = []
    filters = []
    if is_recruiter():
        filters.append("recruiter_code=?")
        params.append(session["user_code"])
    if q:
        like = f"%{q}%"
        filters.append("(candidate_name like ? or phone like ? or process like ? or recruiter_code like ?)")
        params += [like, like, like, like]
    if filters:
        sql += " where " + " and ".join(filters)
    sql += " order by id desc limit 100"
    rows = q_all(sql, params)
    return render_template("dialer.html", rows=rows, search=q)


# ---------- APIs ----------
@app.route("/api/search-users")
@login_required
def search_users():
    q = request.args.get("q", "").strip()
    like = f"%{q}%"
    rows = q_all("select user_code, full_name, role from users where user_code like ? or full_name like ? order by full_name limit 12", (like, like))
    return jsonify([dict(r) for r in rows])


@app.route("/call/<phone>")
@login_required
def call_link(phone):
    cleaned = "".join(ch for ch in phone if ch.isdigit())
    return redirect(f"tel:+91{cleaned}")


@app.route("/whatsapp/<phone>/<candidate_name>")
@login_required
def whatsapp_link(phone, candidate_name):
    cleaned = "".join(ch for ch in phone if ch.isdigit())
    msg = f"Hello {candidate_name}, this is Career Crox regarding your profile."
    return redirect(f"https://wa.me/91{cleaned}?text={msg}")


if __name__ == "__main__":
    bootstrap()
    app.run(debug=True, host="0.0.0.0", port=5000)
