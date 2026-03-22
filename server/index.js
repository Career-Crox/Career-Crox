const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const XLSX = require('xlsx');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 10000);
const JWT_SECRET = process.env.JWT_SECRET || process.env.SECRET_KEY || 'change-this-secret';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const APP_URL = (process.env.APP_URL || '').trim();
const CORS_ORIGIN = (process.env.CORS_ORIGIN || APP_URL || '').trim();
const IS_PROD = process.env.NODE_ENV === 'production';
const DIST_DIR = path.join(__dirname, '..', 'dist', 'client');
const dbReady = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

const supabase = dbReady
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Slow down for a minute.' }
});

const moduleMap = {
  users: { table: 'users', pk: 'user_id', order: 'updated_at', create: 'manager', update: 'self_or_manager', delete: 'manager' },
  candidates: { table: 'candidates', pk: 'candidate_id', order: 'updated_at', create: 'auth', update: 'owner_or_privileged', delete: 'privileged' },
  tasks: { table: 'tasks', pk: 'task_id', order: 'updated_at', create: 'auth', update: 'task_owner_or_privileged', delete: 'privileged' },
  jds: { table: 'jd_master', pk: 'jd_id', order: 'created_at', create: 'privileged', update: 'privileged', delete: 'privileged' },
  interviews: { table: 'interviews', pk: 'interview_id', order: 'scheduled_at', create: 'privileged', update: 'privileged', delete: 'privileged' },
  submissions: { table: 'submissions', pk: 'submission_id', order: 'submitted_at', create: 'auth', update: 'submission_owner_or_privileged', delete: 'privileged' },
  notifications: { table: 'notifications', pk: 'notification_id', order: 'created_at', create: 'privileged', update: 'privileged', delete: 'privileged' },
  clientPipeline: { table: 'client_pipeline', pk: 'lead_id', order: 'updated_at', create: 'privileged', update: 'client_owner_or_privileged', delete: 'privileged' },
  clientRequirements: { table: 'client_requirements', pk: 'req_id', order: 'created_at', create: 'privileged', update: 'privileged', delete: 'privileged' },
  revenue: { table: 'revenue_entries', pk: 'rev_id', order: 'created_at', create: 'privileged', update: 'privileged', delete: 'privileged' },
  reports: { table: 'scheduled_reports', pk: 'report_id', order: 'created_at', create: 'privileged', update: 'privileged', delete: 'privileged' },
  presence: { table: 'presence', pk: 'user_id', order: 'last_seen_at', create: 'auth', update: 'self_or_privileged', delete: 'manager' },
  settings: { table: 'settings', pk: 'setting_key', order: 'setting_key', create: 'manager', update: 'manager', delete: 'manager' },
  activity: { table: 'activity_log', pk: 'activity_id', order: 'created_at', create: 'server_only', update: 'none', delete: 'manager' },
  messages: { table: 'messages', pk: 'id', order: 'created_at', create: 'auth', update: 'message_sender_or_privileged', delete: 'message_sender_or_privileged' },
  chatGroups: { table: 'chat_groups', pk: 'group_id', order: 'updated_at', create: 'privileged', update: 'privileged', delete: 'privileged' },
  chatMembers: { table: 'chat_group_members', pk: 'id', order: 'joined_at', create: 'privileged', update: 'privileged', delete: 'privileged' }
};

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors(
    CORS_ORIGIN
      ? { origin: CORS_ORIGIN, credentials: true }
      : { origin: true, credentials: true }
  )
);

function nowIso() {
  return new Date().toISOString();
}

