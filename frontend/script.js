const API_BASE = 'https://campusconnect-rfxc.onrender.com/api';
// ============================================================
// CampusConnect — script.js
// Frontend logic: Auth, API calls, Rendering, Interactions
// ============================================================

// ─── Configuration ────────────────────────────────────────
const API_BASE = 'https://campusconnect-rfxc.onrender.com/api';

// ─── App State ────────────────────────────────────────────
let currentUser = null;  // Logged-in user object
let allEvents = [];      // Cache for filtering
let allPlacements = [];  // Cache for filtering

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * On page load: check if user is already logged in (JWT in localStorage)
 */
window.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons(); // Initialize Lucide icons

  const token = localStorage.getItem('token');
  const user  = localStorage.getItem('user');

  if (token && user) {
    currentUser = JSON.parse(user);
    showApp();
  } else {
    showAuthScreen();
  }
});

// ============================================================
// AUTH FUNCTIONS
// ============================================================

/** Switch between Login / Signup tabs */
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

  if (tab === 'login') {
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    document.getElementById('loginForm').classList.add('active');
  } else {
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    document.getElementById('signupForm').classList.add('active');
  }
  hideAuthAlert();
}

/** Show/hide student-specific fields based on role */
function toggleStudentFields() {
  const role = document.getElementById('signupRole').value;
  const fields = document.getElementById('studentFields');
  fields.style.display = role === 'student' ? '' : 'none';
}

/** Handle Login */
async function handleLogin() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showAuthAlert('Please fill in all fields.', 'error');
    return;
  }

  try {
    const res  = await apiCall('/auth/login', 'POST', { email, password }, false);
    saveSession(res.token, res.user);
    showApp();
  } catch (err) {
    showAuthAlert(err.message, 'error');
  }
}

/** Handle Signup */
async function handleSignup() {
  const name     = document.getElementById('signupName').value.trim();
  const email    = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const role     = document.getElementById('signupRole').value;
  const branch   = document.getElementById('signupBranch').value;
  const cgpa     = parseFloat(document.getElementById('signupCgpa').value) || 0;

  if (!name || !email || !password) {
    showAuthAlert('Please fill in all required fields.', 'error');
    return;
  }
  if (password.length < 6) {
    showAuthAlert('Password must be at least 6 characters.', 'error');
    return;
  }

  try {
    const body = { name, email, password, role };
    if (role === 'student') { body.branch = branch; body.cgpa = cgpa; }

    const res = await apiCall('/auth/signup', 'POST', body, false);
    saveSession(res.token, res.user);
    showApp();
  } catch (err) {
    showAuthAlert(err.message, 'error');
  }
}

/** Save JWT + user to localStorage */
function saveSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  currentUser = user;
}

/** Handle Logout */
function handleLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentUser = null;
  document.getElementById('appScreen').classList.add('hidden');
  document.getElementById('authScreen').classList.remove('hidden');
  switchTab('login'); // Reset to login tab
}

// Auth alert helpers
function showAuthAlert(msg, type) {
  const el = document.getElementById('authAlert');
  el.textContent = msg;
  el.className = `auth-alert ${type}`;
}
function hideAuthAlert() {
  const el = document.getElementById('authAlert');
  el.className = 'auth-alert hidden';
}

// ============================================================
// APP INITIALIZATION (after login)
// ============================================================

function showAuthScreen() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('appScreen').classList.add('hidden');
}

function showApp() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');

  // Set sidebar user info
  const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('sidebarAvatar').textContent  = initials;
  document.getElementById('mobileAvatar').textContent   = initials;
  document.getElementById('sidebarName').textContent    = currentUser.name;
  document.getElementById('sidebarRole').textContent    = currentUser.role === 'admin' ? '🔑 Admin' : '🎓 Student';

  // Show role-specific nav items
  if (currentUser.role === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
  } else {
    document.querySelectorAll('.student-only').forEach(el => el.classList.remove('hidden'));
  }

  lucide.createIcons();
  showPage('dashboard');
}

// ============================================================
// PAGE ROUTING
// ============================================================

