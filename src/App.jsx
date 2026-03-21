import { useEffect, useMemo, useState } from 'react';

const candidateFields = [
  ['full_name', 'Full name'],
  ['phone', 'Phone'],
  ['qualification', 'Qualification'],
  ['location', 'Current location'],
  ['preferred_location', 'Preferred location'],
  ['total_experience', 'Total experience'],
  ['relevant_experience', 'Relevant experience'],
  ['in_hand_salary', 'In hand salary'],
  ['communication_skill', 'Communication'],
  ['process', 'Process'],
  ['status', 'Status'],
  ['recruiter_code', 'Recruiter code'],
  ['recruiter_name', 'Recruiter name'],
  ['submission_date', 'Submission date'],
  ['notes', 'Notes']
];

const taskFields = [
  ['title', 'Title'],
  ['description', 'Description'],
  ['assigned_to_user_id', 'Assigned user ID'],
  ['assigned_to_name', 'Assigned name'],
  ['status', 'Status'],
  ['priority', 'Priority'],
  ['due_date', 'Due date']
];

const jdFields = [
  ['job_title', 'Job title'],
  ['company', 'Company'],
  ['location', 'Location'],
  ['experience', 'Experience'],
  ['salary', 'Salary'],
  ['pdf_url', 'JD URL'],
  ['jd_status', 'Status'],
  ['notes', 'Notes']
];

const interviewFields = [
  ['candidate_id', 'Candidate ID'],
  ['jd_id', 'JD ID'],
  ['stage', 'Stage'],
  ['scheduled_at', 'Scheduled at'],
  ['status', 'Status']
];

const submissionFields = [
  ['candidate_id', 'Candidate ID'],
  ['jd_id', 'JD ID'],
  ['recruiter_code', 'Recruiter code'],
  ['status', 'Status'],
  ['approval_status', 'Approval status'],
  ['decision_note', 'Decision note'],
  ['submitted_at', 'Submitted at']
];

const modules = [
  ['dashboard', 'Dashboard'],
  ['candidates', 'Candidates'],
  ['tasks', 'Tasks'],
  ['jds', 'JD Centre'],
  ['interviews', 'Interviews'],
  ['submissions', 'Submissions'],
  ['users', 'Team'],
  ['notifications', 'Notifications'],
  ['activity', 'Activity'],
  ['settings', 'Settings']
];

const themeOptions = [
  { value: 'corporate-dark', label: 'Corporate Dark' },
  { value: 'midnight-blue', label: 'Midnight Blue' },
  { value: 'light-crisp', label: 'Light Crisp' }
];

