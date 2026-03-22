import { useEffect, useMemo, useState } from 'react';

const modules = [
  ['dashboard', 'Dashboard'],
  ['candidates', 'Candidates'],
  ['approvals', 'Approvals'],
  ['submissions', 'Submissions'],
  ['jds', 'JD Centre'],
  ['interviews', 'Interviews'],
  ['tasks', 'Tasks'],
  ['dialer', 'Dialer'],
  ['attendance', 'Attendance'],
  ['notifications', 'Notifications'],
  ['chat', 'Team Chat'],
  ['clientPipeline', 'Client Pipeline'],
  ['clientRequirements', 'Client Requirements'],
  ['revenue', 'Revenue Hub'],
  ['reports', 'Reports'],
  ['performance', 'Performance Centre'],
  ['users', 'Team'],
  ['settings', 'Settings'],
  ['activity', 'Recent Activity']
];

const themeOptions = [
  { value: 'premium-sunrise', label: 'Premium Sunrise' },
  { value: 'ocean-blue', label: 'Ocean Blue' },
  { value: 'soft-light', label: 'Soft Light' }
];

const supportedThemes = new Set(themeOptions.map((option) => option.value));

function normalizeTheme(theme) {
  const value = String(theme || '').trim();
  return supportedThemes.has(value) ? value : 'premium-sunrise';
}

const resourceConfig = {
  tasks: {
    title: 'Tasks',
    subtitle: 'Assignments with fast tracking and clear ownership.',
    columns: [['task_id', 'ID'], ['title', 'Title'], ['assigned_to_name', 'Assigned'], ['status', 'Status'], ['priority', 'Priority'], ['due_date', 'Due date'], ['updated_at', 'Updated']],
    fields: [['title', 'Title'], ['description', 'Description', 'textarea'], ['assigned_to_user_id', 'Assigned user ID'], ['assigned_to_name', 'Assigned name'], ['status', 'Status'], ['priority', 'Priority'], ['due_date', 'Due date']]
  },
  jds: {
    title: 'JD Centre',
    subtitle: 'Manage all job descriptions in one clean workspace.',
    columns: [['jd_id', 'ID'], ['job_title', 'Job title'], ['company', 'Company'], ['location', 'Location'], ['experience', 'Experience'], ['salary', 'Salary'], ['jd_status', 'Status']],
    fields: [['job_title', 'Job title'], ['company', 'Company'], ['location', 'Location'], ['experience', 'Experience'], ['salary', 'Salary'], ['pdf_url', 'JD URL'], ['jd_status', 'Status'], ['notes', 'Notes', 'textarea']]
  },
  interviews: {
    title: 'Interviews',
    subtitle: 'Schedule and track interviews from one place.',
    columns: [['interview_id', 'ID'], ['candidate_id', 'Candidate'], ['jd_id', 'JD'], ['stage', 'Stage'], ['scheduled_at', 'Scheduled at'], ['status', 'Status']],
    fields: [['candidate_id', 'Candidate ID'], ['jd_id', 'JD ID'], ['stage', 'Stage'], ['scheduled_at', 'Scheduled at'], ['status', 'Status']]
  },
  submissions: {
    title: 'Submissions',
    subtitle: 'Track recruiter ownership and approval status.',
    columns: [['submission_id', 'ID'], ['candidate_id', 'Candidate'], ['jd_id', 'JD'], ['recruiter_code', 'Recruiter'], ['status', 'Status'], ['approval_status', 'Approval'], ['submitted_at', 'Submitted']],
    fields: [['candidate_id', 'Candidate ID'], ['jd_id', 'JD ID'], ['recruiter_code', 'Recruiter code'], ['status', 'Status'], ['approval_status', 'Approval status'], ['decision_note', 'Decision note', 'textarea'], ['submitted_at', 'Submitted at']]
  },
  notifications: {
    title: 'Notifications',
    subtitle: 'Alerts, reminders, and updates in one feed.',
    columns: [['notification_id', 'ID'], ['title', 'Title'], ['message', 'Message'], ['category', 'Category'], ['status', 'Status'], ['created_at', 'Created']],
    fields: [['user_id', 'User ID (blank for all)'], ['title', 'Title'], ['message', 'Message', 'textarea'], ['category', 'Category'], ['status', 'Status'], ['metadata', 'Metadata JSON', 'textarea']]
  },
  clientPipeline: {
    title: 'Client Pipeline',
    subtitle: 'Leads, follow-ups, and openings in one fast lane.',
    columns: [['lead_id', 'ID'], ['client_name', 'Client'], ['contact_person', 'Contact'], ['city', 'City'], ['industry', 'Industry'], ['status', 'Status'], ['openings_count', 'Openings'], ['next_follow_up_at', 'Next follow-up']],
    fields: [['client_name', 'Client name'], ['contact_person', 'Contact person'], ['contact_phone', 'Contact phone'], ['city', 'City'], ['industry', 'Industry'], ['status', 'Status'], ['owner_username', 'Owner username'], ['priority', 'Priority'], ['openings_count', 'Openings count'], ['last_follow_up_at', 'Last follow-up'], ['next_follow_up_at', 'Next follow-up'], ['notes', 'Notes', 'textarea']]
  },
  clientRequirements: {
    title: 'Client Requirements',
    subtitle: 'Open positions under each client lead.',
    columns: [['req_id', 'ID'], ['lead_id', 'Lead'], ['jd_title', 'JD title'], ['city', 'City'], ['openings', 'Openings'], ['target_ctc', 'Target CTC'], ['status', 'Status'], ['fill_target_date', 'Fill target']],
    fields: [['lead_id', 'Lead ID'], ['jd_title', 'JD title'], ['city', 'City'], ['openings', 'Openings'], ['target_ctc', 'Target CTC'], ['status', 'Status'], ['assigned_tl', 'Assigned TL'], ['assigned_manager', 'Assigned manager'], ['fill_target_date', 'Fill target date']]
  },
  revenue: {
    title: 'Revenue Hub',
    subtitle: 'Billing, collections, and payout reality checks.',
    columns: [['rev_id', 'ID'], ['client_name', 'Client'], ['candidate_id', 'Candidate'], ['recruiter_code', 'Recruiter'], ['amount_billed', 'Billed'], ['amount_collected', 'Collected'], ['invoice_status', 'Invoice'], ['expected_payout_date', 'Payout date']],
    fields: [['client_name', 'Client name'], ['candidate_id', 'Candidate ID'], ['jd_id', 'JD ID'], ['recruiter_code', 'Recruiter code'], ['amount_billed', 'Amount billed'], ['amount_collected', 'Amount collected'], ['invoice_status', 'Invoice status'], ['billing_month', 'Billing month'], ['joined_at', 'Joined at'], ['expected_payout_date', 'Expected payout date'], ['source_channel', 'Source channel']]
  },
  reports: {
    title: 'Scheduled Reports',
    subtitle: 'Create and download recurring reports quickly.',
    columns: [['report_id', 'ID'], ['title', 'Title'], ['report_type', 'Type'], ['file_format', 'Format'], ['frequency_minutes', 'Frequency'], ['status', 'Status'], ['next_run_at', 'Next run']],
    fields: [['title', 'Title'], ['report_type', 'Report type'], ['filters_json', 'Filters JSON', 'textarea'], ['file_format', 'File format'], ['frequency_minutes', 'Frequency minutes'], ['status', 'Status'], ['next_run_at', 'Next run at']]
  },
  users: {
    title: 'Team',
    subtitle: 'Manager and TL visibility with fast access controls.',
    columns: [['user_id', 'ID'], ['full_name', 'Full name'], ['username', 'Username'], ['designation', 'Designation'], ['role', 'Role'], ['recruiter_code', 'Recruiter code'], ['is_active', 'Active']],
    fields: [['full_name', 'Full name'], ['username', 'Username'], ['password', 'Password'], ['designation', 'Designation'], ['role', 'Role'], ['recruiter_code', 'Recruiter code'], ['is_active', 'Is active'], ['theme_name', 'Theme name']]
  },
  settings: {
    title: 'Settings',
    subtitle: 'Global settings for the full CRM workspace.',
    columns: [['setting_key', 'Key'], ['setting_value', 'Value'], ['notes', 'Notes'], ['Instructions', 'Instructions']],
    fields: [['setting_key', 'Key'], ['setting_value', 'Value'], ['notes', 'Notes'], ['Instructions', 'Instructions', 'textarea']]
  },
  activity: {
    title: 'Recent Activity',
    subtitle: 'The useful audit trail.',
    columns: [['activity_id', 'ID'], ['username', 'User'], ['action_type', 'Action'], ['candidate_id', 'Candidate'], ['created_at', 'Created'], ['metadata', 'Metadata']],
    fields: []
  }
};