function showPage(pageName) {
  // Deactivate all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Deactivate all nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Activate selected page
  const page = document.getElementById(`page-${pageName}`);
  if (page) page.classList.add('active');

  // Activate nav item
  const nav = document.querySelector(`[data-page="${pageName}"]`);
  if (nav) nav.classList.add('active');

  // Close sidebar on mobile
  if (window.innerWidth <= 900) closeSidebar();

  // Load page-specific data
  switch (pageName) {
    case 'dashboard':    loadDashboard();    break;
    case 'events':       loadEvents();       break;
    case 'placements':   loadPlacements();   break;
    case 'applications': loadApplications(); break;
    case 'users':        loadUsers();        break;
    case 'myapps':       loadMyApps();       break;
  }
}

// ============================================================
// DASHBOARD
// ============================================================

async function loadDashboard() {
  document.getElementById('dashGreeting').textContent =
    `Welcome back, ${currentUser.name.split(' ')[0]}! 👋`;

  if (currentUser.role === 'admin') {
    document.getElementById('adminStats').classList.remove('hidden');
    document.getElementById('studentStats').classList.add('hidden');

    try {
      const stats = await apiCall('/applications/stats', 'GET');
      document.getElementById('statStudents').textContent   = stats.totalStudents;
      document.getElementById('statEvents').textContent     = stats.totalEvents;
      document.getElementById('statPlacements').textContent = stats.totalPlacements;
      document.getElementById('statSelected').textContent   = stats.selectedCount;
    } catch (e) {}

  } else {
    document.getElementById('studentStats').classList.remove('hidden');
    document.getElementById('adminStats').classList.add('hidden');
  }

  // Load recent events
  try {
    const events = await apiCall('/events', 'GET');
    allEvents = events;

    // Student stats
    if (currentUser.role === 'student') {
      document.getElementById('studentStatEvents').textContent = events.length;
    }

    const recentEl = document.getElementById('recentEvents');
    const upcoming = events.slice(0, 4);

    if (upcoming.length === 0) {
      recentEl.innerHTML = '<div class="empty-state">No events yet.</div>';
    } else {
      recentEl.innerHTML = upcoming.map(e => `
        <div class="list-item">
          <div class="list-item-left">
            <div class="list-item-title">${escHtml(e.title)}</div>
            <div class="list-item-sub">${e.venue} · ${formatDate(e.date)}</div>
          </div>
          <span class="card-badge badge-${e.category.toLowerCase()}">${e.category}</span>
        </div>
      `).join('');
    }
  } catch (e) {}

  // Load recent placements
  try {
    const placements = await apiCall('/placements', 'GET');
    allPlacements = placements;

    if (currentUser.role === 'student') {
      document.getElementById('studentStatJobs').textContent =
        placements.filter(p => p.status === 'Open').length;
    }

    const placementsEl = document.getElementById('recentPlacements');
    const recent = placements.slice(0, 4);

    if (recent.length === 0) {
      placementsEl.innerHTML = '<div class="empty-state">No placements yet.</div>';
    } else {
      placementsEl.innerHTML = recent.map(p => `
        <div class="list-item">
          <div class="list-item-left">
            <div class="list-item-title">${escHtml(p.companyName)} — ${escHtml(p.jobRole)}</div>
            <div class="list-item-sub">${p.package} · Min CGPA: ${p.eligibility.minCGPA}</div>
          </div>
          <span class="card-badge badge-${p.status.toLowerCase()}">${p.status}</span>
        </div>
      `).join('');
    }
  } catch (e) {}

  // Student: load my application count
  if (currentUser.role === 'student') {
    try {
      const apps = await apiCall('/applications', 'GET');
      document.getElementById('studentStatApps').textContent = apps.length;
    } catch (e) {}
  }
}

// ============================================================
// EVENTS PAGE
// ============================================================