const initialBoot = { loading: true, dbReady: false, hasUsers: false, message: '' };

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
  const [boot, setBoot] = useState(initialBoot);
  const [user, setUser] = useState(null);
  const [active, setActive] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useNotice();
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState({ candidates: [], tasks: [], jds: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('career_crox_theme') || 'corporate-dark');

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
      if (boot.dbReady && boot.hasUsers) {
        throw new Error('Session expired. Please log in again.');
      }
    }

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.blob();

    if (!response.ok) {
      throw new Error(payload?.error || 'Request failed');
    }
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
          setTheme(me.user.theme_name || localStorage.getItem('career_crox_theme') || 'corporate-dark');
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
    localStorage.setItem('career_crox_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  async function handleLogin(form) {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(form) });
    setUser(data.user);
    setTheme(data.user.theme_name || theme);
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
      const data = await api(`/api/search?${qs({ q: searchText })}`);
      setSearchResults(data);
      setSearchOpen(true);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  if (boot.loading) {
    return <SplashScreen text="Booting the CRM. Human software rituals continue." />;
  }

  if (!boot.dbReady) {
    return <EnvMissingScreen message={boot.message || boot.message === '' ? boot.message : 'Missing environment variables.'} />;
  }

  if (!boot.hasUsers) {
    return <SetupScreen onSubmit={handleBootstrap} />;
  }

  if (!user) {
    return <LoginScreen onSubmit={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <Sidebar active={active} setActive={setActive} user={user} onLogout={handleLogout} />
      <main className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">Career Crox CRM</p>
            <h1>{modules.find((item) => item[0] === active)?.[1] || 'Workspace'}</h1>
          </div>
          <div className="topbar-actions">
            <div className="search-box">
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search candidate, task, JD..."
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runSearch();
                }}
              />
              <button className="secondary-btn" onClick={runSearch}>Search</button>
            </div>
            <select
              value={theme}
              onChange={async (event) => {
                const nextTheme = event.target.value;
                setTheme(nextTheme);
                try {
                  await api(`/api/users/${user.user_id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ theme_name: nextTheme })
                  });
                  setUser((current) => ({ ...current, theme_name: nextTheme }));
                } catch {
                  // keep local theme anyway
                }
              }}
            >
              {themeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </header>

        {notice ? <div className={`notice ${notice.type}`}>{notice.text}</div> : null}

        {searchOpen ? (
          <SearchOverlay results={searchResults} searchText={searchText} onClose={() => setSearchOpen(false)} />
        ) : null}

        {active === 'dashboard' && <DashboardView api={api} refreshKey={refreshKey} />}
        {active === 'candidates' && <CandidatesView api={api} user={user} setNotice={setNotice} bump={() => setRefreshKey((n) => n + 1)} />}
        {active === 'tasks' && <TasksView api={api} user={user} setNotice={setNotice} />}
        {active === 'jds' && <JdsView api={api} user={user} setNotice={setNotice} />}
        {active === 'interviews' && <InterviewsView api={api} user={user} setNotice={setNotice} />}
        {active === 'submissions' && <SubmissionsView api={api} user={user} setNotice={setNotice} />}
        {active === 'users' && <UsersView api={api} user={user} setNotice={setNotice} />}
        {active === 'notifications' && <NotificationsView api={api} user={user} setNotice={setNotice} />}
        {active === 'activity' && <ActivityView api={api} />}
        {active === 'settings' && <SettingsView api={api} user={user} setNotice={setNotice} />}
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
        <p>This app starts cleanly, but it needs Supabase keys before it can work. Tragic, I know.</p>
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
        <p>Create the first manager account. No demo users, no placeholder circus.</p>
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
        <p>React on the front, Node on the back, and fewer full-page tantrums in between.</p>
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
          <button key={key} className={active === key ? 'nav-btn active' : 'nav-btn'} onClick={() => setActive(key)}>
            {label}
          </button>
        ))}
      </nav>
      <button className="logout-btn" onClick={onLogout}>Logout</button>
    </aside>
  );
}

function DashboardView({ api, refreshKey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api('/api/dashboard/summary')
      .then((payload) => {
        if (mounted) setData(payload);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [api, refreshKey]);

  if (loading) return <PanelLoading label="Loading dashboard" />;
  if (!data) return <EmptyState title="Dashboard unavailable" text="No data yet." />;

  return (
    <div className="stack">
      <section className="stats-grid">
        <StatCard label="Candidates" value={data.candidateCount} />
        <StatCard label="Open Tasks" value={data.openTasks} />
        <StatCard label="Interviews Today" value={data.interviewsToday} />
        <StatCard label="Pending Approvals" value={data.pendingApprovals} />
        <StatCard label="Unread Notifications" value={data.unreadNotifications} />
        <StatCard label="Active Recruiters" value={data.activeRecruiters} />
      </section>

      <section className="panel-grid two-col">
        <div className="panel glass-card">
          <PanelHeader title="Latest candidates" subtitle="Fresh entries without the reload drama." />
          <SimpleList
            rows={data.latestCandidates}
            render={(row) => (
              <div className="list-row">
                <div>
                  <strong>{row.full_name || 'Unnamed candidate'}</strong>
                  <p>{row.phone || 'No phone'} · {row.process || 'No process'}</p>
                </div>
                <span className="pill">{row.status || 'New'}</span>
              </div>
            )}
          />
        </div>
        <div className="panel glass-card">
          <PanelHeader title="Recent activity" subtitle="The more useful kind of surveillance." />
          <SimpleList
            rows={data.recentActivity}
            render={(row) => (
              <div className="list-row">
                <div>
                  <strong>{row.action_type || 'action'}</strong>
                  <p>{row.username || 'unknown'} · {formatDateTime(row.created_at)}</p>
                </div>
                <code>{row.candidate_id || '-'}</code>
              </div>
            )}
          />
        </div>
      </section>
    </div>
  );
}

function CandidatesView({ api, user, setNotice, bump }) {
  const privileged = ['manager', 'tl'].includes(user.role);
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ q: '', status: '', recruiter_code: '' });
  const [editor, setEditor] = useState(null);
  const [notesBox, setNotesBox] = useState({ candidate: null, rows: [], text: '', note_type: 'public', loading: false });

  async function load() {
    setLoading(true);
    try {
      const [candidates, people] = await Promise.all([
        api(`/api/candidates?${qs({ ...filters, page, pageSize: 20 })}`),
        privileged ? api('/api/users') : Promise.resolve({ rows: [] })
      ]);
      setRows(candidates.rows || []);
      setTotal(candidates.total || 0);
      setUsers(people.rows || []);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [page]);

  async function handleFilter() {
    setPage(1);
    await load();
  }

  async function saveCandidate(payload) {
    try {
      const method = payload.candidate_id ? 'PUT' : 'POST';
      const url = payload.candidate_id ? `/api/candidates/${payload.candidate_id}` : '/api/candidates';
      await api(url, { method, body: JSON.stringify(payload) });
      setEditor(null);
      setNotice({ type: 'success', text: 'Candidate saved.' });
      load();
      bump();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  async function removeCandidate(candidate) {
    if (!window.confirm(`Delete ${candidate.full_name || candidate.candidate_id}?`)) return;
    try {
      await api(`/api/candidates/${candidate.candidate_id}`, { method: 'DELETE' });
      setNotice({ type: 'success', text: 'Candidate deleted.' });
      load();
      bump();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  async function openNotes(candidate) {
    setNotesBox((current) => ({ ...current, candidate, loading: true }));
    try {
      const data = await api(`/api/candidates/${candidate.candidate_id}/notes`);
      setNotesBox((current) => ({ ...current, rows: data.rows || [], loading: false }));
    } catch (error) {
      setNotesBox({ candidate: null, rows: [], text: '', note_type: 'public', loading: false });
      setNotice({ type: 'error', text: error.message });
    }
  }

  async function addNote() {
    if (!notesBox.candidate || !notesBox.text.trim()) return;
    try {
      await api(`/api/candidates/${notesBox.candidate.candidate_id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ body: notesBox.text, note_type: notesBox.note_type })
      });
      setNotesBox((current) => ({ ...current, text: '' }));
      openNotes(notesBox.candidate);
      setNotice({ type: 'success', text: 'Note added.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  async function uploadFile(file) {
    const form = new FormData();
    form.append('file', file);
    try {
      const data = await api('/api/candidates/import', { method: 'POST', body: form });
      setNotice({ type: 'success', text: `${data.inserted} rows imported.` });
      load();
      bump();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  async function logDialer(action, candidate) {
    try {
      await api('/api/dialer/log', {
        method: 'POST',
        body: JSON.stringify({ action, candidate_id: candidate.candidate_id, phone: candidate.phone })
      });
    } catch {
      // not fatal
    }
  }

  return (
    <div className="stack">
      <div className="panel glass-card">
        <PanelHeader title="Candidates" subtitle="Search, import, update, and contact people without nuking the page." />
        <div className="toolbar-grid">
          <input placeholder="Search name, phone, process..." value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <input placeholder="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} />
          {privileged ? (
            <select value={filters.recruiter_code} onChange={(e) => setFilters({ ...filters, recruiter_code: e.target.value })}>
              <option value="">All recruiters</option>
              {users.filter((item) => item.role === 'recruiter').map((item) => (
                <option key={item.user_id} value={item.recruiter_code}>{item.full_name} ({item.recruiter_code})</option>
              ))}
            </select>
          ) : null}
          <button className="secondary-btn" onClick={handleFilter}>Apply</button>
          <button className="primary-btn" onClick={() => setEditor({})}>Add candidate</button>
          <label className="secondary-btn upload-btn">
            Import Excel
            <input type="file" accept=".xlsx,.xls" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
          </label>
          <a className="secondary-btn" href={`/api/candidates/template`} target="_blank" rel="noreferrer">Template</a>
          <a className="secondary-btn" href={`/api/candidates/export?${qs(filters)}`} target="_blank" rel="noreferrer">Export</a>
        </div>
        {loading ? <PanelLoading label="Loading candidates" /> : (
          <>
            <DataTable
              columns={[
                ['candidate_id', 'ID'],
                ['full_name', 'Name'],
                ['phone', 'Phone'],
                ['process', 'Process'],
                ['location', 'Location'],
                ['status', 'Status'],
                ['recruiter_name', 'Recruiter'],
                ['updated_at', 'Updated']
              ]}
              rows={rows}
              renderActions={(row) => (
                <div className="row-actions">
                  <button onClick={() => setEditor(row)}>Edit</button>
                  <button onClick={() => openNotes(row)}>Notes</button>
                  <a href={`tel:${row.phone || ''}`} onClick={() => logDialer('manual_call', row)}>Call</a>
                  <a href={`https://wa.me/91${(row.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" onClick={() => logDialer('whatsapp', row)}>WhatsApp</a>
                  {privileged ? <button className="danger-link" onClick={() => removeCandidate(row)}>Delete</button> : null}
                </div>
              )}
            />
            <Pagination page={page} pageSize={20} total={total} setPage={setPage} />
          </>
        )}
      </div>

      {notesBox.candidate ? (
        <div className="panel glass-card">
          <PanelHeader title={`Notes · ${notesBox.candidate.full_name || notesBox.candidate.candidate_id}`} subtitle="Public and private notes, because memory is overrated." />
          {notesBox.loading ? <PanelLoading label="Loading notes" /> : (
            <>
              <div className="notes-feed">
                {(notesBox.rows || []).length ? notesBox.rows.map((note) => (
                  <div key={note.id} className="note-card">
                    <div className="note-head">
                      <strong>{note.username}</strong>
                      <span>{note.note_type}</span>
                      <small>{formatDateTime(note.created_at)}</small>
                    </div>
                    <p>{note.body}</p>
                  </div>
                )) : <EmptyState title="No notes yet" text="Add one below." compact />}
              </div>
              <div className="note-form">
                <select value={notesBox.note_type} onChange={(e) => setNotesBox((current) => ({ ...current, note_type: e.target.value }))}>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
                <textarea value={notesBox.text} onChange={(e) => setNotesBox((current) => ({ ...current, text: e.target.value }))} placeholder="Write note..." />
                <div className="modal-actions">
                  <button className="secondary-btn" onClick={() => setNotesBox({ candidate: null, rows: [], text: '', note_type: 'public', loading: false })}>Close</button>
                  <button className="primary-btn" onClick={addNote}>Save note</button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

      {editor !== null ? (
        <RecordModal
          title={editor.candidate_id ? 'Edit candidate' : 'Add candidate'}
          fields={candidateFields}
          value={editor}
          onClose={() => setEditor(null)}
          onChange={setEditor}
          onSave={saveCandidate}
        />
      ) : null}
    </div>
  );
}

function TasksView({ api, user, setNotice }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api('/api/tasks');
      setRows(data.rows || []);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveTask(payload) {
    try {
      const method = payload.task_id ? 'PUT' : 'POST';
      const url = payload.task_id ? `/api/tasks/${payload.task_id}` : '/api/tasks';
      await api(url, { method, body: JSON.stringify(payload) });
      setEditor(null);
      setNotice({ type: 'success', text: 'Task saved.' });
      load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  return (
    <div className="panel glass-card">
      <PanelHeader title="Tasks" subtitle="Assignments without spreadsheet acrobatics." />
      <div className="toolbar-end"><button className="primary-btn" onClick={() => setEditor({ assigned_to_user_id: user.user_id, assigned_to_name: user.full_name || user.username })}>Add task</button></div>
      {loading ? <PanelLoading label="Loading tasks" /> : <DataTable columns={[
        ['task_id', 'ID'],
        ['title', 'Title'],
        ['assigned_to_name', 'Assigned to'],
        ['status', 'Status'],
        ['priority', 'Priority'],
        ['due_date', 'Due date'],
        ['updated_at', 'Updated']
      ]} rows={rows} renderActions={(row) => <button onClick={() => setEditor(row)}>Edit</button>} />}
      {editor !== null ? <RecordModal title={editor.task_id ? 'Edit task' : 'Add task'} fields={taskFields} value={editor} onClose={() => setEditor(null)} onChange={setEditor} onSave={saveTask} /> : null}
    </div>
  );
}

function JdsView({ api, user, setNotice }) {
  const privileged = ['manager', 'tl'].includes(user.role);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api('/api/jds');
      setRows(data.rows || []);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveJd(payload) {
    try {
      const method = payload.jd_id ? 'PUT' : 'POST';
      const url = payload.jd_id ? `/api/jds/${payload.jd_id}` : '/api/jds';
      await api(url, { method, body: JSON.stringify(payload) });
      setEditor(null);
      setNotice({ type: 'success', text: 'JD saved.' });
      load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  return (
    <div className="panel glass-card">
      <PanelHeader title="JD Centre" subtitle="Job descriptions stay here instead of haunting random chats." />
      {privileged ? <div className="toolbar-end"><button className="primary-btn" onClick={() => setEditor({})}>Add JD</button></div> : null}
      {loading ? <PanelLoading label="Loading JDs" /> : <DataTable columns={[
        ['jd_id', 'ID'],
        ['job_title', 'Job title'],
        ['company', 'Company'],
        ['location', 'Location'],
        ['experience', 'Experience'],
        ['salary', 'Salary'],
        ['jd_status', 'Status']
      ]} rows={rows} renderActions={(row) => (
        <div className="row-actions">
          {row.pdf_url ? <a href={row.pdf_url} target="_blank" rel="noreferrer">Open</a> : null}
          {privileged ? <button onClick={() => setEditor(row)}>Edit</button> : null}
        </div>
      )} />}
      {editor !== null ? <RecordModal title={editor.jd_id ? 'Edit JD' : 'Add JD'} fields={jdFields} value={editor} onClose={() => setEditor(null)} onChange={setEditor} onSave={saveJd} /> : null}
    </div>
  );
}

function InterviewsView({ api, user, setNotice }) {
  const privileged = ['manager', 'tl'].includes(user.role);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api('/api/interviews');
      setRows(data.rows || []);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveRecord(payload) {
    try {
      const method = payload.interview_id ? 'PUT' : 'POST';
      const url = payload.interview_id ? `/api/interviews/${payload.interview_id}` : '/api/interviews';
      await api(url, { method, body: JSON.stringify(payload) });
      setEditor(null);
      setNotice({ type: 'success', text: 'Interview saved.' });
      load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  return (
    <div className="panel glass-card">
      <PanelHeader title="Interviews" subtitle="Scheduling without forcing the whole app to wake up again." />
      {privileged ? <div className="toolbar-end"><button className="primary-btn" onClick={() => setEditor({ stage: 'Screening', status: 'Scheduled' })}>Add interview</button></div> : null}
      {loading ? <PanelLoading label="Loading interviews" /> : <DataTable columns={[
        ['interview_id', 'ID'],
        ['candidate_id', 'Candidate'],
        ['jd_id', 'JD'],
        ['stage', 'Stage'],
        ['scheduled_at', 'Scheduled at'],
        ['status', 'Status']
      ]} rows={rows} renderActions={(row) => privileged ? <button onClick={() => setEditor(row)}>Edit</button> : null} />}
      {editor !== null ? <RecordModal title={editor.interview_id ? 'Edit interview' : 'Add interview'} fields={interviewFields} value={editor} onClose={() => setEditor(null)} onChange={setEditor} onSave={saveRecord} /> : null}
    </div>
  );
}

function SubmissionsView({ api, user, setNotice }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api('/api/submissions');
      setRows(data.rows || []);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveRecord(payload) {
    try {
      const method = payload.submission_id ? 'PUT' : 'POST';
      const url = payload.submission_id ? `/api/submissions/${payload.submission_id}` : '/api/submissions';
      await api(url, { method, body: JSON.stringify(payload) });
      setEditor(null);
      setNotice({ type: 'success', text: 'Submission saved.' });
      load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  return (
    <div className="panel glass-card">
      <PanelHeader title="Submissions" subtitle="Track approvals, decisions, and recruiter ownership." />
      <div className="toolbar-end"><button className="primary-btn" onClick={() => setEditor({ recruiter_code: user.recruiter_code || '' })}>Add submission</button></div>
      {loading ? <PanelLoading label="Loading submissions" /> : <DataTable columns={[
        ['submission_id', 'ID'],
        ['candidate_id', 'Candidate'],
        ['jd_id', 'JD'],
        ['recruiter_code', 'Recruiter'],
        ['status', 'Status'],
        ['approval_status', 'Approval'],
        ['submitted_at', 'Submitted at']
      ]} rows={rows} renderActions={(row) => <button onClick={() => setEditor(row)}>Edit</button>} />}
      {editor !== null ? <RecordModal title={editor.submission_id ? 'Edit submission' : 'Add submission'} fields={submissionFields} value={editor} onClose={() => setEditor(null)} onChange={setEditor} onSave={saveRecord} /> : null}
    </div>
  );
}

function UsersView({ api, user, setNotice }) {
  const manager = user.role === 'manager';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api('/api/users');
      setRows(data.rows || []);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveUser(payload) {
    try {
      const method = payload.user_id ? 'PUT' : 'POST';
      const url = payload.user_id ? `/api/users/${payload.user_id}` : '/api/users';
      await api(url, { method, body: JSON.stringify(payload) });
      setEditor(null);
      setNotice({ type: 'success', text: 'User saved.' });
      load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  return (
    <div className="panel glass-card">
      <PanelHeader title="Team" subtitle="Manager and TL visibility, because chaos scales faster than teams." />
      {manager ? <div className="toolbar-end"><button className="primary-btn" onClick={() => setEditor({ role: 'recruiter', is_active: '1' })}>Add team member</button></div> : null}
      {loading ? <PanelLoading label="Loading team" /> : <DataTable columns={[
        ['user_id', 'ID'],
        ['full_name', 'Full name'],
        ['username', 'Username'],
        ['designation', 'Designation'],
        ['role', 'Role'],
        ['recruiter_code', 'Recruiter code'],
        ['is_active', 'Active']
      ]} rows={rows} renderActions={(row) => manager || row.user_id === user.user_id ? <button onClick={() => setEditor(row)}>Edit</button> : null} />}
      {editor !== null ? <UserModal title={editor.user_id ? 'Edit team member' : 'Add team member'} value={editor} onClose={() => setEditor(null)} onChange={setEditor} onSave={saveUser} manager={manager} /> : null}
    </div>
  );
}

function NotificationsView({ api, user, setNotice }) {
  const privileged = ['manager', 'tl'].includes(user.role);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api('/api/notifications');
      setRows(data.rows || []);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveNotification(payload) {
    try {
      await api('/api/notifications', { method: 'POST', body: JSON.stringify(payload) });
      setEditor(null);
      setNotice({ type: 'success', text: 'Notification sent.' });
      load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  async function markAllRead() {
    try {
      await api('/api/notifications/mark-all-read', { method: 'POST' });
      setNotice({ type: 'success', text: 'Marked as read.' });
      load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  return (
    <div className="panel glass-card">
      <PanelHeader title="Notifications" subtitle="Less shouting across the room, more structured updates." />
      <div className="toolbar-end gap-wrap">
        <button className="secondary-btn" onClick={markAllRead}>Mark all read</button>
        {privileged ? <button className="primary-btn" onClick={() => setEditor({ category: 'General', status: 'Unread' })}>Create notification</button> : null}
      </div>
      {loading ? <PanelLoading label="Loading notifications" /> : <DataTable columns={[
        ['created_at', 'Created'],
        ['title', 'Title'],
        ['message', 'Message'],
        ['category', 'Category'],
        ['status', 'Status']
      ]} rows={rows} />}
      {editor !== null ? <NotificationModal value={editor} onClose={() => setEditor(null)} onChange={setEditor} onSave={saveNotification} /> : null}
    </div>
  );
}

function ActivityView({ api }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    api('/api/activity')
      .then((data) => {
        if (mounted) setRows(data.rows || []);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [api]);

  return (
    <div className="panel glass-card">
      <PanelHeader title="Activity" subtitle="A cleaner audit trail than guessing who broke what." />
      {loading ? <PanelLoading label="Loading activity" /> : <DataTable columns={[
        ['created_at', 'Created'],
        ['username', 'User'],
        ['action_type', 'Action'],
        ['candidate_id', 'Candidate'],
        ['metadata', 'Metadata']
      ]} rows={rows} />}
    </div>
  );
}

function SettingsView({ api, user, setNotice }) {
  const manager = user.role === 'manager';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api('/api/settings');
      setRows(data.rows || []);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveSetting(payload) {
    try {
      await api(`/api/settings/${payload.setting_key}`, { method: 'PUT', body: JSON.stringify(payload) });
      setEditor(null);
      setNotice({ type: 'success', text: 'Setting saved.' });
      load();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  }

  return (
    <div className="panel glass-card">
      <PanelHeader title="Settings" subtitle="App-level switches, because somebody has to keep the machine civilised." />
      {manager ? <div className="toolbar-end"><button className="primary-btn" onClick={() => setEditor({})}>Add setting</button></div> : null}
      {loading ? <PanelLoading label="Loading settings" /> : <DataTable columns={[
        ['setting_key', 'Key'],
        ['setting_value', 'Value'],
        ['notes', 'Notes'],
        ['Instructions', 'Instructions']
      ]} rows={rows} renderActions={(row) => manager ? <button onClick={() => setEditor(row)}>Edit</button> : null} />}
      {editor !== null ? <SettingModal value={editor} onClose={() => setEditor(null)} onChange={setEditor} onSave={saveSetting} /> : null}
    </div>
  );
}

function SearchOverlay({ results, searchText, onClose }) {
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-card glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-head">
          <div>
            <h3>Search results</h3>
            <p>{searchText}</p>
          </div>
          <button className="secondary-btn" onClick={onClose}>Close</button>
        </div>
        <div className="search-grid">
          <SearchColumn title="Candidates" rows={results.candidates} mainKey="full_name" subKey="candidate_id" />
          <SearchColumn title="Tasks" rows={results.tasks} mainKey="title" subKey="task_id" />
          <SearchColumn title="JDs" rows={results.jds} mainKey="job_title" subKey="jd_id" />
        </div>
      </div>
    </div>
  );
}

function SearchColumn({ title, rows, mainKey, subKey }) {
  return (
    <div className="search-column">
      <h4>{title}</h4>
      {(rows || []).length ? rows.map((row) => (
        <div className="search-item" key={row[subKey] || row[mainKey]}>
          <strong>{row[mainKey] || 'Untitled'}</strong>
          <span>{row[subKey] || '-'}</span>
        </div>
      )) : <EmptyState title="Nothing here" text="Try another search term." compact />}
    </div>
  );
}

function RecordModal({ title, fields, value, onClose, onChange, onSave }) {
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="modal-card glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-head">
          <div>
            <h3>{title}</h3>
            <p>Update the record without throwing the entire page off a cliff.</p>
          </div>
          <button className="secondary-btn" onClick={onClose}>Close</button>
        </div>
        <div className="form-grid">
          {fields.map(([key, label]) => (
            <Field key={key} label={label} value={value[key] || ''} onChange={(next) => onChange({ ...value, [key]: next })} textarea={key === 'notes' || key === 'description' || key === 'decision_note'} />
          ))}
        </div>
        <div className="modal-actions">
          <button className="secondary-btn" onClick={onClose}>Cancel</button>
          <button className="primary-btn" onClick={() => onSave(value)}>Save</button>
        </div>
      </div>
    </div>
  );
}

function UserModal({ title, value, onClose, onChange, onSave, manager }) {
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="modal-card glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-head">
          <div>
            <h3>{title}</h3>
            <p>User access controls, because not everyone should see everything.</p>
          </div>
          <button className="secondary-btn" onClick={onClose}>Close</button>
        </div>
        <div className="form-grid">
          <Field label="Full name" value={value.full_name || ''} onChange={(next) => onChange({ ...value, full_name: next })} />
          <Field label="Username" value={value.username || ''} onChange={(next) => onChange({ ...value, username: next })} disabled={Boolean(value.user_id)} />
          <Field label="Password" type="password" value={value.password || ''} onChange={(next) => onChange({ ...value, password: next })} />
          <Field label="Designation" value={value.designation || ''} onChange={(next) => onChange({ ...value, designation: next })} />
          <Field label="Recruiter code" value={value.recruiter_code || ''} onChange={(next) => onChange({ ...value, recruiter_code: next })} />
          <SelectField label="Role" value={value.role || 'recruiter'} onChange={(next) => onChange({ ...value, role: next })} options={[['recruiter', 'Recruiter'], ['tl', 'TL'], ['manager', 'Manager']]} disabled={!manager} />
          <SelectField label="Active" value={value.is_active || '1'} onChange={(next) => onChange({ ...value, is_active: next })} options={[['1', 'Yes'], ['0', 'No']]} disabled={!manager} />
          <SelectField label="Theme" value={value.theme_name || 'corporate-dark'} onChange={(next) => onChange({ ...value, theme_name: next })} options={themeOptions.map((item) => [item.value, item.label])} />
        </div>
        <div className="modal-actions">
          <button className="secondary-btn" onClick={onClose}>Cancel</button>
          <button className="primary-btn" onClick={() => onSave(value)}>Save</button>
        </div>
      </div>
    </div>
  );
}

function NotificationModal({ value, onClose, onChange, onSave }) {
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="modal-card glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-head">
          <div>
            <h3>Create notification</h3>
            <p>Send a structured update instead of another frantic ping.</p>
          </div>
          <button className="secondary-btn" onClick={onClose}>Close</button>
        </div>
        <div className="form-grid">
          <Field label="User ID (optional)" value={value.user_id || ''} onChange={(next) => onChange({ ...value, user_id: next })} />
          <Field label="Title" value={value.title || ''} onChange={(next) => onChange({ ...value, title: next })} />
          <Field label="Message" value={value.message || ''} onChange={(next) => onChange({ ...value, message: next })} textarea />
          <Field label="Category" value={value.category || ''} onChange={(next) => onChange({ ...value, category: next })} />
        </div>
        <div className="modal-actions">
          <button className="secondary-btn" onClick={onClose}>Cancel</button>
          <button className="primary-btn" onClick={() => onSave(value)}>Send</button>
        </div>
      </div>
    </div>
  );
}

function SettingModal({ value, onClose, onChange, onSave }) {
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="modal-card glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-head">
          <div>
            <h3>Save setting</h3>
            <p>One place for app-level knobs. Humans love knobs.</p>
          </div>
          <button className="secondary-btn" onClick={onClose}>Close</button>
        </div>
        <div className="form-grid">
          <Field label="Key" value={value.setting_key || ''} onChange={(next) => onChange({ ...value, setting_key: next })} disabled={Boolean(value.setting_key)} />
          <Field label="Value" value={value.setting_value || ''} onChange={(next) => onChange({ ...value, setting_value: next })} />
          <Field label="Notes" value={value.notes || ''} onChange={(next) => onChange({ ...value, notes: next })} textarea />
          <Field label="Instructions" value={value.Instructions || ''} onChange={(next) => onChange({ ...value, Instructions: next })} textarea />
        </div>
        <div className="modal-actions">
          <button className="secondary-btn" onClick={onClose}>Cancel</button>
          <button className="primary-btn" onClick={() => onSave(value)}>Save</button>
        </div>
      </div>
    </div>
  );
}

function DataTable({ columns, rows, renderActions }) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map(([key, label]) => <th key={key}>{label}</th>)}
            {renderActions ? <th>Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={row.id || row.candidate_id || row.task_id || row.user_id || row.submission_id || row.jd_id || row.interview_id || row.notification_id || row.setting_key || `${index}`}>
              {columns.map(([key]) => <td key={key}>{formatCell(row[key])}</td>)}
              {renderActions ? <td>{renderActions(row)}</td> : null}
            </tr>
          )) : (
            <tr>
              <td colSpan={columns.length + (renderActions ? 1 : 0)}>
                <EmptyState title="Nothing to show" text="The table is empty for now." compact />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', textarea = false, disabled = false }) {
  return (
    <label className="field">
      <span>{label}</span>
      {textarea ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
      ) : (
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
      )}
    </label>
  );
}

function SelectField({ label, value, onChange, options, disabled = false }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {options.map(([key, labelText]) => <option key={key} value={key}>{labelText}</option>)}
      </select>
    </label>
  );
}

function PanelHeader({ title, subtitle }) {
  return (
    <div className="panel-header">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card glass-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SimpleList({ rows, render }) {
  return (
    <div className="simple-list">
      {rows.length ? rows.map((row, index) => <div key={row.id || row.candidate_id || row.activity_id || index}>{render(row)}</div>) : <EmptyState title="Nothing yet" text="This space is waiting for data." compact />}
    </div>
  );
}

function EmptyState({ title, text, compact = false }) {
  return (
    <div className={compact ? 'empty-state compact' : 'empty-state'}>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function PanelLoading({ label }) {
  return <div className="loading-row">{label}...</div>;
}

function Pagination({ page, pageSize, total, setPage }) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  return (
    <div className="pagination">
      <button className="secondary-btn" onClick={() => setPage(Math.max(page - 1, 1))} disabled={page <= 1}>Previous</button>
      <span>Page {page} / {totalPages} · {total} records</span>
      <button className="secondary-btn" onClick={() => setPage(Math.min(page + 1, totalPages))} disabled={page >= totalPages}>Next</button>
    </div>
  );
}

function formatCell(value) {
  if (value === null || value === undefined || value === '') return '-';
  const text = String(value);
  if (text.includes('T') && text.includes(':')) return formatDateTime(text);
  if (text.length > 70) return `${text.slice(0, 67)}...`;
  return text;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default App;