const candidateFields = [
  ['full_name', 'Full name'],
  ['phone', 'Phone'],
  ['qualification', 'Qualification'],
  ['location', 'Current location'],
  ['preferred_location', 'Preferred location'],
  ['qualification_level', 'Qualification level'],
  ['total_experience', 'Total experience'],
  ['relevant_experience', 'Relevant experience'],
  ['in_hand_salary', 'In hand salary'],
  ['documents_availability', 'Documents available'],
  ['communication_skill', 'Communication'],
  ['process', 'Process'],
  ['status', 'Status'],
  ['recruiter_code', 'Recruiter code'],
  ['recruiter_name', 'Recruiter name'],
  ['submission_date', 'Submission date'],
  ['follow_up_at', 'Follow-up at'],
  ['approval_status', 'Approval status'],
  ['notes', 'Notes', 'textarea']
];

function cleanPhoneDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `91${digits}` : digits;
}

function openCallWindow(phone) {
  const digits = String(phone || '').replace(/\s+/g, '');
  if (!digits) return;
  window.open(`tel:${digits}`, '_self');
}

function openWhatsAppWindow(phone) {
  const digits = cleanPhoneDigits(phone);
  if (!digits) return;
  window.open(`https://wa.me/${digits}`, '_blank', 'noopener,noreferrer');
}

function qs(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  return search.toString();
}

function useNotice() {
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  return [notice, setNotice];
}

