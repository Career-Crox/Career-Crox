
create table if not exists users (
    id integer primary key autoincrement,
    user_code text unique not null,
    full_name text not null,
    role text not null,
    password text not null,
    email text,
    is_active integer default 1,
    is_visible integer default 1,
    created_at text not null
);

create table if not exists master_options (
    id integer primary key autoincrement,
    category text not null,
    value text not null,
    status text default 'active',
    created_by text,
    created_at text not null
);

create index if not exists idx_master_cat_status on master_options(category, status);

create table if not exists profiles (
    id integer primary key autoincrement,
    recruiter_code text not null,
    recruiter_name text not null,
    candidate_name text not null,
    phone text,
    email text,
    qualification text,
    location text,
    preferred_location text,
    degree text,
    process text,
    total_experience text,
    relevant_experience text,
    inhand_monthly text,
    ctc_monthly text,
    career_gap text,
    call_connected text,
    job_interest text,
    interview_availability text,
    notes text,
    draft_status text default 'saved',
    workflow_status text default 'saved',
    submission_date text,
    resume_file text,
    recording_file text,
    relevant_experience_range text,
    relevant_inhand_range text,
    created_at text not null,
    updated_at text not null
);

create index if not exists idx_profiles_recruiter on profiles(recruiter_code);
create index if not exists idx_profiles_workflow on profiles(workflow_status);
create index if not exists idx_profiles_created on profiles(created_at);

create table if not exists profile_notes (
    id integer primary key autoincrement,
    profile_id integer not null,
    added_by text not null,
    note_text text not null,
    created_at text not null
);

create index if not exists idx_profile_notes_profile on profile_notes(profile_id);

create table if not exists submissions (
    id integer primary key autoincrement,
    profile_id integer not null,
    recruiter_code text not null,
    recruiter_name text not null,
    submitted_at text not null,
    status text not null
);

create index if not exists idx_submissions_recruiter on submissions(recruiter_code, submitted_at);

create table if not exists interviews (
    id integer primary key autoincrement,
    profile_id integer not null,
    recruiter_code text not null,
    recruiter_name text not null,
    candidate_name text not null,
    interview_at text not null,
    stage text,
    status text,
    location text,
    created_at text not null
);

create index if not exists idx_interviews_recruiter on interviews(recruiter_code, interview_at);

create table if not exists tasks (
    id integer primary key autoincrement,
    assigned_to text not null,
    assigned_by text not null,
    title text not null,
    details text,
    status text default 'open',
    created_at text not null
);

create index if not exists idx_tasks_assigned on tasks(assigned_to, status);

create table if not exists notifications (
    id integer primary key autoincrement,
    user_code text not null,
    title text not null,
    message text not null,
    kind text default 'info',
    is_read integer default 0,
    created_at text not null
);

create index if not exists idx_notifications_user on notifications(user_code, is_read);

create table if not exists call_logs (
    id integer primary key autoincrement,
    recruiter_code text not null,
    recruiter_name text not null,
    call_date text not null,
    call_time text,
    total_calls integer default 0,
    connected_calls integer default 0,
    talktime_minutes integer default 0,
    created_at text not null
);

create index if not exists idx_call_logs_recruiter on call_logs(recruiter_code, call_date);

create table if not exists attendance_breaks (
    id integer primary key autoincrement,
    user_code text not null,
    user_name text not null,
    attendance_date text not null,
    break_type text,
    break_time text,
    break_count integer default 0,
    break_minutes integer default 0,
    created_at text not null
);

create index if not exists idx_attendance_user on attendance_breaks(user_code, attendance_date);

create table if not exists reports (
    id integer primary key autoincrement,
    owner_user_code text not null,
    target_user_code text not null,
    report_date text not null,
    report_type text not null,
    total_profiles integer default 0,
    total_submissions integer default 0,
    total_interviews integer default 0,
    total_calls integer default 0,
    top_performer text,
    low_performer text,
    report_json text,
    created_at text not null
);

create index if not exists idx_reports_owner on reports(owner_user_code, report_date);

create table if not exists report_settings (
    id integer primary key autoincrement,
    user_code text unique not null,
    every_minutes integer default 30,
    is_enabled integer default 1,
    updated_at text not null
);