function buildId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`.toUpperCase();
}

function sanitizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function sanitizeRow(row = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(row)) clean[key] = sanitizeText(value);
  return clean;
}

function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase();
  if (['manager', 'admin', 'operations', 'ops'].includes(value)) return 'manager';
  if (['tl', 'team lead', 'lead'].includes(value)) return 'tl';
  return 'recruiter';
}

function toBool(value) {
  return ['1', 'true', 'yes', 'y'].includes(String(value || '').trim().toLowerCase());
}

function isPrivileged(user) {
  const role = normalizeRole(user?.role);
  return role === 'manager' || role === 'tl';
}

function canManageUsers(user) {
  return normalizeRole(user?.role) === 'manager';
}

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 4) return phone || '';
  return `${digits.slice(0, 2)}******${digits.slice(-2)}`;
}

function stripPassword(user) {
  if (!user) return null;
  const copy = { ...user };
  delete copy.password;
  copy.role = normalizeRole(copy.role);
  return copy;
}

function signToken(user, sessionToken) {
  return jwt.sign(
    {
      user_id: user.user_id,
      username: user.username,
      role: normalizeRole(user.role),
      recruiter_code: user.recruiter_code || '',
      st: sessionToken
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function setAuthCookie(res, token) {
  res.cookie('career_crox_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function clearAuthCookie(res) {
  res.clearCookie('career_crox_token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD
  });
}

async function ensureDb() {
  if (!dbReady) {
    const err = new Error('Supabase environment variables are missing. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    err.status = 503;
    throw err;
  }
}

async function countRows(table) {
  await ensureDb();
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

async function getUserByUsername(username) {
  await ensureDb();
  const { data, error } = await supabase.from('users').select('*').eq('username', username).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function getUserById(userId) {
  await ensureDb();
  const { data, error } = await supabase.from('users').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function listAll(table, orderKey = 'updated_at', limit = 1500) {
  await ensureDb();
  let builder = supabase.from(table).select('*');
  if (orderKey) builder = builder.order(orderKey, { ascending: false, nullsFirst: false });
  const { data, error } = await builder.limit(limit);
  if (error) throw error;
  return data || [];
}

async function findById(table, pk, value) {
  await ensureDb();
  const { data, error } = await supabase.from(table).select('*').eq(pk, value).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function insertRow(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

async function upsertRow(table, row, pk) {
  const { data, error } = await supabase.from(table).upsert(row, { onConflict: pk }).select().single();
  if (error) throw error;
  return data;
}

async function updateRow(table, pk, id, patch) {
  const { data, error } = await supabase.from(table).update(patch).eq(pk, id).select().single();
  if (error) throw error;
  return data;
}

async function deleteRow(table, pk, id) {
  const { error } = await supabase.from(table).delete().eq(pk, id);
  if (error) throw error;
}

async function logActivity(user, actionType, candidateId = '', metadata = {}) {
  if (!dbReady || !user) return;
  try {
    await supabase.from('activity_log').insert({
      activity_id: buildId('ACT'),
      user_id: user.user_id,
      username: user.username,
      action_type: actionType,
      candidate_id: candidateId,
      metadata: JSON.stringify(metadata || {}),
      created_at: nowIso()
    });
  } catch (error) {
    console.error('Activity log failed:', error.message || error);
  }
}

async function touchPresence(user, patch = {}) {
  if (!user) return;
  const row = {
    user_id: user.user_id,
    last_seen_at: nowIso(),
    last_page: sanitizeText(patch.last_page),
    is_on_break: patch.is_on_break || '0',
    break_reason: sanitizeText(patch.break_reason),
    break_started_at: sanitizeText(patch.break_started_at),
    break_expected_end_at: sanitizeText(patch.break_expected_end_at),
    total_break_minutes: sanitizeText(patch.total_break_minutes),
    locked: patch.locked || '0',
    last_call_dial_at: sanitizeText(patch.last_call_dial_at),
    last_call_candidate_id: sanitizeText(patch.last_call_candidate_id),
    last_call_alert_sent_at: sanitizeText(patch.last_call_alert_sent_at),
    meeting_joined: patch.meeting_joined || '0',
    meeting_joined_at: sanitizeText(patch.meeting_joined_at),
    screen_sharing: patch.screen_sharing || '0',
    screen_frame_url: sanitizeText(patch.screen_frame_url),
    last_screen_frame_at: sanitizeText(patch.last_screen_frame_at),
    work_started_at: sanitizeText(patch.work_started_at),
    total_work_minutes: sanitizeText(patch.total_work_minutes)
  };
  await upsertRow('presence', row, 'user_id');
}

function candidateVisibleToUser(user, candidate) {
  const role = normalizeRole(user?.role);
  if (role === 'manager' || role === 'tl') return true;
  const mine = sanitizeText(user?.recruiter_code);
  const owner = sanitizeText(candidate?.recruiter_code);
  return !owner || owner === mine;
}

function scopeRows(key, user, rows) {
  if (!user) return [];
  switch (key) {
    case 'users':
      return canManageUsers(user) ? rows.map(stripPassword) : rows.filter((r) => r.user_id === user.user_id).map(stripPassword);
    case 'candidates':
      return rows.filter((row) => candidateVisibleToUser(user, row)).map((row) => ({
        ...row,
        phone: normalizeRole(user.role) === 'recruiter' && row.recruiter_code && row.recruiter_code !== user.recruiter_code ? maskPhone(row.phone) : row.phone
      }));
    case 'tasks':
      return isPrivileged(user) ? rows : rows.filter((row) => row.assigned_to_user_id === user.user_id);
    case 'submissions':
      return isPrivileged(user) ? rows : rows.filter((row) => row.recruiter_code === user.recruiter_code);
    case 'notifications':
      return rows.filter((row) => !row.user_id || row.user_id === user.user_id);
    case 'clientPipeline':
      return isPrivileged(user) ? rows : rows.filter((row) => !row.owner_username || row.owner_username === user.username);
    case 'revenue':
      return isPrivileged(user) ? rows : rows.filter((row) => row.recruiter_code === user.recruiter_code);
    case 'activity':
      return isPrivileged(user) ? rows.slice(0, 200) : rows.filter((row) => row.user_id === user.user_id).slice(0, 100);
    case 'presence':
      return isPrivileged(user) ? rows : rows.filter((row) => row.user_id === user.user_id);
    case 'messages':
      return rows.filter((row) => {
        if (row.thread_type === 'group') return true;
        return row.sender_username === user.username || row.recipient_username === user.username;
      });
    default:
      return rows;
  }
}

function canMutate(key, action, user, row = null, payload = {}) {
  const rule = moduleMap[key]?.[action];
  if (!rule || rule === 'none' || rule === 'server_only') return false;
  if (rule === 'auth') return Boolean(user);
  if (rule === 'manager') return canManageUsers(user);
  if (rule === 'privileged') return isPrivileged(user);
  if (rule === 'self_or_manager') return canManageUsers(user) || row?.user_id === user?.user_id || payload.user_id === user?.user_id;
  if (rule === 'self_or_privileged') return isPrivileged(user) || row?.user_id === user?.user_id || payload.user_id === user?.user_id;
  if (rule === 'owner_or_privileged') return isPrivileged(user) || row?.recruiter_code === user?.recruiter_code || payload.recruiter_code === user?.recruiter_code || !row?.recruiter_code;
  if (rule === 'submission_owner_or_privileged') return isPrivileged(user) || row?.recruiter_code === user?.recruiter_code;
  if (rule === 'task_owner_or_privileged') return isPrivileged(user) || row?.assigned_to_user_id === user?.user_id || payload.assigned_to_user_id === user?.user_id;
  if (rule === 'client_owner_or_privileged') return isPrivileged(user) || row?.owner_username === user?.username || payload.owner_username === user?.username;
  if (rule === 'message_sender_or_privileged') return isPrivileged(user) || row?.sender_username === user?.username || payload.sender_username === user?.username;
  return false;
}

function normalizeUserInput(data = {}, existing = null) {
  const row = sanitizeRow({ ...existing, ...data });
  return {
    user_id: row.user_id || buildId('USR'),
    username: sanitizeText(row.username).toLowerCase(),
    full_name: row.full_name,
    designation: row.designation,
    role: normalizeRole(row.role || 'recruiter'),
    recruiter_code: row.recruiter_code,
    is_active: row.is_active || '1',
    theme_name: row.theme_name || 'corporate-dark',
    updated_at: nowIso()
  };
}

function normalizeCandidateInput(data = {}, actor = null, existing = null) {
  const row = sanitizeRow({ ...existing, ...data });
  const output = {
    candidate_id: row.candidate_id || buildId('CAND'),
    call_connected: row.call_connected,
    looking_for_job: row.looking_for_job,
    full_name: row.full_name,
    phone: row.phone,
    qualification: row.qualification,
    location: row.location,
    preferred_location: row.preferred_location,
    qualification_level: row.qualification_level,
    total_experience: row.total_experience,
    relevant_experience: row.relevant_experience,
    in_hand_salary: row.in_hand_salary,
    ctc_monthly: row.ctc_monthly,
    career_gap: row.career_gap,
    documents_availability: row.documents_availability,
    communication_skill: row.communication_skill,
    relevant_experience_range: row.relevant_experience_range,
    relevant_in_hand_range: row.relevant_in_hand_range,
    submission_date: row.submission_date,
    process: row.process,
    recruiter_code: row.recruiter_code,
    recruiter_name: row.recruiter_name,
    recruiter_designation: row.recruiter_designation,
    status: row.status || 'New',
    all_details_sent: row.all_details_sent,
    interview_availability: row.interview_availability,
    interview_reschedule_date: row.interview_reschedule_date,
    follow_up_at: row.follow_up_at,
    follow_up_note: row.follow_up_note,
    follow_up_status: row.follow_up_status || 'Pending',
    approval_status: row.approval_status || 'Pending',
    approval_requested_at: row.approval_requested_at,
    approved_at: row.approved_at,
    approved_by_name: row.approved_by_name,
    is_duplicate: row.is_duplicate || '0',
    notes: row.notes,
    resume_filename: row.resume_filename,
    recording_filename: row.recording_filename,
    created_at: row.created_at || nowIso(),
    updated_at: nowIso(),
    experience: row.experience || row.total_experience
  };
  if (actor && normalizeRole(actor.role) === 'recruiter') {
    output.recruiter_code = actor.recruiter_code || output.recruiter_code;
    output.recruiter_name = actor.full_name || actor.username || output.recruiter_name;
    output.recruiter_designation = actor.designation || 'Recruiter';
  }
  return output;
}

function normalizeTaskInput(data = {}, actor = null, existing = null) {
  const row = sanitizeRow({ ...existing, ...data });
  return {
    task_id: row.task_id || buildId('TASK'),
    title: row.title,
    description: row.description,
    assigned_to_user_id: row.assigned_to_user_id,
    assigned_to_name: row.assigned_to_name,
    assigned_by_user_id: row.assigned_by_user_id || actor?.user_id || '',
    assigned_by_name: row.assigned_by_name || actor?.full_name || actor?.username || '',
    status: row.status || 'Open',
    priority: row.priority || 'Medium',
    due_date: row.due_date,
    created_at: row.created_at || nowIso(),
    updated_at: nowIso()
  };
}

function normalizeJdInput(data = {}, existing = null) {
  const row = sanitizeRow({ ...existing, ...data });
  return {
    jd_id: row.jd_id || buildId('JD'),
    job_title: row.job_title,
    company: row.company,
    location: row.location,
    experience: row.experience,
    salary: row.salary,
    pdf_url: row.pdf_url,
    jd_status: row.jd_status || 'Open',
    notes: row.notes,
    created_at: row.created_at || nowIso()
  };
}

function normalizeInterviewInput(data = {}, existing = null) {
  const row = sanitizeRow({ ...existing, ...data });
  return {
    interview_id: row.interview_id || buildId('INT'),
    candidate_id: row.candidate_id,
    jd_id: row.jd_id,
    stage: row.stage || 'Screening',
    scheduled_at: row.scheduled_at,
    status: row.status || 'Scheduled',
    created_at: row.created_at || nowIso()
  };
}

function normalizeSubmissionInput(data = {}, actor = null, existing = null) {
  const row = sanitizeRow({ ...existing, ...data });
  return {
    submission_id: row.submission_id || buildId('SUB'),
    candidate_id: row.candidate_id,
    jd_id: row.jd_id,
    recruiter_code: row.recruiter_code || actor?.recruiter_code || '',
    status: row.status || 'Submitted',
    approval_status: row.approval_status || 'Pending',
    decision_note: row.decision_note,
    approval_requested_at: row.approval_requested_at || nowIso(),
    approved_by_name: row.approved_by_name,
    approved_at: row.approved_at,
    approval_rescheduled_at: row.approval_rescheduled_at,
    submitted_at: row.submitted_at || nowIso()
  };
}

function normalizeNotificationInput(data = {}, existing = null) {
  const row = sanitizeRow({ ...existing, ...data });
  return {
    notification_id: row.notification_id || buildId('NTF'),
    user_id: row.user_id,
    title: row.title,
    message: row.message,
    category: row.category || 'General',
    status: row.status || 'Unread',
    metadata: row.metadata || '{}',
    created_at: row.created_at || nowIso()
  };
}

function normalizeClientPipelineInput(data = {}, actor = null, existing = null) {
  const row = sanitizeRow({ ...existing, ...data });
  return {
    lead_id: row.lead_id || buildId('LEAD'),
    client_name: row.client_name,
    contact_person: row.contact_person,
    contact_phone: row.contact_phone,
    city: row.city,
    industry: row.industry,
    status: row.status || 'Open',
    owner_username: row.owner_username || actor?.username || '',
    priority: row.priority || 'Medium',
    openings_count: row.openings_count,
    last_follow_up_at: row.last_follow_up_at,
    next_follow_up_at: row.next_follow_up_at,
    notes: row.notes,
    created_at: row.created_at || nowIso(),
    updated_at: nowIso()
  };
}

function normalizeClientRequirementInput(data = {}, existing = null) {
  const row = sanitizeRow({ ...existing, ...data });
  return {
    req_id: row.req_id || buildId('REQ'),
    lead_id: row.lead_id,
    jd_title: row.jd_title,
    city: row.city,
    openings: row.openings,
    target_ctc: row.target_ctc,
    status: row.status || 'Open',
    assigned_tl: row.assigned_tl,
    assigned_manager: row.assigned_manager,
    fill_target_date: row.fill_target_date,
    created_at: row.created_at || nowIso()
  };
}

function normalizeRevenueInput(data = {}, existing = null) {
  const row = sanitizeRow({ ...existing, ...data });
  return {
    rev_id: row.rev_id || buildId('REV'),
    client_name: row.client_name,
    candidate_id: row.candidate_id,
    jd_id: row.jd_id,
    recruiter_code: row.recruiter_code,
    amount_billed: row.amount_billed,
    amount_collected: row.amount_collected,
    invoice_status: row.invoice_status || 'Pending',
    billing_month: row.billing_month,
    joined_at: row.joined_at,
    expected_payout_date: row.expected_payout_date,
    source_channel: row.source_channel,
    created_at: row.created_at || nowIso()
  };
}

function normalizeReportInput(data = {}, actor = null, existing = null) {
  const row = sanitizeRow({ ...existing, ...data });
  return {
    report_id: row.report_id || buildId('RPT'),
    user_id: row.user_id || actor?.user_id || '',
    title: row.title,
    report_type: row.report_type || 'summary',
    filters_json: row.filters_json || '{}',
    file_format: row.file_format || 'xlsx',
    frequency_minutes: row.frequency_minutes || '1440',
    status: row.status || 'Active',
    next_run_at: row.next_run_at,
    last_run_at: row.last_run_at,
    last_file_name: row.last_file_name,
    created_at: row.created_at || nowIso()
  };
}

function normalizePresenceInput(data = {}, actor = null, existing = null) {
  const row = sanitizeRow({ ...existing, ...data });
  return {
    user_id: row.user_id || actor?.user_id || '',
    last_seen_at: row.last_seen_at || nowIso(),
    last_page: row.last_page,
    is_on_break: row.is_on_break || '0',
    break_reason: row.break_reason,
    break_started_at: row.break_started_at,
    break_expected_end_at: row.break_expected_end_at,
    total_break_minutes: row.total_break_minutes,
    locked: row.locked || '0',
    last_call_dial_at: row.last_call_dial_at,
    last_call_candidate_id: row.last_call_candidate_id,
    last_call_alert_sent_at: row.last_call_alert_sent_at,
    meeting_joined: row.meeting_joined || '0',
    meeting_joined_at: row.meeting_joined_at,
    screen_sharing: row.screen_sharing || '0',
    screen_frame_url: row.screen_frame_url,
    last_screen_frame_at: row.last_screen_frame_at,
    work_started_at: row.work_started_at,
    total_work_minutes: row.total_work_minutes
  };
}

function normalizeSettingInput(data = {}, existing = null) {
  const row = sanitizeRow({ ...existing, ...data });
  return {
    setting_key: row.setting_key,
    setting_value: row.setting_value,
    notes: row.notes,
    Instructions: row.Instructions
  };
}

function normalizeMessageInput(data = {}, actor = null) {
  const row = sanitizeRow(data);
  return {
    sender_username: actor?.username || row.sender_username,
    recipient_username: row.recipient_username,
    body: row.body,
    created_at: row.created_at || nowIso(),
    thread_key: row.thread_key || [actor?.username || '', row.recipient_username || ''].sort().join('::'),
    thread_type: row.thread_type || 'direct',
    reference_type: row.reference_type,
    reference_id: row.reference_id,
    mention_usernames: row.mention_usernames
  };
}

function normalizeGroupInput(data = {}, actor = null, existing = null) {
  const row = sanitizeRow({ ...existing, ...data });
  return {
    group_id: row.group_id || buildId('GRP'),
    title: row.title,
    created_by_username: row.created_by_username || actor?.username || '',
    created_at: row.created_at || nowIso(),
    updated_at: nowIso(),
    is_active: row.is_active || '1',
    is_manager_pinned: row.is_manager_pinned || '0'
  };
}

function normalizeForModule(key, data, actor, existing) {
  switch (key) {
    case 'users': return normalizeUserInput(data, existing);
    case 'candidates': return normalizeCandidateInput(data, actor, existing);
    case 'tasks': return normalizeTaskInput(data, actor, existing);
    case 'jds': return normalizeJdInput(data, existing);
    case 'interviews': return normalizeInterviewInput(data, existing);
    case 'submissions': return normalizeSubmissionInput(data, actor, existing);
    case 'notifications': return normalizeNotificationInput(data, existing);
    case 'clientPipeline': return normalizeClientPipelineInput(data, actor, existing);
    case 'clientRequirements': return normalizeClientRequirementInput(data, existing);
    case 'revenue': return normalizeRevenueInput(data, existing);
    case 'reports': return normalizeReportInput(data, actor, existing);
    case 'presence': return normalizePresenceInput(data, actor, existing);
    case 'settings': return normalizeSettingInput(data, existing);
    case 'messages': return normalizeMessageInput(data, actor);
    case 'chatGroups': return normalizeGroupInput(data, actor, existing);
    default: return sanitizeRow({ ...existing, ...data });
  }
}

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function buildWorkbook(headers, rows, sheetName) {
  const data = [headers, ...rows.map((row) => headers.map((key) => row[key] ?? ''))];
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function parseWorkbookRows(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet, { defval: '' }).map((row) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) normalized[String(key).trim().toLowerCase().replace(/\s+/g, '_')] = value;
    return normalized;
  });
}

async function withUser(req, _res, next) {
  const token = req.cookies.career_crox_token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(payload.user_id);
    if (!user) {
      req.user = null;
      return next();
    }
    const session = await findById('active_sessions', 'username', user.username).catch(() => null);
    if (payload.st && session && session.session_token && session.session_token !== payload.st) {
      req.user = null;
      return next();
    }
    req.user = stripPassword(user);
  } catch (_error) {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in first.' });
  next();
}

app.use(withUser);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, dbReady, time: nowIso() });
});

app.get('/api/bootstrap/status', asyncRoute(async (_req, res) => {
  if (!dbReady) return res.json({ dbReady: false, hasUsers: false, message: 'Missing Supabase environment variables.' });
  const userCount = await countRows('users');
  res.json({ dbReady: true, hasUsers: userCount > 0 });
}));

app.post('/api/bootstrap', asyncRoute(async (req, res) => {
  await ensureDb();
  const existingUsers = await countRows('users');
  if (existingUsers > 0) return res.status(409).json({ error: 'Bootstrap already completed.' });
  const username = sanitizeText(req.body.username).toLowerCase();
  const password = sanitizeText(req.body.password);
  const fullName = sanitizeText(req.body.full_name);
  if (!username || !password || !fullName) return res.status(400).json({ error: 'Username, full name, and password are required.' });
  const passwordHash = await bcrypt.hash(password, 10);
  const firstUser = await insertRow('users', {
    user_id: buildId('USR'),
    username,
    password: passwordHash,
    full_name: fullName,
    designation: sanitizeText(req.body.designation) || 'Manager',
    role: 'manager',
    recruiter_code: sanitizeText(req.body.recruiter_code) || 'ADMIN',
    is_active: '1',
    theme_name: 'corporate-dark',
    updated_at: nowIso()
  });
  const sessionToken = crypto.randomBytes(16).toString('hex');
  await upsertRow('active_sessions', {
    username,
    session_token: sessionToken,
    ip_address: req.ip,
    user_agent: sanitizeText(req.headers['user-agent']),
    updated_at: nowIso()
  }, 'username');
  const safeUser = stripPassword(firstUser);
  setAuthCookie(res, signToken(safeUser, sessionToken));
  res.status(201).json({ user: safeUser });
}));

app.post('/api/auth/login', loginLimiter, asyncRoute(async (req, res) => {
  await ensureDb();
  const username = sanitizeText(req.body.username).toLowerCase();
  const password = sanitizeText(req.body.password);
  const user = await getUserByUsername(username);
  if (!user || !toBool(user.is_active || '1')) return res.status(401).json({ error: 'Invalid username or password.' });
  let valid = false;
  if (String(user.password || '').startsWith('$2')) {
    valid = await bcrypt.compare(password, user.password);
  } else {
    valid = user.password === password;
    if (valid) {
      const passwordHash = await bcrypt.hash(password, 10);
      await updateRow('users', 'user_id', user.user_id, { password: passwordHash, updated_at: nowIso() });
      user.password = passwordHash;
    }
  }
  if (!valid) return res.status(401).json({ error: 'Invalid username or password.' });
  const safeUser = stripPassword(user);
  const sessionToken = crypto.randomBytes(16).toString('hex');
  await upsertRow('active_sessions', {
    username,
    session_token: sessionToken,
    ip_address: req.ip,
    user_agent: sanitizeText(req.headers['user-agent']),
    updated_at: nowIso()
  }, 'username');
  setAuthCookie(res, signToken(safeUser, sessionToken));
  await touchPresence(safeUser, { work_started_at: nowIso() });
  await logActivity(safeUser, 'login', '', { ip: req.ip });
  res.json({ user: safeUser });
}));

app.post('/api/auth/logout', requireAuth, asyncRoute(async (req, res) => {
  await updateRow('active_sessions', 'username', req.user.username, { session_token: '', updated_at: nowIso() }).catch(() => null);
  await logActivity(req.user, 'logout', '', {});
  clearAuthCookie(res);
  res.json({ ok: true });
}));

app.get('/api/auth/me', asyncRoute(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
  res.json({ user: req.user });
}));

app.get('/api/dashboard/summary', requireAuth, asyncRoute(async (req, res) => {
  const [candidates, tasks, interviews, submissions, notifications, activity, users, pipeline, revenue, presence] = await Promise.all([
    listAll('candidates', 'updated_at'),
    listAll('tasks', 'updated_at'),
    listAll('interviews', 'scheduled_at'),
    listAll('submissions', 'submitted_at'),
    listAll('notifications', 'created_at'),
    listAll('activity_log', 'created_at'),
    listAll('users', 'updated_at'),
    listAll('client_pipeline', 'updated_at'),
    listAll('revenue_entries', 'created_at'),
    listAll('presence', 'last_seen_at')
  ]);
  const scopedCandidates = scopeRows('candidates', req.user, candidates);
  const scopedTasks = scopeRows('tasks', req.user, tasks);
  const scopedSubmissions = scopeRows('submissions', req.user, submissions);
  const scopedNotifications = scopeRows('notifications', req.user, notifications);
  const scopedActivity = scopeRows('activity', req.user, activity);
  const scopedPipeline = scopeRows('clientPipeline', req.user, pipeline);
  const scopedRevenue = scopeRows('revenue', req.user, revenue);
  const today = nowIso().slice(0, 10);
  const billed = scopedRevenue.reduce((sum, row) => sum + Number(row.amount_billed || 0), 0);
  const collected = scopedRevenue.reduce((sum, row) => sum + Number(row.amount_collected || 0), 0);
  res.json({
    candidateCount: scopedCandidates.length,
    openTasks: scopedTasks.filter((row) => !['Done', 'Closed', 'Completed'].includes(row.status)).length,
    interviewsToday: interviews.filter((row) => String(row.scheduled_at || '').slice(0, 10) === today).length,
    pendingApprovals: scopedSubmissions.filter((row) => (row.approval_status || 'Pending') === 'Pending').length,
    unreadNotifications: scopedNotifications.filter((row) => row.status !== 'Read').length,
    activeRecruiters: users.filter((row) => normalizeRole(row.role) === 'recruiter' && toBool(row.is_active || '1')).length,
    clientOpenings: scopedPipeline.reduce((sum, row) => sum + Number(row.openings_count || 0), 0),
    billed,
    collected,
    onlineUsers: presence.filter((row) => row.last_seen_at && String(row.last_seen_at).slice(0, 10) === today).length,
    latestCandidates: scopedCandidates.slice(0, 8),
    pendingFollowups: scopedCandidates.filter((row) => row.follow_up_at).slice(0, 8),
    recentActivity: scopedActivity.slice(0, 12),
    latestRevenue: scopedRevenue.slice(0, 8)
  });
}));

app.get('/api/search', requireAuth, asyncRoute(async (req, res) => {
  const q = sanitizeText(req.query.q).toLowerCase();
  if (!q) return res.json({ candidates: [], tasks: [], jds: [], clients: [], messages: [] });
  const [candidates, tasks, jds, pipeline, messages] = await Promise.all([
    listAll('candidates', 'updated_at'),
    listAll('tasks', 'updated_at'),
    listAll('jd_master', 'created_at'),
    listAll('client_pipeline', 'updated_at'),
    listAll('messages', 'created_at')
  ]);
  const scopedCandidates = scopeRows('candidates', req.user, candidates);
  const scopedTasks = scopeRows('tasks', req.user, tasks);
  const scopedMessages = scopeRows('messages', req.user, messages);
  res.json({
    candidates: scopedCandidates.filter((row) => JSON.stringify(row).toLowerCase().includes(q)).slice(0, 8),
    tasks: scopedTasks.filter((row) => JSON.stringify(row).toLowerCase().includes(q)).slice(0, 8),
    jds: jds.filter((row) => JSON.stringify(row).toLowerCase().includes(q)).slice(0, 8),
    clients: scopeRows('clientPipeline', req.user, pipeline).filter((row) => JSON.stringify(row).toLowerCase().includes(q)).slice(0, 8),
    messages: scopedMessages.filter((row) => JSON.stringify(row).toLowerCase().includes(q)).slice(0, 8)
  });
}));

app.get('/api/module/:key', requireAuth, asyncRoute(async (req, res) => {
  const key = req.params.key;
  const mod = moduleMap[key];
  if (!mod) return res.status(404).json({ error: 'Unknown module.' });
  const rows = await listAll(mod.table, mod.order);
  let scoped = scopeRows(key, req.user, rows);
  const q = sanitizeText(req.query.q).toLowerCase();
  if (q) scoped = scoped.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
  if (req.query.onlyPending === '1' && key === 'submissions') scoped = scoped.filter((row) => (row.approval_status || 'Pending') === 'Pending');
  const limit = Number(req.query.limit || 0);
  res.json({ rows: limit > 0 ? scoped.slice(0, limit) : scoped });
}));

app.post('/api/module/:key', requireAuth, asyncRoute(async (req, res) => {
  const key = req.params.key;
  const mod = moduleMap[key];
  if (!mod) return res.status(404).json({ error: 'Unknown module.' });
  if (!canMutate(key, 'create', req.user, null, req.body || {})) return res.status(403).json({ error: 'Not allowed.' });
  if (key === 'users') {
    const base = normalizeForModule(key, req.body, req.user, null);
    if (!base.username || !sanitizeText(req.body.password)) return res.status(400).json({ error: 'Username and password are required.' });
    const passwordHash = await bcrypt.hash(sanitizeText(req.body.password), 10);
    const saved = await insertRow(mod.table, { ...base, password: passwordHash });
    await logActivity(req.user, 'user_create', '', { user_id: saved.user_id, username: saved.username });
    return res.status(201).json({ row: stripPassword(saved) });
  }
  if (key === 'messages') {
    const saved = await insertRow(mod.table, normalizeForModule(key, req.body, req.user, null));
    await logActivity(req.user, 'message_send', '', { recipient_username: saved.recipient_username, thread_key: saved.thread_key });
    return res.status(201).json({ row: saved });
  }
  if (key === 'chatGroups') {
    const group = await insertRow(mod.table, normalizeForModule(key, req.body, req.user, null));
    await insertRow('chat_group_members', { group_id: group.group_id, username: req.user.username, joined_at: nowIso() });
    await logActivity(req.user, 'group_create', '', { group_id: group.group_id });
    return res.status(201).json({ row: group });
  }
  const saved = await upsertRow(mod.table, normalizeForModule(key, req.body, req.user, null), mod.pk);
  await logActivity(req.user, `${key}_create`, saved.candidate_id || '', { id: saved[mod.pk] });
  res.status(201).json({ row: key === 'users' ? stripPassword(saved) : saved });
}));

app.put('/api/module/:key/:id', requireAuth, asyncRoute(async (req, res) => {
  const key = req.params.key;
  const mod = moduleMap[key];
  if (!mod) return res.status(404).json({ error: 'Unknown module.' });
  const current = await findById(mod.table, mod.pk, req.params.id);
  if (!current) return res.status(404).json({ error: 'Record not found.' });
  if (!canMutate(key, 'update', req.user, current, req.body || {})) return res.status(403).json({ error: 'Not allowed.' });
  if (key === 'users') {
    const base = normalizeForModule(key, req.body, req.user, current);
    const patch = { ...base };
    if (sanitizeText(req.body.password)) patch.password = await bcrypt.hash(sanitizeText(req.body.password), 10);
    else delete patch.password;
    const saved = await updateRow(mod.table, mod.pk, req.params.id, patch);
    await logActivity(req.user, 'user_update', '', { user_id: saved.user_id });
    return res.json({ row: stripPassword(saved) });
  }
  const prepared = normalizeForModule(key, { ...current, ...req.body, [mod.pk]: current[mod.pk] }, req.user, current);
  const saved = await updateRow(mod.table, mod.pk, req.params.id, prepared);
  await logActivity(req.user, `${key}_update`, saved.candidate_id || '', { id: saved[mod.pk] });
  res.json({ row: saved });
}));

app.delete('/api/module/:key/:id', requireAuth, asyncRoute(async (req, res) => {
  const key = req.params.key;
  const mod = moduleMap[key];
  if (!mod) return res.status(404).json({ error: 'Unknown module.' });
  const current = await findById(mod.table, mod.pk, req.params.id);
  if (!current) return res.status(404).json({ error: 'Record not found.' });
  if (!canMutate(key, 'delete', req.user, current, {})) return res.status(403).json({ error: 'Not allowed.' });
  await deleteRow(mod.table, mod.pk, req.params.id);
  await logActivity(req.user, `${key}_delete`, current.candidate_id || '', { id: current[mod.pk] });
  res.json({ ok: true });
}));

app.get('/api/candidates/:candidateId/notes', requireAuth, asyncRoute(async (req, res) => {
  const candidate = await findById('candidates', 'candidate_id', req.params.candidateId);
  if (!candidate || !candidateVisibleToUser(req.user, candidate)) return res.status(404).json({ error: 'Candidate not found.' });
  const rows = await listAll('notes', 'created_at');
  res.json({ rows: rows.filter((row) => row.candidate_id === req.params.candidateId).slice(0, 100) });
}));

app.post('/api/candidates/:candidateId/notes', requireAuth, asyncRoute(async (req, res) => {
  const candidate = await findById('candidates', 'candidate_id', req.params.candidateId);
  if (!candidate || !candidateVisibleToUser(req.user, candidate)) return res.status(404).json({ error: 'Candidate not found.' });
  const saved = await insertRow('notes', {
    candidate_id: req.params.candidateId,
    username: req.user.username,
    note_type: sanitizeText(req.body.note_type) || 'public',
    body: sanitizeText(req.body.body),
    created_at: nowIso()
  });
  await logActivity(req.user, 'candidate_note', req.params.candidateId, { note_type: saved.note_type });
  res.status(201).json({ row: saved });
}));

const candidateHeaders = ['candidate_id','full_name','phone','qualification','location','preferred_location','total_experience','relevant_experience','in_hand_salary','communication_skill','process','status','recruiter_code','recruiter_name','submission_date','follow_up_at','approval_status','notes','created_at','updated_at'];

app.get('/api/candidates/export', requireAuth, asyncRoute(async (req, res) => {
  const rows = scopeRows('candidates', req.user, await listAll('candidates', 'updated_at'));
  const q = sanitizeText(req.query.q).toLowerCase();
  const filtered = q ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q)) : rows;
  const buffer = buildWorkbook(candidateHeaders, filtered, 'Candidates');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="career-crox-candidates.xlsx"');
  res.send(buffer);
}));

app.get('/api/candidates/template', requireAuth, asyncRoute(async (_req, res) => {
  const buffer = buildWorkbook(candidateHeaders, [], 'Candidates');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="career-crox-candidate-template.xlsx"');
  res.send(buffer);
}));

app.post('/api/candidates/import', requireAuth, upload.single('file'), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload an Excel file first.' });
  const rows = parseWorkbookRows(req.file.buffer);
  let imported = 0;
  for (const row of rows) {
    const prepared = normalizeCandidateInput(row, req.user, null);
    await upsertRow('candidates', prepared, 'candidate_id');
    imported += 1;
  }
  await logActivity(req.user, 'candidate_import', '', { imported });
  res.json({ ok: true, imported });
}));

app.get('/api/approvals', requireAuth, asyncRoute(async (req, res) => {
  const rows = scopeRows('submissions', req.user, await listAll('submissions', 'submitted_at'));
  res.json({ rows: rows.filter((row) => (row.approval_status || 'Pending') === 'Pending') });
}));

app.post('/api/approvals/:submissionId', requireAuth, asyncRoute(async (req, res) => {
  if (!isPrivileged(req.user)) return res.status(403).json({ error: 'Only manager or TL can approve.' });
  const current = await findById('submissions', 'submission_id', req.params.submissionId);
  if (!current) return res.status(404).json({ error: 'Submission not found.' });
  const decision = sanitizeText(req.body.decision) || 'Approved';
  const updated = await updateRow('submissions', 'submission_id', current.submission_id, {
    approval_status: decision,
    decision_note: sanitizeText(req.body.decision_note),
    approved_by_name: req.user.full_name || req.user.username,
    approved_at: nowIso(),
    approval_rescheduled_at: sanitizeText(req.body.approval_rescheduled_at)
  });
  if (updated.candidate_id) {
    await updateRow('candidates', 'candidate_id', updated.candidate_id, {
      approval_status: decision,
      approved_by_name: req.user.full_name || req.user.username,
      approved_at: nowIso(),
      updated_at: nowIso()
    }).catch(() => null);
  }
  await logActivity(req.user, 'approval_decision', updated.candidate_id || '', { submission_id: updated.submission_id, decision });
  res.json({ row: updated });
}));

app.get('/api/followups/upcoming', requireAuth, asyncRoute(async (req, res) => {
  const rows = scopeRows('candidates', req.user, await listAll('candidates', 'follow_up_at'));
  res.json({ rows: rows.filter((row) => row.follow_up_at).slice(0, 100) });
}));

app.post('/api/followups/action', requireAuth, asyncRoute(async (req, res) => {
  const candidateId = sanitizeText(req.body.candidate_id);
  const current = await findById('candidates', 'candidate_id', candidateId);
  if (!current || !candidateVisibleToUser(req.user, current)) return res.status(404).json({ error: 'Candidate not found.' });
  const patch = {
    follow_up_status: sanitizeText(req.body.follow_up_status) || 'Done',
    follow_up_note: sanitizeText(req.body.follow_up_note),
    follow_up_at: sanitizeText(req.body.next_follow_up_at),
    updated_at: nowIso()
  };
  const updated = await updateRow('candidates', 'candidate_id', candidateId, patch);
  await logActivity(req.user, 'followup_action', candidateId, patch);
  res.json({ row: updated });
}));

app.post('/api/dialer/call/end', requireAuth, asyncRoute(async (req, res) => {
  const candidateId = sanitizeText(req.body.candidate_id);
  const current = await findById('candidates', 'candidate_id', candidateId);
  if (!current || !candidateVisibleToUser(req.user, current)) return res.status(404).json({ error: 'Candidate not found.' });
  const outcome = sanitizeText(req.body.outcome) || 'No Response';
  const patch = {
    call_connected: outcome === 'Connected' ? 'Yes' : 'No',
    status: sanitizeText(req.body.status) || current.status || 'In Progress',
    follow_up_at: sanitizeText(req.body.follow_up_at),
    follow_up_note: sanitizeText(req.body.note),
    updated_at: nowIso()
  };
  const updated = await updateRow('candidates', 'candidate_id', candidateId, patch);
  await touchPresence(req.user, { last_call_dial_at: nowIso(), last_call_candidate_id: candidateId, last_page: 'dialer' });
  await logActivity(req.user, 'dialer_call_end', candidateId, { outcome, phone: sanitizeText(req.body.phone) });
  res.json({ row: updated });
}));

app.post('/api/dialer/note', requireAuth, asyncRoute(async (req, res) => {
  const candidateId = sanitizeText(req.body.candidate_id);
  const current = await findById('candidates', 'candidate_id', candidateId);
  if (!current || !candidateVisibleToUser(req.user, current)) return res.status(404).json({ error: 'Candidate not found.' });
  const saved = await insertRow('notes', {
    candidate_id: candidateId,
    username: req.user.username,
    note_type: 'dialer',
    body: sanitizeText(req.body.body),
    created_at: nowIso()
  });
  await logActivity(req.user, 'dialer_note', candidateId, {});
  res.status(201).json({ row: saved });
}));

app.post('/api/attendance/ping', requireAuth, asyncRoute(async (req, res) => {
  await touchPresence(req.user, { last_page: sanitizeText(req.body.last_page) || 'dashboard', work_started_at: sanitizeText(req.body.work_started_at) });
  res.json({ ok: true });
}));

app.post('/api/attendance/start-break', requireAuth, asyncRoute(async (req, res) => {
  await touchPresence(req.user, { is_on_break: '1', break_reason: sanitizeText(req.body.break_reason), break_started_at: nowIso(), break_expected_end_at: sanitizeText(req.body.break_expected_end_at), last_page: 'attendance' });
  await logActivity(req.user, 'break_start', '', { break_reason: sanitizeText(req.body.break_reason) });
  res.json({ ok: true });
}));

app.post('/api/attendance/end-break', requireAuth, asyncRoute(async (req, res) => {
  await touchPresence(req.user, { is_on_break: '0', break_reason: '', break_started_at: '', break_expected_end_at: '', last_page: 'attendance' });
  await logActivity(req.user, 'break_end', '', {});
  res.json({ ok: true });
}));

app.post('/api/attendance/join', requireAuth, asyncRoute(async (req, res) => {
  await touchPresence(req.user, { meeting_joined: '1', meeting_joined_at: nowIso(), last_page: 'attendance' });
  await logActivity(req.user, 'meeting_join', '', { source: sanitizeText(req.body.source) || 'meeting-room' });
  res.json({ ok: true });
}));

app.get('/api/chat/overview', requireAuth, asyncRoute(async (req, res) => {
  const [messages, groups, members, users] = await Promise.all([
    listAll('messages', 'created_at'),
    listAll('chat_groups', 'updated_at'),
    listAll('chat_group_members', 'joined_at'),
    listAll('users', 'updated_at')
  ]);
  const scopedMessages = scopeRows('messages', req.user, messages).slice(0, 150);
  const visibleGroups = groups.filter((g) => g.is_active !== '0');
  const myGroups = members.filter((m) => m.username === req.user.username).map((m) => m.group_id);
  res.json({
    messages: scopedMessages,
    groups: visibleGroups.filter((group) => myGroups.includes(group.group_id) || isPrivileged(req.user)),
    users: scopeRows('users', req.user, users)
  });
}));

app.post('/api/chat/create-group', requireAuth, asyncRoute(async (req, res) => {
  if (!isPrivileged(req.user)) return res.status(403).json({ error: 'Only manager or TL can create groups.' });
  const title = sanitizeText(req.body.title);
  const usernames = Array.isArray(req.body.usernames) ? req.body.usernames.map((v) => sanitizeText(v)).filter(Boolean) : [];
  if (!title) return res.status(400).json({ error: 'Group title is required.' });
  const group = await insertRow('chat_groups', normalizeGroupInput({ title }, req.user));
  const uniqueUsers = [...new Set([req.user.username, ...usernames])];
  await Promise.all(uniqueUsers.map((username) => insertRow('chat_group_members', { group_id: group.group_id, username, joined_at: nowIso() })));
  await logActivity(req.user, 'chat_group_create', '', { group_id: group.group_id });
  res.status(201).json({ row: group });
}));

app.get('/api/reports/generate', requireAuth, asyncRoute(async (req, res) => {
  const dataset = sanitizeText(req.query.dataset) || 'candidates';
  const keyMap = { candidates: 'candidates', submissions: 'submissions', revenue: 'revenue', tasks: 'tasks', pipeline: 'clientPipeline' };
  const moduleKey = keyMap[dataset];
  if (!moduleKey) return res.status(400).json({ error: 'Unknown dataset.' });
  const rows = scopeRows(moduleKey, req.user, await listAll(moduleMap[moduleKey].table, moduleMap[moduleKey].order));
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const buffer = buildWorkbook(headers, rows, dataset);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="career-crox-${dataset}.xlsx"`);
  res.send(buffer);
}));

app.post('/api/notifications/mark-all-read', requireAuth, asyncRoute(async (req, res) => {
  const rows = scopeRows('notifications', req.user, await listAll('notifications', 'created_at'));
  await Promise.all(rows.filter((row) => row.status !== 'Read').map((row) => updateRow('notifications', 'notification_id', row.notification_id, { status: 'Read' })));
  res.json({ ok: true, count: rows.length });
}));

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  const message = error.message || 'Server error';
  console.error(error);
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`Career Crox CRM server listening on http://localhost:${PORT}`);
  console.log(`Supabase configured: ${dbReady ? 'yes' : 'no'}`);
});