function App() {
  const [boot, setBoot] = useState({ loading: true, dbReady: false, hasUsers: false, message: '' });
  const [user, setUser] = useState(null);
  const [active, setActive] = useState('dashboard');
  const [theme, setTheme] = useState(normalizeTheme(localStorage.getItem('career_crox_theme')));
  const [notice, setNotice] = useNotice();
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState({ candidates: [], tasks: [], jds: [], clients: [], messages: [] });
  const [refreshKey, setRefreshKey] = useState(0);

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'include',
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || {})
      },
      ...options
    });
    if (response.status === 401) {
      setUser(null);
      throw new Error('Session expired. Please log in again.');
    }
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.blob();
    if (!response.ok) throw new Error(payload?.error || 'Request failed');
    return payload;
  }

  async function loadBoot() {
    try {
      const status = await api('/api/bootstrap/status', { headers: {} });
      setBoot({ loading: false, ...status });
      if (status.dbReady && status.hasUsers) {
        try {
          const me = await api('/api/auth/me', { headers: {} });
          setUser(me.user);
          setTheme(normalizeTheme(me.user.theme_name || localStorage.getItem('career_crox_theme')));
        } catch {
          setUser(null);
        }
      }
    } catch (error) {
      setBoot({ loading: false, dbReady: false, hasUsers: false, message: error.message });
    }
  }

  useEffect(() => {
    loadBoot();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('career_crox_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!user) return undefined;
    const timer = setInterval(() => {
      api('/api/attendance/ping', { method: 'POST', body: JSON.stringify({ last_page: active }) }).catch(() => {});
    }, 120000);
    return () => clearInterval(timer);
  }, [user, active]);

  async function handleLogin(form) {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(form) });
    setUser(data.user);
    setTheme(normalizeTheme(data.user.theme_name || theme));
    setNotice({ type: 'success', text: 'Logged in.' });
  }

  async function handleBootstrap(form) {
    const data = await api('/api/bootstrap', { method: 'POST', body: JSON.stringify(form) });
    setUser(data.user);
    setBoot({ loading: false, dbReady: true, hasUsers: true, message: '' });
    setNotice({ type: 'success', text: 'First manager account created.' });
  }

  async function handleLogout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setUser(null);
    setSearchOpen(false);
    setSearchText('');
  }

  async function runSearch() {
    if (!searchText.trim()) return;
    try {
      const data = await api(`/api/search?${qs({ q: searchText })}`, { headers: {} });
      setSearchResults(data);
      setSearchOpen(true);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  if (boot.loading) return <SplashScreen text="Loading Career Crox CRM. Please wait." />;
  if (!boot.dbReady) return <EnvMissingScreen message={boot.message} />;
  if (!boot.hasUsers) return <SetupScreen onSubmit={handleBootstrap} />;
  if (!user) return <LoginScreen onSubmit={handleLogin} />;

  return (
    <div className="app-shell">
      <Sidebar active={active} setActive={setActive} user={user} onLogout={handleLogout} />
      <main className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">Career Crox Premium CRM</p>
            <h1>{modules.find(([key]) => key === active)?.[1] || 'Workspace'}</h1>
          </div>
          <div className="topbar-actions">
            <div className="search-box">
              <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search candidate, task, JD, client..." onKeyDown={(event) => event.key === 'Enter' && runSearch()} />
              <button className="secondary-btn" onClick={runSearch}>Search</button>
            </div>
            <select value={theme} onChange={async (event) => {
              const nextTheme = normalizeTheme(event.target.value);
              setTheme(nextTheme);
              try {
                await api(`/api/module/users/${user.user_id}`, { method: 'PUT', body: JSON.stringify({ theme_name: nextTheme }) });
                setUser((current) => ({ ...current, theme_name: nextTheme }));
              } catch {
                // local only is fine
              }
            }}>
              {themeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </header>

        {notice ? <div className={`notice ${notice.type}`}>{notice.text}</div> : null}
        {searchOpen ? <SearchOverlay results={searchResults} searchText={searchText} onClose={() => setSearchOpen(false)} /> : null}

        {active === 'dashboard' ? <DashboardView api={api} refreshKey={refreshKey} user={user} /> : null}
        {active === 'candidates' ? <CandidatesView api={api} user={user} setNotice={setNotice} bump={() => setRefreshKey((n) => n + 1)} /> : null}
        {active === 'approvals' ? <ApprovalsView api={api} setNotice={setNotice} bump={() => setRefreshKey((n) => n + 1)} /> : null}
        {active === 'dialer' ? <DialerView api={api} setNotice={setNotice} /> : null}
        {active === 'attendance' ? <AttendanceView api={api} user={user} setNotice={setNotice} /> : null}
        {active === 'chat' ? <ChatView api={api} user={user} setNotice={setNotice} /> : null}
        {active === 'reports' ? <ReportsView api={api} user={user} setNotice={setNotice} /> : null}
        {active === 'performance' ? <PerformanceView api={api} /> : null}
        {['tasks', 'jds', 'interviews', 'submissions', 'notifications', 'clientPipeline', 'clientRequirements', 'revenue', 'users', 'settings', 'activity'].includes(active) ? (
          <ResourceView api={api} moduleKey={active} config={resourceConfig[active]} user={user} setNotice={setNotice} />
        ) : null}
      </main>
    </div>
  );
}

function SplashScreen({ text }) {
  return (
    <div className="center-screen">
      <div className="auth-card glass-card narrow-card">
        <img src="/logo.png" alt="Career Crox" className="auth-logo" />
        <h1>Career Crox CRM</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}

function EnvMissingScreen({ message }) {
  return (
    <div className="center-screen">
      <div className="auth-card glass-card env-card">
        <img src="/brand.png" alt="Career Crox" className="brand-image" />
        <h1>Environment setup needed</h1>
        <p>This build is React on the front and Node on the back. It still needs Supabase keys because databases stubbornly refuse to read minds.</p>
        <div className="code-block">
          <div>SUPABASE_URL=your_project_url</div>
          <div>SUPABASE_SERVICE_ROLE_KEY=your_service_role_key</div>
          <div>JWT_SECRET=any_long_random_secret</div>
        </div>
        <p className="muted-text">Server says: {message || 'Supabase env vars are missing.'}</p>
      </div>
    </div>
  );
}

function SetupScreen({ onSubmit }) {
  const [form, setForm] = useState({ full_name: '', username: '', password: '', designation: 'Manager', recruiter_code: 'ADMIN' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="auth-card glass-card" onSubmit={handleSubmit}>
        <img src="/brand.png" alt="Career Crox" className="brand-image" />
        <h1>First-time setup</h1>
        <p>Create the first manager account. No demo circus.</p>
        <Field label="Full name" value={form.full_name} onChange={(value) => setForm({ ...form, full_name: value })} />
        <Field label="Username" value={form.username} onChange={(value) => setForm({ ...form, username: value })} />
        <Field label="Password" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
        <Field label="Designation" value={form.designation} onChange={(value) => setForm({ ...form, designation: value })} />
        <Field label="Recruiter code" value={form.recruiter_code} onChange={(value) => setForm({ ...form, recruiter_code: value })} />
        {error ? <div className="form-error">{error}</div> : null}
        <button className="primary-btn" disabled={loading}>{loading ? 'Creating...' : 'Create manager account'}</button>
      </form>
    </div>
  );
}

function LoginScreen({ onSubmit }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="auth-card glass-card" onSubmit={handleSubmit}>
        <img src="/brand.png" alt="Career Crox" className="brand-image" />
        <h1>Welcome back</h1>
        <p>Fast React UI, Node API, and fewer full-page tantrums.</p>
        <Field label="Username" value={form.username} onChange={(value) => setForm({ ...form, username: value })} />
        <Field label="Password" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
        {error ? <div className="form-error">{error}</div> : null}
        <button className="primary-btn" disabled={loading}>{loading ? 'Signing in...' : 'Login'}</button>
      </form>
    </div>
  );
}

function Sidebar({ active, setActive, user, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/logo.png" alt="Career Crox" />
        <div>
          <h2>Career Crox</h2>
          <p>ATS + CRM</p>
        </div>
      </div>
      <div className="sidebar-user glass-card">
        <strong>{user.full_name || user.username}</strong>
        <span>{user.designation || user.role}</span>
        <small>{user.role} · {user.recruiter_code || 'No code'}</small>
      </div>
      <nav className="nav-list">
        {modules.map(([key, label]) => (
          <button key={key} className={active === key ? 'nav-btn active' : 'nav-btn'} onClick={() => setActive(key)}>{label}</button>
        ))}
      </nav>
      <button className="logout-btn" onClick={onLogout}>Logout</button>
    </aside>
  );
}

function DashboardView({ api, refreshKey, user }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    api('/api/dashboard/summary')
      .then((payload) => mounted && setData(payload))
      .catch(() => mounted && setData(null));
    return () => { mounted = false; };
  }, [refreshKey]);

  if (!data) return <PanelLoading label="Loading dashboard" />;

  return (
    <div className="stack">
      <section className="stats-grid wide-stats">
        <StatCard label="Candidates" value={data.candidateCount} />
        <StatCard label="Open Tasks" value={data.openTasks} />
        <StatCard label="Interviews Today" value={data.interviewsToday} />
        <StatCard label="Pending Approvals" value={data.pendingApprovals} />
        <StatCard label="Unread Notifications" value={data.unreadNotifications} />
        <StatCard label="Client Openings" value={data.clientOpenings} />
        <StatCard label="Billed" value={`₹${Number(data.billed || 0).toLocaleString()}`} />
        <StatCard label="Collected" value={`₹${Number(data.collected || 0).toLocaleString()}`} />
      </section>
      <section className="panel-grid two-col">
        <div className="panel glass-card">
          <PanelHeader title="Latest candidates" subtitle="Latest candidate entries with quick status visibility." />
          <SimpleList rows={data.latestCandidates} render={(row) => (
            <div className="list-row">
              <div>
                <strong>{row.full_name || 'Unnamed candidate'}</strong>
                <p>{row.phone || 'No phone'} · {row.process || 'No process'}</p>
              </div>
              <span className="pill">{row.status || 'New'}</span>
            </div>
          )} />
        </div>
        <div className="panel glass-card">
          <PanelHeader title="Recent activity" subtitle="Recent activity across the CRM." />
          <SimpleList rows={data.recentActivity} render={(row) => (
            <div className="list-row">
              <div>
                <strong>{row.action_type || 'action'}</strong>
                <p>{row.username || 'unknown'} · {formatDateTime(row.created_at)}</p>
              </div>
              <code>{row.candidate_id || '-'}</code>
            </div>
          )} />
        </div>
      </section>
      <section className="panel-grid two-col">
        <div className="panel glass-card">
          <PanelHeader title="Upcoming follow-ups" subtitle="Upcoming follow-ups that need action." />
          <SimpleList rows={data.pendingFollowups} render={(row) => (
            <div className="list-row">
              <div>
                <strong>{row.full_name}</strong>
                <p>{row.follow_up_at || 'No date'} · {row.follow_up_note || 'No note'}</p>
              </div>
              <span className="pill">{row.follow_up_status || 'Pending'}</span>
            </div>
          )} />
        </div>
        <div className="panel glass-card">
          <PanelHeader title="Revenue snapshot" subtitle={user.role === 'recruiter' ? 'Your visible payouts.' : 'Top recent billing lines.'} />
          <SimpleList rows={data.latestRevenue} render={(row) => (
            <div className="list-row">
              <div>
                <strong>{row.client_name || 'Unknown client'}</strong>
                <p>{row.recruiter_code || 'No recruiter'} · {row.invoice_status || 'Pending'}</p>
              </div>
              <span className="pill">₹{Number(row.amount_collected || row.amount_billed || 0).toLocaleString()}</span>
            </div>
          )} />
        </div>
      </section>
    </div>
  );
}


function CandidatesView({ api, user, setNotice, bump }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null);
  const [profileRow, setProfileRow] = useState(null);
  const [query, setQuery] = useState('');
  const [noteState, setNoteState] = useState(null);
  const [notes, setNotes] = useState([]);
  const [importing, setImporting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api(`/api/module/candidates?${qs({ q: query })}`);
      setRows(data.rows || []);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [query]);

  async function saveCandidate(payload) {
    try {
      const method = payload.candidate_id ? 'PUT' : 'POST';
      const url = payload.candidate_id ? `/api/module/candidates/${payload.candidate_id}` : '/api/module/candidates';
      await api(url, { method, body: JSON.stringify(payload) });
      setEditor(null);
      setNotice({ type: 'success', text: 'Candidate saved.' });
      load();
      bump();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  async function removeCandidate(row) {
    try {
      await api(`/api/module/candidates/${row.candidate_id}`, { method: 'DELETE' });
      setProfileRow(null);
      setNotice({ type: 'success', text: 'Candidate deleted.' });
      load();
      bump();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  async function openNotes(row) {
    setNoteState({ candidate: row, body: '', note_type: 'public' });
    try {
      const data = await api(`/api/candidates/${row.candidate_id}/notes`);
      setNotes(data.rows || []);
    } catch {
      setNotes([]);
    }
  }

  async function saveNote() {
    try {
      await api(`/api/candidates/${noteState.candidate.candidate_id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body: noteState.body, note_type: noteState.note_type })
      });
      setNotice({ type: 'success', text: 'Note added.' });
      openNotes(noteState.candidate);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  async function downloadFile(url, fallbackName) {
    const blob = await api(url, { headers: {} });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fallbackName;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function importFile(file) {
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await api('/api/candidates/import', { method: 'POST', body: formData });
      setNotice({ type: 'success', text: `${data.imported} candidates imported.` });
      load();
      bump();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setImporting(false);
    }
  }

  const metrics = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((row) => (row.follow_up_status || 'Pending') === 'Pending').length,
    approved: rows.filter((row) => row.approval_status === 'Approved').length,
    today: rows.filter((row) => String(row.submission_date || '').slice(0, 10) === new Date().toISOString().slice(0, 10)).length
  }), [rows]);

  const managerOnlyTools = user.role === 'manager';

  return (
    <div className="stack">
      <section className="stats-grid four-col">
        <StatCard label="Visible candidates" value={metrics.total} />
        <StatCard label="Pending follow-ups" value={metrics.pending} />
        <StatCard label="Approved" value={metrics.approved} />
        <StatCard label="Today submissions" value={metrics.today} />
      </section>
      <div className="panel glass-card">
        <PanelHeader title="Candidates" subtitle="Fast list in table form. Click anywhere on a row to open the full profile." />
        <div className="toolbar-row wrap-toolbar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search candidates" />
          <button className="primary-btn" onClick={() => setEditor({ recruiter_code: user.recruiter_code || '', recruiter_name: user.full_name || user.username, recruiter_designation: user.designation || 'Recruiter', status: 'New', approval_status: 'Pending' })}>Add candidate</button>
          {managerOnlyTools ? <button className="secondary-btn" onClick={() => downloadFile('/api/candidates/template', 'career-crox-candidate-template.xlsx')}>Template</button> : null}
          {managerOnlyTools ? <button className="secondary-btn" onClick={() => downloadFile('/api/candidates/export', 'career-crox-candidates.xlsx')}>Export</button> : null}
          {managerOnlyTools ? (
            <label className="secondary-btn file-btn">
              {importing ? 'Importing...' : 'Import Excel'}
              <input type="file" accept=".xlsx,.xls" onChange={(event) => importFile(event.target.files?.[0])} />
            </label>
          ) : null}
        </div>
        {loading ? <PanelLoading label="Loading candidates" /> : (
          <CandidateTable rows={rows} onRowOpen={setProfileRow} />
        )}
      </div>
      {editor ? <RecordModal title={editor.candidate_id ? 'Edit candidate' : 'Add candidate'} fields={candidateFields} value={editor} onClose={() => setEditor(null)} onChange={setEditor} onSave={saveCandidate} /> : null}
      {profileRow ? (
        <CandidateProfileModal
          candidate={profileRow}
          canDelete={user.role !== 'recruiter'}
          onClose={() => setProfileRow(null)}
          onEdit={() => { setProfileRow(null); setEditor(profileRow); }}
          onOpenNotes={() => { setProfileRow(null); openNotes(profileRow); }}
          onDelete={() => removeCandidate(profileRow)}
        />
      ) : null}
      {noteState ? <NotesModal state={noteState} setState={setNoteState} notes={notes} onClose={() => setNoteState(null)} onSave={saveNote} /> : null}
    </div>
  );
}

function CandidateTable({ rows, onRowOpen }) {
  const columns = [
    ['candidate_id', 'ID'],
    ['full_name', 'Full name'],
    ['phone', 'Phone'],
    ['process', 'Process'],
    ['status', 'Status'],
    ['follow_up_at', 'Follow-up'],
    ['approval_status', 'Approval'],
    ['recruiter_name', 'Recruiter']
  ];

  if (!rows?.length) return <EmptyState title="No records found" text="Try again after humans create some data." />;

  return (
    <div className="table-wrap candidate-table">
      <table>
        <thead>
          <tr>
            {columns.map(([key, label]) => <th key={key}>{label}</th>)}
            <th>Quick actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.candidate_id || index} onClick={() => onRowOpen(row)} className="clickable-row">
              {columns.map(([key]) => <td key={key}>{formatCell(row[key])}</td>)}
              <td className="actions-cell">
                <div className="row-actions icon-actions">
                  <button type="button" className="action-icon-btn" title="Open profile" onClick={(event) => { event.stopPropagation(); onRowOpen(row); }}>
                    <span className="action-icon">👤</span>
                  </button>
                  <button type="button" className="action-icon-btn" title="Call candidate" onClick={(event) => { event.stopPropagation(); openCallWindow(row.phone); }}>
                    <span className="action-icon">📞</span>
                  </button>
                  <button type="button" className="action-icon-btn whatsapp" title="WhatsApp candidate" onClick={(event) => { event.stopPropagation(); openWhatsAppWindow(row.phone); }}>
                    <span className="action-icon">WA</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CandidateProfileModal({ candidate, canDelete, onClose, onEdit, onOpenNotes, onDelete }) {
  const detailRows = [
    ['Candidate ID', candidate.candidate_id],
    ['Full name', candidate.full_name],
    ['Phone', candidate.phone],
    ['Qualification', candidate.qualification],
    ['Current location', candidate.location],
    ['Preferred location', candidate.preferred_location],
    ['Qualification level', candidate.qualification_level],
    ['Total experience', candidate.total_experience],
    ['Relevant experience', candidate.relevant_experience],
    ['In hand salary', candidate.in_hand_salary],
    ['Documents available', candidate.documents_availability],
    ['Communication', candidate.communication_skill],
    ['Process', candidate.process],
    ['Status', candidate.status],
    ['Recruiter code', candidate.recruiter_code],
    ['Recruiter name', candidate.recruiter_name],
    ['Submission date', candidate.submission_date],
    ['Follow-up at', candidate.follow_up_at],
    ['Follow-up status', candidate.follow_up_status],
    ['Approval status', candidate.approval_status],
    ['Notes', candidate.notes]
  ];

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="modal-card record-modal profile-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="overlay-head">
          <div>
            <h3>{candidate.full_name || 'Candidate profile'}</h3>
            <p>{candidate.candidate_id} · {candidate.phone || 'No phone'} · {candidate.process || 'No process'}</p>
          </div>
          <button type="button" className="secondary-btn" onClick={onClose}>Close</button>
        </div>

        <div className="summary-badges">
          <span className="summary-badge">{candidate.status || 'No status'}</span>
          <span className="summary-badge">{candidate.approval_status || 'No approval'}</span>
          <span className="summary-badge">{candidate.follow_up_status || 'No follow-up status'}</span>
          <span className="summary-badge">{candidate.recruiter_name || 'No recruiter'}</span>
        </div>

        <div className="candidate-detail-grid">
          <div className="candidate-detail-card">
            <h4>Profile details</h4>
            <table className="detail-table">
              <tbody>
                {detailRows.map(([label, value]) => (
                  <tr key={label}>
                    <th>{label}</th>
                    <td>{formatCell(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="profile-actions">
          <button type="button" className="primary-btn" onClick={onEdit}>Edit profile</button>
          <button type="button" className="secondary-btn" onClick={onOpenNotes}>Notes</button>
          <button type="button" className="secondary-btn" onClick={() => openCallWindow(candidate.phone)}>Call</button>
          <button type="button" className="secondary-btn" onClick={() => openWhatsAppWindow(candidate.phone)}>WhatsApp</button>
          {canDelete ? <button type="button" className="danger-link" onClick={onDelete}>Delete</button> : null}
        </div>
      </div>
    </div>
  );
}

function ApprovalsView({ api, setNotice, bump }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decisionNote, setDecisionNote] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api('/api/approvals');
      setRows(data.rows || []);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function decide(row, decision) {
    try {
      await api(`/api/approvals/${row.submission_id}`, { method: 'POST', body: JSON.stringify({ decision, decision_note: decisionNote }) });
      setNotice({ type: 'success', text: `Submission ${decision.toLowerCase()}.` });
      setDecisionNote('');
      load();
      bump();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  return (
    <div className="panel glass-card">
      <PanelHeader title="Approvals" subtitle="Pending submissions waiting for TL or manager judgment." />
      <div className="toolbar-row">
        <textarea value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} placeholder="Optional decision note" />
      </div>
      {loading ? <PanelLoading label="Loading approvals" /> : <DataTable columns={[
        ['submission_id', 'ID'], ['candidate_id', 'Candidate'], ['jd_id', 'JD'], ['recruiter_code', 'Recruiter'], ['status', 'Status'], ['approval_status', 'Approval']
      ]} rows={rows} renderActions={(row) => (
        <div className="row-actions">
          <button onClick={() => decide(row, 'Approved')}>Approve</button>
          <button className="danger-link" onClick={() => decide(row, 'Rejected')}>Reject</button>
        </div>
      )} />} 
    </div>
  );
}

function DialerView({ api, setNotice }) {
  const [rows, setRows] = useState([]);
  const [note, setNote] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');

  async function load() {
    try {
      const data = await api('/api/followups/upcoming');
      setRows(data.rows || []);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  useEffect(() => { load(); }, []);

  async function finishCall(row, outcome) {
    try {
      await api('/api/dialer/call/end', { method: 'POST', body: JSON.stringify({ candidate_id: row.candidate_id, phone: row.phone, outcome, follow_up_at: followUpAt, note, status: outcome === 'Connected' ? 'Connected' : row.status }) });
      setNotice({ type: 'success', text: 'Dialer update saved.' });
      setNote('');
      setFollowUpAt('');
      load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  async function addQuickNote(row) {
    try {
      await api('/api/dialer/note', { method: 'POST', body: JSON.stringify({ candidate_id: row.candidate_id, body: note }) });
      setNotice({ type: 'success', text: 'Dialer note saved.' });
      setNote('');
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  return (
    <div className="panel glass-card">
      <PanelHeader title="Dialer Command Center" subtitle="Connected calls, no response, callbacks, and less tab-switching nonsense." />
      <div className="toolbar-row">
        <input value={followUpAt} onChange={(event) => setFollowUpAt(event.target.value)} placeholder="Next follow-up date/time" />
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Quick call note" />
      </div>
      <DataTable columns={[
        ['candidate_id', 'ID'], ['full_name', 'Candidate'], ['phone', 'Phone'], ['process', 'Process'], ['follow_up_at', 'Follow-up'], ['follow_up_status', 'Follow-up status'], ['status', 'Status']
      ]} rows={rows} renderActions={(row) => (
        <div className="row-actions">
          <button onClick={() => finishCall(row, 'Connected')}>Connected</button>
          <button onClick={() => finishCall(row, 'No Response')}>No response</button>
          <button onClick={() => addQuickNote(row)}>Add note</button>
        </div>
      )} />
    </div>
  );
}

function AttendanceView({ api, user, setNotice }) {
  const [rows, setRows] = useState([]);
  const [breakReason, setBreakReason] = useState('Tea break');

  async function load() {
    try {
      const data = await api('/api/module/presence');
      setRows(data.rows || []);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  useEffect(() => { load(); }, []);

  async function action(url, body) {
    try {
      await api(url, { method: 'POST', body: JSON.stringify(body || {}) });
      setNotice({ type: 'success', text: 'Attendance updated.' });
      load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  const me = rows.find((row) => row.user_id === user.user_id);

  return (
    <div className="stack">
      <section className="stats-grid four-col">
        <StatCard label="My status" value={me?.is_on_break === '1' ? 'On break' : 'Active'} />
        <StatCard label="Last seen" value={formatDateTime(me?.last_seen_at)} />
        <StatCard label="Meeting joined" value={me?.meeting_joined === '1' ? 'Yes' : 'No'} />
        <StatCard label="Last page" value={me?.last_page || '-'} />
      </section>
      <div className="panel glass-card">
        <PanelHeader title="Attendance" subtitle="Breaks, meeting joins, and presence without popup overload." />
        <div className="toolbar-row wrap-toolbar">
          <input value={breakReason} onChange={(event) => setBreakReason(event.target.value)} placeholder="Break reason" />
          <button className="primary-btn" onClick={() => action('/api/attendance/start-break', { break_reason: breakReason })}>Start break</button>
          <button className="secondary-btn" onClick={() => action('/api/attendance/end-break')}>End break</button>
          <button className="secondary-btn" onClick={() => action('/api/attendance/join', { source: 'meeting-room' })}>Join meeting</button>
        </div>
        <DataTable columns={[
          ['user_id', 'User ID'], ['last_seen_at', 'Last seen'], ['last_page', 'Last page'], ['is_on_break', 'On break'], ['break_reason', 'Break reason'], ['meeting_joined', 'Meeting joined'], ['last_call_candidate_id', 'Last call candidate']
        ]} rows={rows} />
      </div>
    </div>
  );
}

function ChatView({ api, user, setNotice }) {
  const [overview, setOverview] = useState({ messages: [], groups: [], users: [] });
  const [form, setForm] = useState({ recipient_username: '', body: '', thread_type: 'direct', thread_key: '' });
  const [groupForm, setGroupForm] = useState({ title: '', usernames: '' });

  async function load() {
    try {
      const data = await api('/api/chat/overview');
      setOverview(data);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  useEffect(() => { load(); }, []);

  async function sendMessage(event) {
    event.preventDefault();
    try {
      await api('/api/module/messages', { method: 'POST', body: JSON.stringify({ ...form, thread_key: form.thread_type === 'group' ? form.thread_key : undefined }) });
      setForm({ recipient_username: '', body: '', thread_type: 'direct', thread_key: '' });
      load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  async function createGroup(event) {
    event.preventDefault();
    try {
      await api('/api/chat/create-group', { method: 'POST', body: JSON.stringify({ title: groupForm.title, usernames: groupForm.usernames.split(',').map((v) => v.trim()).filter(Boolean) }) });
      setGroupForm({ title: '', usernames: '' });
      setNotice({ type: 'success', text: 'Group created.' });
      load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  return (
    <div className="panel-grid two-col">
      <div className="panel glass-card">
        <PanelHeader title="Chat feed" subtitle="Direct messages and groups, minus the Flask detour." />
        <div className="chat-feed">
          {overview.messages.map((message) => (
            <div key={`${message.id}-${message.created_at}`} className={`chat-bubble ${message.sender_username === user.username ? 'mine' : ''}`}>
              <strong>{message.sender_username}</strong>
              <p>{message.body}</p>
              <small>{message.thread_type} · {message.recipient_username || message.thread_key || '-'} · {formatDateTime(message.created_at)}</small>
            </div>
          ))}
          {!overview.messages.length ? <EmptyState title="No messages yet" text="A suspiciously calm workplace." /> : null}
        </div>
      </div>
      <div className="stack">
        <form className="panel glass-card" onSubmit={sendMessage}>
          <PanelHeader title="Send message" subtitle="Direct or group message." />
          <Field label="Thread type" value={form.thread_type} onChange={(value) => setForm({ ...form, thread_type: value })} />
          {form.thread_type === 'group' ? (
            <Field label="Group ID" value={form.thread_key} onChange={(value) => setForm({ ...form, thread_key: value })} />
          ) : (
            <Field label="Recipient username" value={form.recipient_username} onChange={(value) => setForm({ ...form, recipient_username: value })} />
          )}
          <Field label="Message" type="textarea" value={form.body} onChange={(value) => setForm({ ...form, body: value })} />
          <button className="primary-btn">Send</button>
        </form>
        {['manager', 'tl'].includes(user.role) ? (
          <form className="panel glass-card" onSubmit={createGroup}>
            <PanelHeader title="Create group" subtitle="Comma-separated usernames." />
            <Field label="Group title" value={groupForm.title} onChange={(value) => setGroupForm({ ...groupForm, title: value })} />
            <Field label="Usernames" value={groupForm.usernames} onChange={(value) => setGroupForm({ ...groupForm, usernames: value })} />
            <button className="secondary-btn">Create group</button>
          </form>
        ) : null}
        <div className="panel glass-card">
          <PanelHeader title="Group list" subtitle="Current visible groups." />
          <SimpleList rows={overview.groups} render={(group) => (
            <div className="list-row">
              <div>
                <strong>{group.title}</strong>
                <p>{group.group_id}</p>
              </div>
              <span className="pill">{group.is_active === '0' ? 'Inactive' : 'Active'}</span>
            </div>
          )} />
        </div>
      </div>
    </div>
  );
}

function ReportsView({ api, user, setNotice }) {
  async function download(dataset) {
    try {
      const blob = await api(`/api/reports/generate?${qs({ dataset })}`);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `career-crox-${dataset}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  return (
    <div className="stack">
      <section className="stats-grid four-col">
        <StatCard label="Quick export" value="Candidates" />
        <StatCard label="Quick export" value="Submissions" />
        <StatCard label="Quick export" value="Revenue" />
        <StatCard label="Quick export" value="Pipeline" />
      </section>
      <div className="panel glass-card">
        <PanelHeader title="Download reports" subtitle={['manager', 'tl'].includes(user.role) ? 'One click exports from Supabase.' : 'Visible exports based on your role.'} />
        <div className="button-grid">
          <button className="primary-btn" onClick={() => download('candidates')}>Candidates report</button>
          <button className="secondary-btn" onClick={() => download('submissions')}>Submissions report</button>
          <button className="secondary-btn" onClick={() => download('revenue')}>Revenue report</button>
          <button className="secondary-btn" onClick={() => download('tasks')}>Tasks report</button>
          <button className="secondary-btn" onClick={() => download('pipeline')}>Pipeline report</button>
        </div>
      </div>
      <ResourceView api={api} moduleKey="reports" config={resourceConfig.reports} user={user} setNotice={setNotice} compact />
    </div>
  );
}

function PerformanceView({ api }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api('/api/module/users'),
      api('/api/module/candidates'),
      api('/api/module/tasks'),
      api('/api/module/submissions')
    ]).then(([users, candidates, tasks, submissions]) => {
      if (!mounted) return;
      const recruiters = (users.rows || []).filter((row) => row.role === 'recruiter');
      const tableRows = recruiters.map((recruiter) => {
        const recruiterCandidates = (candidates.rows || []).filter((row) => row.recruiter_code === recruiter.recruiter_code);
        const recruiterTasks = (tasks.rows || []).filter((row) => row.assigned_to_user_id === recruiter.user_id);
        const recruiterSubmissions = (submissions.rows || []).filter((row) => row.recruiter_code === recruiter.recruiter_code);
        return {
          name: recruiter.full_name || recruiter.username,
          recruiter_code: recruiter.recruiter_code,
          candidates: recruiterCandidates.length,
          submissions: recruiterSubmissions.length,
          approvals: recruiterSubmissions.filter((row) => row.approval_status === 'Approved').length,
          open_tasks: recruiterTasks.filter((row) => !['Done', 'Closed', 'Completed'].includes(row.status)).length
        };
      });
      setData(tableRows);
    }).catch(() => mounted && setData([]));
    return () => { mounted = false; };
  }, []);

  if (!data) return <PanelLoading label="Loading performance" />;

  return (
    <div className="panel glass-card">
      <PanelHeader title="Performance Centre" subtitle="Recruiter output without spreadsheet archaeology." />
      <DataTable columns={[
        ['name', 'Recruiter'], ['recruiter_code', 'Code'], ['candidates', 'Candidates'], ['submissions', 'Submissions'], ['approvals', 'Approved'], ['open_tasks', 'Open tasks']
      ]} rows={data} />
    </div>
  );
}

function ResourceView({ api, moduleKey, config, user, setNotice, compact = false }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null);
  const [query, setQuery] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api(`/api/module/${moduleKey}?${qs({ q: query })}`);
      setRows(data.rows || []);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [query, moduleKey]);

  async function saveRecord(payload) {
    try {
      const pk = config.columns[0][0];
      const id = payload[pk];
      const method = id ? 'PUT' : 'POST';
      const url = id ? `/api/module/${moduleKey}/${id}` : `/api/module/${moduleKey}`;
      await api(url, { method, body: JSON.stringify(payload) });
      setEditor(null);
      setNotice({ type: 'success', text: `${config.title} saved.` });
      load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  async function removeRecord(row) {
    try {
      await api(`/api/module/${moduleKey}/${row[config.columns[0][0]]}`, { method: 'DELETE' });
      setNotice({ type: 'success', text: 'Record deleted.' });
      load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  const canAdd = moduleKey !== 'activity' && !(moduleKey === 'users' && user.role !== 'manager');
  const canDelete = ['manager', 'tl'].includes(user.role) && !['activity', 'settings'].includes(moduleKey);
  const readOnly = moduleKey === 'activity';

  return (
    <div className="panel glass-card">
      <PanelHeader title={config.title} subtitle={config.subtitle} />
      <div className="toolbar-row wrap-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${config.title.toLowerCase()}`} />
        {canAdd ? <button className="primary-btn" onClick={() => setEditor({})}>Add record</button> : null}
        {moduleKey === 'notifications' ? <button className="secondary-btn" onClick={async () => {
          try {
            await api('/api/notifications/mark-all-read', { method: 'POST' });
            load();
          } catch (error) { setNotice({ type: 'error', text: error.message }); }
        }}>Mark all read</button> : null}
      </div>
      {loading ? <PanelLoading label={`Loading ${config.title.toLowerCase()}`} /> : <DataTable columns={config.columns} rows={rows} renderActions={(row) => readOnly ? null : (
        <div className="row-actions">
          <button onClick={() => setEditor(row)}>Edit</button>
          {canDelete ? <button className="danger-link" onClick={() => removeRecord(row)}>Delete</button> : null}
        </div>
      )} compact={compact} />}
      {editor ? <RecordModal title={editor[config.columns[0][0]] ? `Edit ${config.title}` : `Add ${config.title}`} fields={config.fields} value={editor} onClose={() => setEditor(null)} onChange={setEditor} onSave={saveRecord} /> : null}
    </div>
  );
}

function SearchOverlay({ results, searchText, onClose }) {
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-card search-overlay" onClick={(event) => event.stopPropagation()}>
        <div className="overlay-head">
          <div>
            <h3>Search results</h3>
            <p>{searchText}</p>
          </div>
          <button className="secondary-btn" onClick={onClose}>Close</button>
        </div>
        <div className="search-grid">
          <SearchColumn title="Candidates" rows={results.candidates} label={(row) => row.full_name || row.candidate_id} sub={(row) => `${row.phone || '-'} · ${row.process || '-'}`} />
          <SearchColumn title="Tasks" rows={results.tasks} label={(row) => row.title || row.task_id} sub={(row) => `${row.assigned_to_name || '-'} · ${row.status || '-'}`} />
          <SearchColumn title="JDs" rows={results.jds} label={(row) => row.job_title || row.jd_id} sub={(row) => `${row.company || '-'} · ${row.location || '-'}`} />
          <SearchColumn title="Clients" rows={results.clients} label={(row) => row.client_name || row.lead_id} sub={(row) => `${row.city || '-'} · ${row.status || '-'}`} />
        </div>
      </div>
    </div>
  );
}

function SearchColumn({ title, rows, label, sub }) {
  return (
    <div className="search-column">
      <h4>{title}</h4>
      {!rows?.length ? <p className="muted-text">Nothing useful here yet.</p> : rows.map((row, index) => (
        <div key={`${title}-${index}`} className="search-item">
          <strong>{label(row)}</strong>
          <p>{sub(row)}</p>
        </div>
      ))}
    </div>
  );
}

function RecordModal({ title, fields, value, onClose, onChange, onSave }) {
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(value);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <form className="modal-card record-modal" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <div className="overlay-head">
          <h3>{title}</h3>
          <button type="button" className="secondary-btn" onClick={onClose}>Close</button>
        </div>
        <div className="form-grid">
          {fields.map(([key, label, type]) => (
            <Field key={key} label={label} type={type} value={value[key] || ''} onChange={(fieldValue) => onChange({ ...value, [key]: fieldValue })} />
          ))}
        </div>
        <div className="modal-actions">
          <button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function NotesModal({ state, setState, notes, onClose, onSave }) {
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="modal-card record-modal" onClick={(event) => event.stopPropagation()}>
        <div className="overlay-head">
          <div>
            <h3>{state.candidate.full_name}</h3>
            <p>{state.candidate.candidate_id}</p>
          </div>
          <button type="button" className="secondary-btn" onClick={onClose}>Close</button>
        </div>
        <div className="form-grid two-fields">
          <Field label="Note type" value={state.note_type} onChange={(value) => setState({ ...state, note_type: value })} />
          <Field label="Note" type="textarea" value={state.body} onChange={(value) => setState({ ...state, body: value })} />
        </div>
        <div className="modal-actions">
          <button className="primary-btn" onClick={onSave}>Add note</button>
        </div>
        <div className="notes-list">
          {notes.map((note) => (
            <div key={`${note.id}-${note.created_at}`} className="note-card">
              <strong>{note.username} · {note.note_type}</strong>
              <p>{note.body}</p>
              <small>{formatDateTime(note.created_at)}</small>
            </div>
          ))}
          {!notes.length ? <EmptyState title="No notes yet" text="Apparently nobody documented anything. A classic." /> : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  const textarea = type === 'textarea';
  return (
    <label className="field-row">
      <span>{label}</span>
      {textarea ? <textarea value={value} onChange={(event) => onChange(event.target.value)} /> : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

function PanelHeader({ title, subtitle }) {
  return (
    <div className="panel-header">
      <div>
        <h2>{title}</h2>
        <p className="muted-text">{subtitle}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card glass-card">
      <p>{label}</p>
      <strong>{value || 0}</strong>
    </div>
  );
}

function SimpleList({ rows, render }) {
  if (!rows?.length) return <EmptyState title="No data yet" text="Nothing has happened here yet. Suspiciously peaceful." />;
  return <div className="list-stack">{rows.map((row, index) => <div key={index}>{render(row)}</div>)}</div>;
}

function DataTable({ columns, rows, renderActions, compact = false }) {
  if (!rows?.length) return <EmptyState title="No records found" text="Try again after humans create some data." />;
  return (
    <div className={compact ? 'table-wrap compact' : 'table-wrap'}>
      <table>
        <thead>
          <tr>
            {columns.map(([key, label]) => <th key={key}>{label}</th>)}
            {renderActions ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row[columns[0][0]] || index}>
              {columns.map(([key]) => <td key={key}>{formatCell(row[key])}</td>)}
              {renderActions ? <td>{renderActions(row)}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PanelLoading({ label }) {
  return <div className="panel glass-card panel-loading">{label}...</div>;
}

function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return '-';
  return String(value).replace('T', ' ').slice(0, 16);
}

function formatCell(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' && value.includes('T')) return formatDateTime(value);
  return String(value);
}

export default App;