async function loadEvents() {
  const grid = document.getElementById('eventsGrid');
  grid.innerHTML = '<div class="loading-state"><div class="spinner"></div> Loading events...</div>';

  try {
    allEvents = await apiCall('/events', 'GET');
    renderEvents(allEvents);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Error loading events: ${err.message}</div>`;
  }
}

function renderEvents(events) {
  const grid = document.getElementById('eventsGrid');

  // Show/hide admin buttons
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', currentUser.role !== 'admin');
  });

  if (events.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:48px">No events found.</div>';
    return;
  }

  grid.innerHTML = events.map((event, i) => {
    const registered = event.registeredStudents &&
      event.registeredStudents.includes(currentUser.id);
    const seatsFilled = event.registeredStudents ? event.registeredStudents.length : 0;
    const seatsPercent = Math.min(100, Math.round((seatsFilled / event.maxSeats) * 100));
    const seatsClass = seatsPercent >= 90 ? 'high' : seatsPercent >= 60 ? 'mid' : 'low';

    return `
      <div class="card" style="animation-delay:${i * 0.05}s">
        <span class="card-badge badge-${event.category.toLowerCase()}">${event.category}</span>
        <div class="card-title">${escHtml(event.title)}</div>
        <div class="card-desc">${escHtml(event.description)}</div>

        <div class="card-meta">
          <div class="card-meta-item">📅 <strong>${formatDate(event.date)}</strong></div>
          <div class="card-meta-item">📍 <strong>${escHtml(event.venue)}</strong></div>
          <div class="card-meta-item">💺 ${seatsFilled} / ${event.maxSeats} registered</div>
        </div>

        <div class="seats-bar">
          <div class="seats-fill ${seatsClass}" style="width:${seatsPercent}%"></div>
        </div>

        ${registered ? '<span class="registered-badge">✓ Registered</span>' : ''}

        <div class="card-actions">
          ${currentUser.role === 'student' ? `
            ${!registered
              ? `<button class="btn-primary btn-sm" onclick="registerEvent('${event._id}')">Register</button>`
              : `<button class="btn-ghost btn-sm" onclick="unregisterEvent('${event._id}')">Unregister</button>`
            }
          ` : `
            <button class="btn-primary btn-sm" onclick="openEditEvent('${event._id}')">Edit</button>
            <button class="btn-danger btn-sm" onclick="deleteEvent('${event._id}')">Delete</button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function filterEvents() {
  const search   = document.getElementById('eventSearch').value.toLowerCase();
  const category = document.getElementById('eventCategoryFilter').value;

  const filtered = allEvents.filter(e => {
    const matchSearch   = e.title.toLowerCase().includes(search) ||
                          e.description.toLowerCase().includes(search) ||
                          e.venue.toLowerCase().includes(search);
    const matchCategory = !category || e.category === category;
    return matchSearch && matchCategory;
  });

  renderEvents(filtered);
}

// Register for event
async function registerEvent(eventId) {
  try {
    await apiCall(`/events/${eventId}/register`, 'POST');
    showToast('Registered for event! 🎉', 'success');
    loadEvents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Unregister from event
async function unregisterEvent(eventId) {
  if (!confirm('Unregister from this event?')) return;
  try {
    await apiCall(`/events/${eventId}/register`, 'DELETE');
    showToast('Unregistered from event.', 'info');
    loadEvents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Open modal to add event
function openModal(modalId) {
  document.getElementById(modalId).classList.remove('hidden');
}

// Close modal
function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

// Close modal if overlay clicked
function handleOverlayClick(e, modalId) {
  if (e.target.classList.contains('modal-overlay')) closeModal(modalId);
}

// Open modal in edit mode for an event
function openEditEvent(eventId) {
  const event = allEvents.find(e => e._id === eventId);
  if (!event) return;

  document.getElementById('eventModalTitle').textContent = 'Edit Event';
  document.getElementById('eventId').value          = event._id;
  document.getElementById('eventTitle').value       = event.title;
  document.getElementById('eventCategory').value    = event.category;
  document.getElementById('eventDescription').value = event.description;
  document.getElementById('eventDate').value        = event.date.slice(0, 16);
  document.getElementById('eventVenue').value       = event.venue;
  document.getElementById('eventMaxSeats').value    = event.maxSeats;

  openModal('eventModal');
}

// Save event (create or update)
async function saveEvent() {
  const id = document.getElementById('eventId').value;

  const body = {
    title:       document.getElementById('eventTitle').value.trim(),
    description: document.getElementById('eventDescription').value.trim(),
    date:        document.getElementById('eventDate').value,
    venue:       document.getElementById('eventVenue').value.trim(),
    category:    document.getElementById('eventCategory').value,
    maxSeats:    parseInt(document.getElementById('eventMaxSeats').value) || 100,
  };

  if (!body.title || !body.description || !body.date || !body.venue) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }

  try {
    if (id) {
      await apiCall(`/events/${id}`, 'PUT', body);
      showToast('Event updated! ✅', 'success');
    } else {
      await apiCall('/events', 'POST', body);
      showToast('Event created! 🎉', 'success');
    }
    closeModal('eventModal');
    resetEventForm();
    loadEvents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function resetEventForm() {
  document.getElementById('eventModalTitle').textContent = 'Add Event';
  document.getElementById('eventId').value = '';
  ['eventTitle','eventDescription','eventDate','eventVenue'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('eventMaxSeats').value = '100';
  document.getElementById('eventCategory').value = 'Technical';
}

// Delete event
async function deleteEvent(eventId) {
  if (!confirm('Are you sure you want to delete this event?')) return;
  try {
    await apiCall(`/events/${eventId}`, 'DELETE');
    showToast('Event deleted.', 'info');
    loadEvents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// PLACEMENTS PAGE
// ============================================================

async function loadPlacements() {
  const grid = document.getElementById('placementsGrid');
  grid.innerHTML = '<div class="loading-state"><div class="spinner"></div> Loading placements...</div>';

  try {
    allPlacements = await apiCall('/placements', 'GET');

    // Also get student's applications for checking applied status
    let myAppliedIds = new Set();
    if (currentUser.role === 'student') {
      const myApps = await apiCall('/applications', 'GET');
      myAppliedIds = new Set(myApps.map(a => a.placement._id));
    }

    renderPlacements(allPlacements, myAppliedIds);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

function renderPlacements(placements, appliedSet = new Set()) {
  const grid = document.getElementById('placementsGrid');

  if (placements.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:48px">No placement drives found.</div>';
    return;
  }

  grid.innerHTML = placements.map((p, i) => {
    const isApplied = appliedSet.has(p._id);
    const branches  = p.eligibility.branches.join(', ') || 'All Branches';
    const deadline  = p.deadline ? formatDateShort(p.deadline) : 'N/A';
    const driveDate = p.driveDate ? formatDateShort(p.driveDate) : 'TBD';

    return `
      <div class="card" style="animation-delay:${i * 0.05}s">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <span class="card-badge badge-${p.status.toLowerCase()}">${p.status}</span>
          ${isApplied ? '<span class="registered-badge">✓ Applied</span>' : ''}
        </div>

        <div class="card-title">
          <span style="font-size:0.75rem;color:var(--text-secondary);display:block;margin-bottom:2px">
            ${escHtml(p.companyName)}
          </span>
          ${escHtml(p.jobRole)}
        </div>

        <div class="card-desc">${escHtml(p.description)}</div>

        <div class="card-meta">
          <div class="card-meta-item">💰 Package: <strong>${escHtml(p.package)}</strong></div>
          <div class="card-meta-item">📊 Min CGPA: <strong>${p.eligibility.minCGPA}</strong></div>
          <div class="card-meta-item">🏫 Branches: <strong>${escHtml(branches)}</strong></div>
          <div class="card-meta-item">📅 Deadline: <strong>${deadline}</strong></div>
          <div class="card-meta-item">🗓️ Drive Date: <strong>${driveDate}</strong></div>
          ${p.eligibility.backlogsAllowed
            ? '<div class="card-meta-item" style="color:#6EE7B7">✓ Backlogs Allowed</div>'
            : '<div class="card-meta-item" style="color:#FCA5A5">✗ No Backlogs</div>'
          }
        </div>

        <div class="card-actions">
          ${currentUser.role === 'student' ? `
            ${!isApplied && p.status === 'Open'
              ? `<button class="btn-primary btn-sm" onclick="applyPlacement('${p._id}')">Apply Now</button>`
              : isApplied
                ? `<button class="btn-ghost btn-sm" disabled>Applied</button>`
                : `<button class="btn-ghost btn-sm" disabled>Closed</button>`
            }
          ` : `
            <button class="btn-primary btn-sm" onclick="openEditPlacement('${p._id}')">Edit</button>
            <button class="btn-danger btn-sm" onclick="deletePlacement('${p._id}')">Delete</button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

async function filterPlacements() {
  const search = document.getElementById('placementSearch').value.toLowerCase();
  const status = document.getElementById('placementStatusFilter').value;

  // Get applied set for student
  let appliedSet = new Set();
  if (currentUser.role === 'student') {
    try {
      const apps = await apiCall('/applications', 'GET');
      appliedSet = new Set(apps.map(a => a.placement._id));
    } catch (e) {}
  }

  const filtered = allPlacements.filter(p => {
    const matchSearch = p.companyName.toLowerCase().includes(search) ||
                        p.jobRole.toLowerCase().includes(search) ||
                        p.description.toLowerCase().includes(search);
    const matchStatus = !status || p.status === status;
    return matchSearch && matchStatus;
  });

  renderPlacements(filtered, appliedSet);
}

// Apply to placement
async function applyPlacement(placementId) {
  try {
    await apiCall('/applications', 'POST', { placementId });
    showToast('Application submitted! 🚀', 'success');
    loadPlacements();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Open edit placement modal
function openEditPlacement(placementId) {
  const p = allPlacements.find(p => p._id === placementId);
  if (!p) return;

  document.getElementById('placementModalTitle').textContent = 'Edit Placement';
  document.getElementById('placementId').value         = p._id;
  document.getElementById('placementCompany').value    = p.companyName;
  document.getElementById('placementRole').value       = p.jobRole;
  document.getElementById('placementDesc').value       = p.description;
  document.getElementById('placementPackage').value    = p.package;
  document.getElementById('placementCgpa').value       = p.eligibility.minCGPA;
  document.getElementById('placementBranches').value   = p.eligibility.branches.join(', ');
  document.getElementById('placementStatus').value     = p.status;
  document.getElementById('placementDeadline').value   = p.deadline ? p.deadline.slice(0, 10) : '';
  document.getElementById('placementDriveDate').value  = p.driveDate ? p.driveDate.slice(0, 10) : '';
  document.getElementById('placementBacklogs').checked = p.eligibility.backlogsAllowed;

  openModal('placementModal');
}

// Save placement (create or update)
async function savePlacement() {
  const id = document.getElementById('placementId').value;
  const branchesRaw = document.getElementById('placementBranches').value;
  const branches = branchesRaw.split(',').map(b => b.trim()).filter(Boolean);

  const body = {
    companyName: document.getElementById('placementCompany').value.trim(),
    jobRole:     document.getElementById('placementRole').value.trim(),
    description: document.getElementById('placementDesc').value.trim(),
    package:     document.getElementById('placementPackage').value.trim(),
    eligibility: {
      minCGPA:          parseFloat(document.getElementById('placementCgpa').value) || 0,
      branches,
      backlogsAllowed:  document.getElementById('placementBacklogs').checked,
    },
    status:      document.getElementById('placementStatus').value,
    deadline:    document.getElementById('placementDeadline').value,
    driveDate:   document.getElementById('placementDriveDate').value,
  };

  if (!body.companyName || !body.jobRole || !body.description || !body.package) {
    showToast('Please fill in all required fields.', 'error');
    return;
  }

  try {
    if (id) {
      await apiCall(`/placements/${id}`, 'PUT', body);
      showToast('Placement updated! ✅', 'success');
    } else {
      await apiCall('/placements', 'POST', body);
      showToast('Placement added! 🎉', 'success');
    }
    closeModal('placementModal');
    resetPlacementForm();
    loadPlacements();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function resetPlacementForm() {
  document.getElementById('placementModalTitle').textContent = 'Add Placement';
  document.getElementById('placementId').value = '';
  ['placementCompany','placementRole','placementDesc','placementPackage',
   'placementBranches','placementDeadline','placementDriveDate'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('placementCgpa').value    = '';
  document.getElementById('placementStatus').value  = 'Open';
  document.getElementById('placementBacklogs').checked = false;
}

// Delete placement
async function deletePlacement(placementId) {
  if (!confirm('Delete this placement? All applications will also be removed.')) return;
  try {
    await apiCall(`/placements/${placementId}`, 'DELETE');
    showToast('Placement deleted.', 'info');
    loadPlacements();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// APPLICATIONS PAGE (Admin)
// ============================================================

async function loadApplications() {
  const container = document.getElementById('applicationsTable');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div> Loading applications...</div>';

  try {
    const apps = await apiCall('/applications', 'GET');

    if (apps.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:48px">No applications yet.</div>';
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Branch / CGPA</th>
            <th>Company</th>
            <th>Role</th>
            <th>Applied On</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${apps.map(app => `
            <tr>
              <td>
                <div class="td-name">${escHtml(app.student.name)}</div>
                <div class="td-muted">${escHtml(app.student.email)}</div>
              </td>
              <td>
                <div>${escHtml(app.student.branch || '—')}</div>
                <div class="td-muted">CGPA: ${app.student.cgpa || '—'}</div>
              </td>
              <td class="td-name">${escHtml(app.placement.companyName)}</td>
              <td>${escHtml(app.placement.jobRole)}</td>
              <td class="td-muted">${formatDateShort(app.appliedAt)}</td>
              <td>
                <span class="status-badge status-${app.status.toLowerCase().replace(/\s+/g, '-')}">
                  ${app.status}
                </span>
                ${app.notes ? `<div class="td-muted" style="margin-top:4px;font-size:0.75rem">${escHtml(app.notes)}</div>` : ''}
              </td>
              <td>
                <button class="btn-primary btn-sm" onclick="openStatusModal('${app._id}', '${app.status}')">
                  Update
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

// Open status update modal
function openStatusModal(appId, currentStatus) {
  document.getElementById('statusAppId').value = appId;
  document.getElementById('statusSelect').value = currentStatus;
  document.getElementById('statusNotes').value = '';
  openModal('statusModal');
}

// Submit status update
async function updateAppStatus() {
  const appId  = document.getElementById('statusAppId').value;
  const status = document.getElementById('statusSelect').value;
  const notes  = document.getElementById('statusNotes').value.trim();

  try {
    await apiCall(`/applications/${appId}/status`, 'PUT', { status, notes });
    showToast(`Status updated to "${status}" ✅`, 'success');
    closeModal('statusModal');
    loadApplications();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// USERS PAGE (Admin)
// ============================================================

async function loadUsers() {
  const container = document.getElementById('usersTable');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div> Loading users...</div>';

  try {
    const users = await apiCall('/auth/users', 'GET');

    if (users.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:48px">No users found.</div>';
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Branch</th>
            <th>CGPA</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td class="td-name">${escHtml(u.name)}</td>
              <td class="td-muted">${escHtml(u.email)}</td>
              <td>
                <span class="status-badge ${u.role === 'admin' ? 'status-selected' : 'status-applied'}">
                  ${u.role}
                </span>
              </td>
              <td>${u.branch || '—'}</td>
              <td>${u.cgpa || '—'}</td>
              <td class="td-muted">${formatDateShort(u.createdAt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

// ============================================================
// MY APPLICATIONS PAGE (Student)
// ============================================================

async function loadMyApps() {
  const grid = document.getElementById('myAppsGrid');
  grid.innerHTML = '<div class="loading-state"><div class="spinner"></div> Loading your applications...</div>';

  try {
    const apps = await apiCall('/applications', 'GET');

    if (apps.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;padding:48px">
          You haven't applied to any placement drives yet.<br/>
          <a href="#" onclick="showPage('placements')" style="color:var(--accent);margin-top:8px;display:inline-block">
            Browse Placements →
          </a>
        </div>
      `;
      return;
    }

    grid.innerHTML = apps.map((app, i) => `
      <div class="card" style="animation-delay:${i * 0.05}s">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span class="card-title" style="font-size:0.9rem">${escHtml(app.placement.companyName)}</span>
          <span class="status-badge status-${app.status.toLowerCase().replace(/\s+/g, '-')}">
            ${app.status}
          </span>
        </div>
        <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;color:var(--text-primary)">
          ${escHtml(app.placement.jobRole)}
        </div>
        <div class="card-meta">
          <div class="card-meta-item">💰 Package: <strong>${escHtml(app.placement.package)}</strong></div>
          <div class="card-meta-item">📅 Applied: <strong>${formatDateShort(app.appliedAt)}</strong></div>
          ${app.notes
            ? `<div class="card-meta-item" style="color:var(--accent-light)">💬 Note: ${escHtml(app.notes)}</div>`
            : ''
          }
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
  }
}

// ============================================================
// API HELPER
// ============================================================

/**
 * Centralized fetch wrapper
 * @param {string} endpoint  - e.g. '/events'
 * @param {string} method    - GET, POST, PUT, DELETE
 * @param {object} body      - request body (for POST/PUT)
 * @param {boolean} auth     - whether to include Authorization header
 */
async function apiCall(endpoint, method = 'GET', body = null, auth = true) {
  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'An error occurred.');
  }

  return data;
}

// ============================================================
// UTILITY HELPERS
// ============================================================

/** Escape HTML to prevent XSS */
function escHtml(str) {
  if (typeof str !== 'string') return str || '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/** Format date to readable string */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/** Format date (short) */
function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Show toast notification */
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

/** Toggle sidebar (mobile) */
function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay') || createOverlay();
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const overlay = document.getElementById('sidebarOverlay');
  if (overlay) overlay.classList.remove('active');
}

function createOverlay() {
  const div = document.createElement('div');
  div.id = 'sidebarOverlay';
  div.className = 'sidebar-overlay';
  div.onclick = closeSidebar;
  document.body.appendChild(div);
  return div;
}