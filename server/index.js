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

const supabase = dbReady
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Slow down for a minute.' }
});

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  cors(
    CORS_ORIGIN
      ? {
          origin: CORS_ORIGIN,
          credentials: true
        }
      : { origin: true, credentials: true }
  )
);

function nowIso() {
  return new Date().toISOString();
}

function buildId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`.toUpperCase();
}

function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase();
  if (['manager', 'admin', 'operations', 'ops'].includes(value)) return 'manager';
  if (['tl', 'team lead', 'lead'].includes(value)) return 'tl';
  return 'recruiter';
}

function sanitizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function sanitizeRow(row = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(row)) {
    clean[key] = sanitizeText(value);
  }
  return clean;
}

function toBool(value) {
  return ['1', 'true', 'yes', 'y'].includes(String(value || '').trim().toLowerCase());
}

function signToken(user) {
  return jwt.sign(
    {
      user_id: user.user_id,
      username: user.username,
      role: normalizeRole(user.role),
      recruiter_code: user.recruiter_code || ''
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

function stripPassword(user) {
  if (!user) return null;
  const copy = { ...user };
  delete copy.password;
  copy.role = normalizeRole(copy.role);
  return copy;
}

function normalizeCandidateInput(data = {}, actor = null) {
  const row = sanitizeRow(data);
  const out = {
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
    out.recruiter_code = actor.recruiter_code || out.recruiter_code;
    out.recruiter_name = actor.full_name || actor.username || out.recruiter_name;
    out.recruiter_designation = actor.designation || 'Recruiter';
  }
  return out;
}

function normalizeTaskInput(data = {}, actor = null) {
  const row = sanitizeRow(data);
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

function normalizeJdInput(data = {}) {
  const row = sanitizeRow(data);
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

function normalizeInterviewInput(data = {}) {
  const row = sanitizeRow(data);
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

function normalizeSubmissionInput(data = {}, actor = null) {
  const row = sanitizeRow(data);
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

function normalizeUserInput(data = {}) {
  const row = sanitizeRow(data);
  return {
    user_id: row.user_id || buildId('USR'),
    username: row.username.toLowerCase(),
    full_name: row.full_name,
    designation: row.designation,
    role: normalizeRole(row.role || 'recruiter'),
    recruiter_code: row.recruiter_code,
    is_active: row.is_active || '1',
    theme_name: row.theme_name || 'corporate-dark',
    updated_at: nowIso()
  };
}

async function ensureDb() {
  if (!dbReady) {
    const err = new Error('Supabase environment variables are missing. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    err.status = 503;
    throw err;
  }
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

async function countUsers() {
  await ensureDb();
  const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

async function tableInsert(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

async function tableUpsert(table, row, conflict) {
  const { data, error } = await supabase.from(table).upsert(row, { onConflict: conflict }).select().single();
  if (error) throw error;
  return data;
}

async function tableUpdate(table, key, value, patch) {
  const { data, error } = await supabase.from(table).update(patch).eq(key, value).select().single();
  if (error) throw error;
  return data;
}

async function tableDelete(table, key, value) {
  const { error } = await supabase.from(table).delete().eq(key, value);
  if (error) throw error;
}

async function listAll(table, orderKey = 'updated_at') {
  await ensureDb();
  let builder = supabase.from(table).select('*');
  if (orderKey) builder = builder.order(orderKey, { ascending: false, nullsFirst: false });
  const { data, error } = await builder.limit(1500);
  if (error) throw error;
  return data || [];
}

async function listUsers() {
  const rows = await listAll('users', 'updated_at');
  return rows.map((item) => ({ ...item, role: normalizeRole(item.role) }));
}

function isPrivileged(user) {
  const role = normalizeRole(user?.role);
  return role === 'manager' || role === 'tl';
}

function canManageUsers(user) {
  return normalizeRole(user?.role) === 'manager';
}

function candidateVisibleToUser(user, candidate) {
  const role = normalizeRole(user?.role);
  if (role === 'manager' || role === 'tl') return true;
  const mine = sanitizeText(user?.recruiter_code);
  const owner = sanitizeText(candidate?.recruiter_code);
  return !owner || owner === mine;
}

function filterCandidatesForUser(user, rows) {
  return rows.filter((row) => candidateVisibleToUser(user, row));
}

async function getVisibleCandidates(user) {
  const rows = await listAll('candidates', 'updated_at');
  return filterCandidatesForUser(user, rows);
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

async function withUser(req, _res, next) {
  const token = req.cookies.career_crox_token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(payload.user_id);
    req.user = user ? stripPassword(user) : null;
  } catch (_error) {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in first.' });
  next();
}

function requirePrivileged(req, res, next) {
  if (!isPrivileged(req.user)) return res.status(403).json({ error: 'Only manager or TL can do this.' });
  next();
}

function requireManager(req, res, next) {
  if (!canManageUsers(req.user)) return res.status(403).json({ error: 'Only manager can do this.' });
  next();
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

function parseWorkbookCandidates(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  return rows.map((row) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[String(key).trim().toLowerCase().replace(/\s+/g, '_')] = value;
    }
    return normalized;
  });
}

const candidateHeaders = [
  'candidate_id',
  'full_name',
  'phone',
  'qualification',
  'location',
  'preferred_location',
  'total_experience',
  'relevant_experience',
  'in_hand_salary',
  'communication_skill',
  'process',
  'status',
  'recruiter_code',
  'recruiter_name',
  'submission_date',
  'notes',
  'created_at',
  'updated_at'
];

app.use(withUser);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, dbReady, time: nowIso() });
});

app.get('/api/bootstrap/status', asyncRoute(async (_req, res) => {
  if (!dbReady) {
    return res.json({ dbReady: false, hasUsers: false, message: 'Missing Supabase environment variables.' });
  }
  const userCount = await countUsers();
  res.json({ dbReady: true, hasUsers: userCount > 0 });
}));

app.post('/api/bootstrap', asyncRoute(async (req, res) => {
  await ensureDb();
  const existingUsers = await countUsers();
  if (existingUsers > 0) {
    return res.status(409).json({ error: 'Bootstrap already completed.' });
  }
  const username = sanitizeText(req.body.username).toLowerCase();
  const password = sanitizeText(req.body.password);
  const fullName = sanitizeText(req.body.full_name);
  if (!username || !password || !fullName) {
    return res.status(400).json({ error: 'Username, full name, and password are required.' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const firstUser = await tableInsert('users', {
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
  const safeUser = stripPassword(firstUser);
  setAuthCookie(res, signToken(safeUser));
  res.status(201).json({ user: safeUser });
}));

app.post('/api/auth/login', loginLimiter, asyncRoute(async (req, res) => {
  await ensureDb();
  const username = sanitizeText(req.body.username).toLowerCase();
  const password = sanitizeText(req.body.password);
  const user = await getUserByUsername(username);
  if (!user || !toBool(user.is_active || '1')) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  let valid = false;
  if (String(user.password || '').startsWith('$2')) {
    valid = await bcrypt.compare(password, user.password);
  } else {
    valid = user.password === password;
    if (valid) {
      const passwordHash = await bcrypt.hash(password, 10);
      await tableUpdate('users', 'user_id', user.user_id, { password: passwordHash, updated_at: nowIso() });
      user.password = passwordHash;
    }
  }
  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  const safeUser = stripPassword(user);
  setAuthCookie(res, signToken(safeUser));
  await logActivity(safeUser, 'login', '', { ip: req.ip });
  res.json({ user: safeUser });
}));

app.post('/api/auth/logout', requireAuth, asyncRoute(async (req, res) => {
  await logActivity(req.user, 'logout', '', {});
  clearAuthCookie(res);
  res.json({ ok: true });
}));

app.get('/api/auth/me', asyncRoute(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not logged in.' });
  res.json({ user: req.user });
}));

app.get('/api/dashboard/summary', requireAuth, asyncRoute(async (req, res) => {
  const [candidates, tasks, interviews, submissions, notifications, activity, users] = await Promise.all([
    getVisibleCandidates(req.user),
    listAll('tasks', 'updated_at'),
    listAll('interviews', 'scheduled_at'),
    listAll('submissions', 'submitted_at'),
    listAll('notifications', 'created_at'),
    listAll('activity_log', 'created_at'),
    listUsers()
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const myTasks = normalizeRole(req.user.role) === 'recruiter'
    ? tasks.filter((row) => row.assigned_to_user_id === req.user.user_id)
    : tasks;
  const myNotifications = notifications.filter((row) => !row.user_id || row.user_id === req.user.user_id);
  const myActivity = isPrivileged(req.user)
    ? activity.slice(0, 12)
    : activity.filter((row) => row.user_id === req.user.user_id).slice(0, 12);
  const summary = {
    candidateCount: candidates.length,
    openTasks: myTasks.filter((row) => !['Done', 'Closed', 'Completed'].includes(row.status)).length,
    interviewsToday: interviews.filter((row) => String(row.scheduled_at || '').slice(0, 10) === today).length,
    pendingApprovals: submissions.filter((row) => (row.approval_status || 'Pending') === 'Pending').length,
    unreadNotifications: myNotifications.filter((row) => (row.status || 'Unread') !== 'Read').length,
    activeRecruiters: users.filter((row) => normalizeRole(row.role) === 'recruiter' && toBool(row.is_active || '1')).length,
    recentActivity: myActivity,
    latestCandidates: candidates.slice(0, 8)
  };
  res.json(summary);
}));

app.get('/api/users', requireAuth, asyncRoute(async (req, res) => {
  if (!isPrivileged(req.user)) {
    return res.json({ rows: [req.user] });
  }
  const rows = await listUsers();
  res.json({ rows: rows.map(stripPassword) });
}));

app.post('/api/users', requireAuth, requireManager, asyncRoute(async (req, res) => {
  const base = normalizeUserInput(req.body);
  const password = sanitizeText(req.body.password);
  if (!base.username || !password || !base.full_name) {
    return res.status(400).json({ error: 'Username, full name, and password are required.' });
  }
  const existing = await getUserByUsername(base.username);
  if (existing) return res.status(409).json({ error: 'Username already exists.' });
  const created = await tableInsert('users', { ...base, password: await bcrypt.hash(password, 10) });
  await logActivity(req.user, 'user_create', '', { target: created.username });
  res.status(201).json({ row: stripPassword(created) });
}));

app.put('/api/users/:userId', requireAuth, asyncRoute(async (req, res) => {
  const target = await getUserById(req.params.userId);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const selfEdit = req.user.user_id === target.user_id;
  if (!selfEdit && !canManageUsers(req.user)) {
    return res.status(403).json({ error: 'Not allowed.' });
  }
  const patch = {};
  if (selfEdit && req.body.theme_name !== undefined) patch.theme_name = sanitizeText(req.body.theme_name);
  if (canManageUsers(req.user)) {
    ['full_name', 'designation', 'recruiter_code', 'is_active', 'theme_name'].forEach((key) => {
      if (req.body[key] !== undefined) patch[key] = sanitizeText(req.body[key]);
    });
    if (req.body.role !== undefined) patch.role = normalizeRole(req.body.role);
    if (req.body.password) patch.password = await bcrypt.hash(sanitizeText(req.body.password), 10);
  }
  patch.updated_at = nowIso();
  const updated = await tableUpdate('users', 'user_id', target.user_id, patch);
  await logActivity(req.user, 'user_update', '', { target: updated.username });
  res.json({ row: stripPassword(updated) });
}));

app.get('/api/candidates', requireAuth, asyncRoute(async (req, res) => {
  const rows = await getVisibleCandidates(req.user);
  const q = sanitizeText(req.query.q).toLowerCase();
  const status = sanitizeText(req.query.status);
  const recruiterCode = sanitizeText(req.query.recruiter_code);
  const page = Math.max(Number(req.query.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(req.query.pageSize || 20), 1), 100);
  let filtered = rows;
  if (status) filtered = filtered.filter((row) => row.status === status);
  if (recruiterCode && isPrivileged(req.user)) filtered = filtered.filter((row) => sanitizeText(row.recruiter_code) === recruiterCode);
  if (q) {
    filtered = filtered.filter((row) => [row.candidate_id, row.full_name, row.phone, row.process, row.location, row.recruiter_name, row.status].join(' ').toLowerCase().includes(q));
  }
  filtered.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
  const total = filtered.length;
  const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
  res.json({ rows: slice, total, page, pageSize });
}));

app.post('/api/candidates', requireAuth, asyncRoute(async (req, res) => {
  const row = normalizeCandidateInput(req.body, req.user);
  const existingRows = await getVisibleCandidates(req.user);
  const existing = existingRows.find((item) => item.candidate_id === row.candidate_id);
  const saved = await tableUpsert('candidates', row, 'candidate_id');
  await logActivity(req.user, existing ? 'candidate_update' : 'candidate_create', saved.candidate_id, { name: saved.full_name });
  res.status(existing ? 200 : 201).json({ row: saved });
}));

app.put('/api/candidates/:candidateId', requireAuth, asyncRoute(async (req, res) => {
  const rows = await getVisibleCandidates(req.user);
  const current = rows.find((row) => row.candidate_id === req.params.candidateId);
  if (!current) return res.status(404).json({ error: 'Candidate not found.' });
  const payload = normalizeCandidateInput({ ...current, ...req.body, candidate_id: current.candidate_id }, req.user);
  const updated = await tableUpdate('candidates', 'candidate_id', current.candidate_id, payload);
  await logActivity(req.user, 'candidate_update', updated.candidate_id, { name: updated.full_name });
  res.json({ row: updated });
}));

app.delete('/api/candidates/:candidateId', requireAuth, asyncRoute(async (req, res) => {
  const rows = await getVisibleCandidates(req.user);
  const current = rows.find((row) => row.candidate_id === req.params.candidateId);
  if (!current) return res.status(404).json({ error: 'Candidate not found.' });
  if (!isPrivileged(req.user)) return res.status(403).json({ error: 'Only manager or TL can delete candidates.' });
  await tableDelete('candidates', 'candidate_id', current.candidate_id);
  await logActivity(req.user, 'candidate_delete', current.candidate_id, { name: current.full_name });
  res.json({ ok: true });
}));

app.get('/api/candidates/:candidateId/notes', requireAuth, asyncRoute(async (req, res) => {
  const visible = await getVisibleCandidates(req.user);
  const current = visible.find((row) => row.candidate_id === req.params.candidateId);
  if (!current) return res.status(404).json({ error: 'Candidate not found.' });
  const { data, error } = await supabase.from('notes').select('*').eq('candidate_id', current.candidate_id).order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data || []).filter((note) => (isPrivileged(req.user) ? true : note.note_type !== 'private' || note.username === req.user.username));
  res.json({ rows });
}));

app.post('/api/candidates/:candidateId/notes', requireAuth, asyncRoute(async (req, res) => {
  const visible = await getVisibleCandidates(req.user);
  const current = visible.find((row) => row.candidate_id === req.params.candidateId);
  if (!current) return res.status(404).json({ error: 'Candidate not found.' });
  const body = sanitizeText(req.body.body);
  if (!body) return res.status(400).json({ error: 'Note body is required.' });
  const note = await tableInsert('notes', {
    candidate_id: current.candidate_id,
    username: req.user.username,
    note_type: sanitizeText(req.body.note_type) || 'public',
    body,
    created_at: nowIso()
  });
  await logActivity(req.user, 'candidate_note', current.candidate_id, { note_type: note.note_type });
  res.status(201).json({ row: note });
}));

app.post('/api/candidates/import', requireAuth, upload.single('file'), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload an Excel file first.' });
  const importedRows = parseWorkbookCandidates(req.file.buffer);
  let inserted = 0;
  for (const raw of importedRows) {
    const row = normalizeCandidateInput(raw, req.user);
    await tableUpsert('candidates', row, 'candidate_id');
    inserted += 1;
  }
  await logActivity(req.user, 'candidate_import', '', { count: inserted, file: req.file.originalname });
  res.json({ ok: true, inserted });
}));

app.get('/api/candidates/export', requireAuth, asyncRoute(async (req, res) => {
  const rows = await getVisibleCandidates(req.user);
  const q = sanitizeText(req.query.q).toLowerCase();
  const status = sanitizeText(req.query.status);
  const recruiterCode = sanitizeText(req.query.recruiter_code);
  let filtered = rows;
  if (status) filtered = filtered.filter((row) => row.status === status);
  if (recruiterCode && isPrivileged(req.user)) filtered = filtered.filter((row) => row.recruiter_code === recruiterCode);
  if (q) filtered = filtered.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
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

app.post('/api/dialer/log', requireAuth, asyncRoute(async (req, res) => {
  const candidateId = sanitizeText(req.body.candidate_id);
  const action = sanitizeText(req.body.action) || 'dialer_action';
  await logActivity(req.user, action, candidateId, { phone: sanitizeText(req.body.phone) });
  res.json({ ok: true });
}));

app.get('/api/tasks', requireAuth, asyncRoute(async (req, res) => {
  const rows = await listAll('tasks', 'updated_at');
  const scoped = isPrivileged(req.user) ? rows : rows.filter((row) => row.assigned_to_user_id === req.user.user_id);
  res.json({ rows: scoped });
}));

app.post('/api/tasks', requireAuth, asyncRoute(async (req, res) => {
  if (!isPrivileged(req.user) && sanitizeText(req.body.assigned_to_user_id) !== req.user.user_id) {
    return res.status(403).json({ error: 'You can only create tasks for yourself.' });
  }
  const saved = await tableUpsert('tasks', normalizeTaskInput(req.body, req.user), 'task_id');
  await logActivity(req.user, 'task_save', '', { task_id: saved.task_id, title: saved.title });
  res.status(201).json({ row: saved });
}));

app.put('/api/tasks/:taskId', requireAuth, asyncRoute(async (req, res) => {
  const rows = await listAll('tasks', 'updated_at');
  const current = rows.find((row) => row.task_id === req.params.taskId);
  if (!current) return res.status(404).json({ error: 'Task not found.' });
  if (!isPrivileged(req.user) && current.assigned_to_user_id !== req.user.user_id) return res.status(403).json({ error: 'Not allowed.' });
  const updated = await tableUpdate('tasks', 'task_id', current.task_id, normalizeTaskInput({ ...current, ...req.body, task_id: current.task_id }, req.user));
  await logActivity(req.user, 'task_update', '', { task_id: current.task_id });
  res.json({ row: updated });
}));

app.get('/api/jds', requireAuth, asyncRoute(async (_req, res) => {
  const rows = await listAll('jd_master', 'created_at');
  res.json({ rows });
}));

app.post('/api/jds', requireAuth, requirePrivileged, asyncRoute(async (req, res) => {
  const saved = await tableUpsert('jd_master', normalizeJdInput(req.body), 'jd_id');
  await logActivity(req.user, 'jd_save', '', { jd_id: saved.jd_id });
  res.status(201).json({ row: saved });
}));

app.put('/api/jds/:jdId', requireAuth, requirePrivileged, asyncRoute(async (req, res) => {
  const rows = await listAll('jd_master', 'created_at');
  const current = rows.find((row) => row.jd_id === req.params.jdId);
  if (!current) return res.status(404).json({ error: 'JD not found.' });
  const updated = await tableUpdate('jd_master', 'jd_id', current.jd_id, normalizeJdInput({ ...current, ...req.body, jd_id: current.jd_id }));
  await logActivity(req.user, 'jd_update', '', { jd_id: current.jd_id });
  res.json({ row: updated });
}));

app.get('/api/interviews', requireAuth, asyncRoute(async (_req, res) => {
  const rows = await listAll('interviews', 'scheduled_at');
  res.json({ rows });
}));

app.post('/api/interviews', requireAuth, requirePrivileged, asyncRoute(async (req, res) => {
  const saved = await tableUpsert('interviews', normalizeInterviewInput(req.body), 'interview_id');
  await logActivity(req.user, 'interview_save', sanitizeText(saved.candidate_id), { interview_id: saved.interview_id });
  res.status(201).json({ row: saved });
}));

app.put('/api/interviews/:interviewId', requireAuth, requirePrivileged, asyncRoute(async (req, res) => {
  const rows = await listAll('interviews', 'scheduled_at');
  const current = rows.find((row) => row.interview_id === req.params.interviewId);
  if (!current) return res.status(404).json({ error: 'Interview not found.' });
  const updated = await tableUpdate('interviews', 'interview_id', current.interview_id, normalizeInterviewInput({ ...current, ...req.body, interview_id: current.interview_id }));
  await logActivity(req.user, 'interview_update', sanitizeText(updated.candidate_id), { interview_id: updated.interview_id });
  res.json({ row: updated });
}));

app.get('/api/submissions', requireAuth, asyncRoute(async (req, res) => {
  const rows = await listAll('submissions', 'submitted_at');
  const scoped = isPrivileged(req.user) ? rows : rows.filter((row) => row.recruiter_code === req.user.recruiter_code);
  res.json({ rows: scoped });
}));

app.post('/api/submissions', requireAuth, asyncRoute(async (req, res) => {
  const saved = await tableUpsert('submissions', normalizeSubmissionInput(req.body, req.user), 'submission_id');
  await logActivity(req.user, 'submission_save', sanitizeText(saved.candidate_id), { submission_id: saved.submission_id });
  res.status(201).json({ row: saved });
}));

app.put('/api/submissions/:submissionId', requireAuth, asyncRoute(async (req, res) => {
  const rows = await listAll('submissions', 'submitted_at');
  const current = rows.find((row) => row.submission_id === req.params.submissionId);
  if (!current) return res.status(404).json({ error: 'Submission not found.' });
  if (!isPrivileged(req.user) && current.recruiter_code !== req.user.recruiter_code) return res.status(403).json({ error: 'Not allowed.' });
  const payload = normalizeSubmissionInput({ ...current, ...req.body, submission_id: current.submission_id }, req.user);
  if (isPrivileged(req.user) && payload.approval_status === 'Approved') {
    payload.approved_by_name = req.user.full_name || req.user.username;
    payload.approved_at = nowIso();
  }
  const updated = await tableUpdate('submissions', 'submission_id', current.submission_id, payload);
  await logActivity(req.user, 'submission_update', sanitizeText(updated.candidate_id), { submission_id: updated.submission_id });
  res.json({ row: updated });
}));

app.get('/api/notifications', requireAuth, asyncRoute(async (req, res) => {
  const rows = await listAll('notifications', 'created_at');
  const scoped = rows.filter((row) => !row.user_id || row.user_id === req.user.user_id);
  res.json({ rows: scoped });
}));

app.post('/api/notifications', requireAuth, requirePrivileged, asyncRoute(async (req, res) => {
  const saved = await tableInsert('notifications', {
    notification_id: buildId('NTF'),
    user_id: sanitizeText(req.body.user_id),
    title: sanitizeText(req.body.title),
    message: sanitizeText(req.body.message),
    category: sanitizeText(req.body.category) || 'General',
    status: sanitizeText(req.body.status) || 'Unread',
    metadata: sanitizeText(req.body.metadata),
    created_at: nowIso()
  });
  await logActivity(req.user, 'notification_create', '', { notification_id: saved.notification_id });
  res.status(201).json({ row: saved });
}));

app.post('/api/notifications/mark-all-read', requireAuth, asyncRoute(async (req, res) => {
  const rows = await listAll('notifications', 'created_at');
  const myRows = rows.filter((row) => !row.user_id || row.user_id === req.user.user_id);
  await Promise.all(myRows.map((row) => tableUpdate('notifications', 'notification_id', row.notification_id, { status: 'Read' })));
  res.json({ ok: true, count: myRows.length });
}));

app.get('/api/settings', requireAuth, asyncRoute(async (_req, res) => {
  const rows = await listAll('settings', 'setting_key');
  res.json({ rows });
}));

app.put('/api/settings/:key', requireAuth, requireManager, asyncRoute(async (req, res) => {
  const row = {
    setting_key: req.params.key,
    setting_value: sanitizeText(req.body.setting_value),
    notes: sanitizeText(req.body.notes),
    Instructions: sanitizeText(req.body.Instructions)
  };
  const saved = await tableUpsert('settings', row, 'setting_key');
  await logActivity(req.user, 'setting_update', '', { setting_key: saved.setting_key });
  res.json({ row: saved });
}));

app.get('/api/activity', requireAuth, asyncRoute(async (req, res) => {
  const rows = await listAll('activity_log', 'created_at');
  const scoped = isPrivileged(req.user) ? rows.slice(0, 100) : rows.filter((row) => row.user_id === req.user.user_id).slice(0, 100);
  res.json({ rows: scoped });
}));

app.get('/api/search', requireAuth, asyncRoute(async (req, res) => {
  const q = sanitizeText(req.query.q).toLowerCase();
  if (!q) return res.json({ candidates: [], tasks: [], jds: [] });
  const [candidates, tasks, jds] = await Promise.all([
    getVisibleCandidates(req.user),
    listAll('tasks', 'updated_at'),
    listAll('jd_master', 'created_at')
  ]);
  const visibleTasks = isPrivileged(req.user) ? tasks : tasks.filter((row) => row.assigned_to_user_id === req.user.user_id);
  res.json({
    candidates: candidates.filter((row) => JSON.stringify(row).toLowerCase().includes(q)).slice(0, 8),
    tasks: visibleTasks.filter((row) => JSON.stringify(row).toLowerCase().includes(q)).slice(0, 8),
    jds: jds.filter((row) => JSON.stringify(row).toLowerCase().includes(q)).slice(0, 8)
  });
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
