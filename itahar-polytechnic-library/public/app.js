/**
 * ITAHAR GOVERNMENT POLYTECHNIC - Full Stack Library Portal Client Application
 * Communicates with Node.js/Express REST APIs and MySQL Database
 */

// ─── Backend API Base URL ─────────────────────────────────────────────────────
// When deployed on Netlify, set VITE_API_BASE (or window.API_BASE) to your
// Railway / Render backend URL, e.g. https://itahar-library-api.up.railway.app
// When running locally the empty string routes through the same origin (port 3000).
const API_BASE = (typeof window !== 'undefined' && window.API_BASE) ? window.API_BASE.replace(/\/$/, '') : '';

// Application State
let books = [];
let currentUser = null;
let currentToken = null;
let audioEnabled = true;

// API Request Wrapper with JWT Authorization
async function apiRequest(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  // Prepend backend base URL (empty string = same origin = local dev)
  const url = API_BASE + endpoint;

  try {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `API error (${res.status})`);
    }
    return data;
  } catch (err) {
    console.error(`[API Error] ${method} ${endpoint}:`, err);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// AUDIO FEEDBACK SYNTHESIS (Web Audio API)
// -----------------------------------------------------------------------------
function playSound(type) {
  if (!audioEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'click') {
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'success') {
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.25);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'open') {
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(500, now + 0.15);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'close') {
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  } catch (e) {
    // Ignore quiet audio fallback
  }
}

function toggleAudio() {
  audioEnabled = !audioEnabled;
  const btn = document.getElementById('soundBtn');
  if (audioEnabled) {
    btn.classList.remove('opacity-40');
    showToast('Audio visualizer enabled', 'info');
  } else {
    btn.classList.add('opacity-40');
    showToast('Audio feedback muted', 'info');
  }
}

// -----------------------------------------------------------------------------
// PARTICLE CANVAS ENGINE
// -----------------------------------------------------------------------------
function initCanvasBackground() {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles = [];
  const particleCount = Math.floor(width / 25);

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2 + 0.5,
      color: Math.random() > 0.5 ? '#10b981' : '#00f3ff',
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.5 + 0.2
    });
  }

  function animateCanvas() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach((p, index) => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();

      // Connect nearby particles
      for (let j = index + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 110) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = (1 - dist / 110) * 0.15;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    });

    requestAnimationFrame(animateCanvas);
  }

  animateCanvas();
}

// -----------------------------------------------------------------------------
// NAVIGATION & TAB SWITCHING
// -----------------------------------------------------------------------------
function switchTab(tabName) {
  const allTabs = ['catalog', 'eresources', 'notices', 'analytics', 'student', 'librarian', 'admin'];
  
  allTabs.forEach(t => {
    const view = document.getElementById(`tab-${t}`);
    const navBtn = document.getElementById(`nav-${t}`);

    if (t === tabName) {
      if (view) {
        view.classList.remove('hidden');
        setTimeout(() => {
          view.classList.remove('opacity-0', 'translate-y-4');
          view.classList.add('opacity-100', 'translate-y-0');
        }, 30);
      }
      if (navBtn) {
        navBtn.className = 'px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/20';
      }
    } else {
      if (view) {
        view.classList.remove('opacity-100', 'translate-y-0');
        view.classList.add('opacity-0', 'translate-y-4');
        setTimeout(() => view.classList.add('hidden'), 250);
      }
      if (navBtn) {
        navBtn.className = 'px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-emerald-400 transition-all duration-300 hover:bg-slate-800/50';
      }
    }
  });

  // Load specific data when switching
  if (tabName === 'catalog') fetchBooks();
  else if (tabName === 'eresources') fetchEResources();
  else if (tabName === 'notices') fetchNotices();
  else if (tabName === 'analytics') fetchAnalytics();
  else if (tabName === 'student') fetchStudentPortal();
  else if (tabName === 'librarian') fetchLibrarianPanel();
  else if (tabName === 'admin') fetchAdminPanel();
}

// -----------------------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
  initCanvasBackground();
  
  // Restore stored session
  const storedToken = localStorage.getItem('itp_token');
  const storedUser = localStorage.getItem('itp_user');
  if (storedToken && storedUser) {
    currentToken = storedToken;
    try {
      currentUser = JSON.parse(storedUser);
      // Validate session with /api/auth/me
      const meData = await apiRequest('/api/auth/me');
      currentUser = meData.user;
      localStorage.setItem('itp_user', JSON.stringify(currentUser));
    } catch (e) {
      console.warn('Session expired, clearing storage');
      logout(false);
    }
  }

  updateAuthUI();
  fetchBooks();
  fetchLiveStats();
  if (currentUser) fetchNotifications();

  // Set default loan due date to +14 days in issue inputs
  const due = new Date();
  due.setDate(due.getDate() + 14);
  const dueStr = due.toISOString().split('T')[0];
  const libIssueDate = document.getElementById('libIssueDueDate');
  if (libIssueDate) libIssueDate.value = dueStr;
});

// -----------------------------------------------------------------------------
// AUTHENTICATION UI & FLOWS
// -----------------------------------------------------------------------------
function updateAuthUI() {
  const container = document.getElementById('authActionsContainer');
  const notifWrapper = document.getElementById('notifWrapper');
  const librarianAddBtn = document.getElementById('librarianQuickAdd');
  const librarianAddRes = document.getElementById('librarianAddResourceBtn');
  const librarianAddNot = document.getElementById('librarianAddNoticeBtn');

  if (!currentUser) {
    if (notifWrapper) notifWrapper.classList.add('hidden');
    if (librarianAddBtn) librarianAddBtn.classList.add('hidden');
    if (librarianAddRes) librarianAddRes.classList.add('hidden');
    if (librarianAddNot) librarianAddNot.classList.add('hidden');

    container.innerHTML = `
      <button onclick="openAuthModal('login'); playSound('open');" class="px-4 py-2 rounded-2xl glass-card text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:border-emerald-500/50 transition-all">
        <i class="fa-solid fa-user-graduate mr-1.5 text-emerald-400"></i> Student Login
      </button>
      <button onclick="openAuthModal('staff'); playSound('open');" class="relative group overflow-hidden px-4 py-2 rounded-2xl font-bold text-xs uppercase tracking-wider text-slate-950 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-cyan-500/20">
        <span class="absolute inset-0 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 group-hover:brightness-110 transition-all"></span>
        <span class="relative z-10 flex items-center space-x-1.5">
          <i class="fa-solid fa-user-shield text-xs"></i>
          <span>Staff Portal</span>
        </span>
      </button>
    `;
    return;
  }

  // User is logged in
  if (notifWrapper) notifWrapper.classList.remove('hidden');

  let rolePill = '';
  let panelBtn = '';

  if (currentUser.role === 'admin') {
    rolePill = `<span class="px-2.5 py-1 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30 text-[10px] font-black uppercase">Admin</span>`;
    panelBtn = `
      <button onclick="switchTab('admin'); playSound('click');" class="px-3.5 py-2 rounded-xl bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs font-extrabold uppercase hover:bg-pink-500/30 transition-all">
        <i class="fa-solid fa-crown mr-1"></i> Admin Console
      </button>
      <button onclick="switchTab('librarian'); playSound('click');" class="px-3.5 py-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-extrabold uppercase hover:bg-cyan-500/30 transition-all">
        <i class="fa-solid fa-shield-halved mr-1"></i> Circulation
      </button>
    `;
    if (librarianAddBtn) librarianAddBtn.classList.remove('hidden');
    if (librarianAddRes) librarianAddRes.classList.remove('hidden');
    if (librarianAddNot) librarianAddNot.classList.remove('hidden');
  } else if (currentUser.role === 'librarian') {
    rolePill = `<span class="px-2.5 py-1 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-black uppercase">Librarian</span>`;
    panelBtn = `
      <button onclick="switchTab('librarian'); playSound('click');" class="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 text-xs font-black uppercase hover:scale-105 active:scale-95 transition-all shadow-lg shadow-cyan-500/20">
        <i class="fa-solid fa-shield-halved mr-1"></i> Librarian Desk
      </button>
    `;
    if (librarianAddBtn) librarianAddBtn.classList.remove('hidden');
    if (librarianAddRes) librarianAddRes.classList.remove('hidden');
    if (librarianAddNot) librarianAddNot.classList.remove('hidden');
  } else {
    // Student
    rolePill = `<span class="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase">${currentUser.student_id || 'Student'}</span>`;
    panelBtn = `
      <button onclick="switchTab('student'); playSound('click');" class="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 text-xs font-black uppercase hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/20">
        <i class="fa-solid fa-graduation-cap mr-1"></i> My Portal
      </button>
    `;
    if (librarianAddBtn) librarianAddBtn.classList.add('hidden');
    if (librarianAddRes) librarianAddRes.classList.add('hidden');
    if (librarianAddNot) librarianAddNot.classList.add('hidden');
  }

  container.innerHTML = `
    <div class="flex items-center space-x-2">
      ${rolePill}
      ${panelBtn}
      <button onclick="logout(); playSound('close');" class="w-9 h-9 rounded-xl glass-card flex items-center justify-center text-slate-400 hover:text-pink-400 hover:border-pink-500/40 transition-all" title="Logout">
        <i class="fa-solid fa-power-off text-xs"></i>
      </button>
    </div>
  `;
}

function openAuthModal(mode = 'login') {
  const modal = document.getElementById('authModal');
  const content = document.getElementById('authModalContent');
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-90');
    content.classList.add('scale-100');
  }, 10);

  if (mode === 'staff') {
    switchAuthTab('demo');
  } else {
    switchAuthTab('login');
  }
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  const content = document.getElementById('authModalContent');
  content.classList.remove('scale-100');
  content.classList.add('scale-90');
  modal.classList.add('opacity-0');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const regForm = document.getElementById('registerForm');
  const demoBox = document.getElementById('demoAuthBox');
  const tabLogin = document.getElementById('authTab-login');
  const tabReg = document.getElementById('authTab-register');
  const tabDemo = document.getElementById('authTab-demo');

  const tabs = [tabLogin, tabReg, tabDemo];
  tabs.forEach(t => {
    t.className = 'py-2.5 rounded-xl text-slate-400 hover:text-white transition-all';
  });

  loginForm.classList.add('hidden');
  regForm.classList.add('hidden');
  demoBox.classList.add('hidden');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    tabLogin.className = 'py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black transition-all';
  } else if (tab === 'register') {
    regForm.classList.remove('hidden');
    tabReg.className = 'py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black transition-all';
  } else if (tab === 'demo') {
    demoBox.classList.remove('hidden');
    tabDemo.className = 'py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-black transition-all';
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const login = document.getElementById('loginId').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const data = await apiRequest('/api/auth/login', 'POST', { login, password });
    currentToken = data.token;
    currentUser = data.user;
    localStorage.setItem('itp_token', currentToken);
    localStorage.setItem('itp_user', JSON.stringify(currentUser));

    closeAuthModal();
    playSound('success');
    showToast(data.message || `Welcome ${currentUser.name}!`, 'success');
    updateAuthUI();
    fetchBooks();
    fetchLiveStats();
    fetchNotifications();

    if (currentUser.role === 'admin') switchTab('admin');
    else if (currentUser.role === 'librarian') switchTab('librarian');
    else switchTab('student');
  } catch (err) {
    playSound('close');
    showToast(err.message, 'error');
  }
}

async function fillDemoAndLogin(login, password) {
  document.getElementById('loginId').value = login;
  document.getElementById('loginPassword').value = password;
  switchAuthTab('login');
  
  try {
    const data = await apiRequest('/api/auth/login', 'POST', { login, password });
    currentToken = data.token;
    currentUser = data.user;
    localStorage.setItem('itp_token', currentToken);
    localStorage.setItem('itp_user', JSON.stringify(currentUser));

    closeAuthModal();
    playSound('success');
    showToast(`Logged in as ${currentUser.name} (${currentUser.role})`, 'success');
    updateAuthUI();
    fetchBooks();
    fetchLiveStats();
    fetchNotifications();

    if (currentUser.role === 'admin') switchTab('admin');
    else if (currentUser.role === 'librarian') switchTab('librarian');
    else switchTab('student');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const payload = {
    student_id: document.getElementById('regRoll').value,
    name: document.getElementById('regName').value,
    email: document.getElementById('regEmail').value,
    department: document.getElementById('regDept').value,
    semester: document.getElementById('regSemester').value,
    phone: document.getElementById('regPhone').value,
    password: document.getElementById('regPassword').value
  };

  try {
    const data = await apiRequest('/api/auth/register', 'POST', payload);
    closeAuthModal();
    playSound('success');
    showToast(data.message, 'success');
    e.target.reset();
  } catch (err) {
    playSound('close');
    showToast(err.message, 'error');
  }
}

function logout(notify = true) {
  currentToken = null;
  currentUser = null;
  localStorage.removeItem('itp_token');
  localStorage.removeItem('itp_user');
  updateAuthUI();
  switchTab('catalog');
  if (notify) showToast('Logged out of session', 'info');
}

// -----------------------------------------------------------------------------
// LIVE CATALOG & BOOKS RENDERER
// -----------------------------------------------------------------------------
async function fetchBooks() {
  const query = document.getElementById('searchInput') ? document.getElementById('searchInput').value.trim() : '';
  const category = document.getElementById('categoryFilter') ? document.getElementById('categoryFilter').value : 'all';
  const availability = document.getElementById('availabilityFilter') ? document.getElementById('availabilityFilter').value : 'all';

  let url = `/api/books?limit=100`;
  if (query) url += `&search=${encodeURIComponent(query)}`;
  if (category && category !== 'all') url += `&category=${encodeURIComponent(category)}`;
  if (availability && availability !== 'all') url += `&status=${encodeURIComponent(availability)}`;

  try {
    const data = await apiRequest(url);
    books = data.books || [];
    renderBooks(books);
    populateBookSelectOptions(books);
  } catch (err) {
    console.error('Fetch books error:', err);
  }
}

function handleSearch() {
  fetchBooks();
}

function renderBooks(list) {
  const grid = document.getElementById('booksGrid');
  const countEl = document.getElementById('showingCount');
  if (countEl) countEl.innerText = list.length;
  if (!grid) return;

  grid.innerHTML = '';

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-20 text-center glass-card rounded-3xl border border-slate-800">
        <i class="fa-solid fa-ghost text-5xl text-emerald-400 mb-4 animate-bounce"></i>
        <h4 class="font-extrabold text-xl">No Holdings Match Query</h4>
        <p class="text-xs text-slate-400 mt-2">Try adjusting your search terms or filter category settings.</p>
      </div>
    `;
    return;
  }

  list.forEach((book, idx) => {
    const isAvailable = book.available_copies > 0;
    const card = document.createElement('div');
    
    card.className = 'glass-card p-6 rounded-3xl flex flex-col justify-between shadow-xl relative overflow-hidden group hover:border-emerald-500/50 transition-all duration-300';
    card.setAttribute('data-tilt', '');
    card.setAttribute('data-tilt-max', '10');
    card.setAttribute('data-tilt-speed', '400');

    // Active loan snippet if issued
    let loanSnippet = '';
    if (book.active_loans && book.active_loans.length > 0) {
      const active = book.active_loans[0];
      loanSnippet = `
        <div class="mb-4 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[10px] font-medium text-amber-400 truncate">
          <i class="fa-solid fa-user-clock mr-1"></i> Loan: ${active.student_roll || active.student_name} (Due: ${active.due_date})
        </div>
      `;
    }

    // Role-specific action buttons
    let actionButtons = '';
    const isStaff = currentUser && ['admin', 'librarian'].includes(currentUser.role);

    if (isStaff) {
      actionButtons = `
        <div class="grid grid-cols-2 gap-2">
          <button onclick="openIssueModalWithBook(${book.id}); playSound('open');" class="py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition-all">
            Issue
          </button>
          <button onclick="handleDeleteBook(${book.id}); playSound('close');" class="py-2.5 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/30 hover:bg-pink-500/20 font-bold text-xs uppercase tracking-wider transition-all">
            Delete
          </button>
        </div>
      `;
    } else {
      actionButtons = `
        <div class="flex items-center space-x-2">
          <button onclick="viewBookDetails(${book.id}); playSound('click');" class="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs uppercase tracking-wider transition-all">
            Details
          </button>
          ${isAvailable ? `
            <button onclick="handleStudentBorrowOrReserve(${book.id}, 'borrow'); playSound('open');" class="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:scale-[1.03] active:scale-95 transition-all">
              Borrow
            </button>
          ` : `
            <button onclick="handleStudentBorrowOrReserve(${book.id}, 'reserve'); playSound('open');" class="flex-1 py-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 font-bold text-xs uppercase tracking-wider transition-all">
              Reserve
            </button>
          `}
        </div>
      `;
    }

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-4">
          <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isAvailable ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shimmer-badge' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'}">
            ${isAvailable ? `• ${book.available_copies}/${book.total_copies} On Shelf` : '• Checked Out'}
          </span>
          <span class="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">ISBN: ${book.isbn.slice(-6)}</span>
        </div>

        <h4 class="font-extrabold text-lg text-slate-100 group-hover:text-emerald-300 transition-colors line-clamp-2 leading-snug mb-1">${book.title}</h4>
        <p class="text-xs font-semibold text-slate-400 mb-3">By ${book.author_name}</p>

        <div class="flex flex-wrap items-center gap-1.5 mb-6">
          <span class="px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-slate-900 text-slate-300 border border-slate-800">
            ${book.category_name}
          </span>
          ${book.call_number ? `<span class="px-2 py-0.5 rounded-lg text-[9px] font-mono bg-slate-900/60 text-slate-400 border border-slate-800/80">${book.call_number}</span>` : ''}
        </div>
      </div>

      <div>
        ${loanSnippet}
        ${actionButtons}
      </div>
    `;

    grid.appendChild(card);
  });

  if (window.VanillaTilt) {
    VanillaTilt.init(document.querySelectorAll("[data-tilt]"));
  }
}

function populateBookSelectOptions(list) {
  const sel = document.getElementById('libIssueBookSelect');
  if (!sel) return;

  sel.innerHTML = '<option value="">Select an Available Book...</option>';
  list.filter(b => b.available_copies > 0).forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.innerText = `${b.title} (${b.available_copies} available)`;
    sel.appendChild(opt);
  });
}

// -----------------------------------------------------------------------------
// LIVE METRICS & STATS
// -----------------------------------------------------------------------------
async function fetchLiveStats() {
  try {
    let total = 0, available = 0, issued = 0, activeStudents = 0;

    if (currentUser && ['admin', 'librarian'].includes(currentUser.role)) {
      const data = await apiRequest('/api/admin/dashboard-stats');
      const stats = data.stats;
      total = stats.totalBooks;
      available = stats.availableCopies;
      issued = stats.activeLoans;
      activeStudents = stats.activeStudents;

      // Update badge
      const badge = document.getElementById('liveDbBadge');
      if (badge) badge.innerText = `${stats.databaseAdapter} ACTIVE`;
    } else {
      // Public fallback calculation from catalog
      total = books.length;
      available = books.reduce((sum, b) => sum + (b.available_copies || 0), 0);
      issued = books.reduce((sum, b) => sum + ((b.total_copies || 1) - (b.available_copies || 0)), 0);
      activeStudents = 1840;
    }

    animateNumber('statTotalBooks', total);
    animateNumber('statAvailableBooks', available);
    animateNumber('statIssuedBooks', issued);
    animateNumber('statActiveMembers', activeStudents);
  } catch (err) {
    console.warn('Stats fetch warning:', err);
  }
}

function animateNumber(elementId, targetNum) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const startNum = parseInt(el.innerText) || 0;
  const duration = 600;
  const steps = 15;
  const stepTime = duration / steps;
  let currentStep = 0;

  const timer = setInterval(() => {
    currentStep++;
    const progress = currentStep / steps;
    const currentVal = Math.round(startNum + (targetNum - startNum) * progress);
    el.innerText = currentVal.toLocaleString();

    if (currentStep >= steps) {
      clearInterval(timer);
      el.innerText = targetNum.toLocaleString();
    }
  }, stepTime);
}

// -----------------------------------------------------------------------------
// E-RESOURCES TAB
// -----------------------------------------------------------------------------
async function fetchEResources() {
  const grid = document.getElementById('eresourcesGrid');
  if (!grid) return;

  try {
    const data = await apiRequest('/api/eresources');
    const resources = data.resources || [];

    grid.innerHTML = '';
    if (resources.length === 0) {
      grid.innerHTML = '<p class="col-span-full text-center text-xs text-slate-400 py-10">No digital resources currently listed.</p>';
      return;
    }

    resources.forEach(r => {
      const card = document.createElement('div');
      card.className = 'glass-card p-6 rounded-3xl hover:border-cyan-400/50 transition-all group flex flex-col justify-between';
      card.setAttribute('data-tilt', '');

      let icon = 'fa-atom';
      let theme = 'text-cyan-400 bg-cyan-500/10';
      if (r.resource_type === 'journal') {
        icon = 'fa-microchip';
        theme = 'text-emerald-400 bg-emerald-500/10';
      } else if (r.resource_type === 'syllabus') {
        icon = 'fa-graduation-cap';
        theme = 'text-purple-400 bg-purple-500/10';
      }

      card.innerHTML = `
        <div>
          <div class="w-14 h-14 rounded-2xl ${theme} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
            <i class="fa-solid ${icon}"></i>
          </div>
          <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 mb-2 inline-block">
            ${r.category_name || 'General Engineering'}
          </span>
          <h4 class="font-extrabold text-base mb-2 text-slate-100">${r.title}</h4>
          <p class="text-slate-400 text-xs mb-6 leading-relaxed line-clamp-3">${r.description || ''}</p>
        </div>
        <div class="flex items-center justify-between pt-4 border-t border-slate-800">
          <a href="${r.external_url}" target="_blank" onclick="playSound('click')" class="inline-flex items-center text-xs font-extrabold uppercase tracking-wider text-cyan-400 hover:text-cyan-300">
            Launch Database <i class="fa-solid fa-arrow-up-right-from-square ml-2 text-[10px]"></i>
          </a>
          ${currentUser && ['admin', 'librarian'].includes(currentUser.role) ? `
            <button onclick="handleDeleteEResource(${r.id}); playSound('close');" class="text-slate-500 hover:text-pink-400 text-xs" title="Delete Resource">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : ''}
        </div>
      `;
      grid.appendChild(card);
    });

    if (window.VanillaTilt) VanillaTilt.init(document.querySelectorAll("[data-tilt]"));
  } catch (err) {
    console.error('Fetch e-resources error:', err);
  }
}

// -----------------------------------------------------------------------------
// NOTICES TAB
// -----------------------------------------------------------------------------
async function fetchNotices() {
  const container = document.getElementById('noticesContainer');
  if (!container) return;

  try {
    const data = await apiRequest('/api/notices');
    const notices = data.notices || [];

    container.innerHTML = '';
    if (notices.length === 0) {
      container.innerHTML = '<p class="text-xs text-slate-400 text-center py-8">No notices posted at this time.</p>';
      return;
    }

    notices.forEach(n => {
      const isPinned = n.is_pinned === 1;
      const el = document.createElement('div');
      el.className = `p-5 rounded-2xl glass-card border ${isPinned ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-slate-800'} space-y-2 relative`;

      el.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            ${isPinned ? '<span class="text-xs text-emerald-400"><i class="fa-solid fa-thumbtack mr-1"></i>PINNED</span>' : ''}
            <span class="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">${n.category}</span>
          </div>
          <span class="text-[10px] text-slate-500 font-medium">${new Date(n.created_at).toLocaleDateString()}</span>
        </div>
        <h4 class="font-bold text-base text-slate-100">${n.title}</h4>
        <p class="text-xs text-slate-300 leading-relaxed">${n.content}</p>
        <div class="flex items-center justify-between pt-2 text-[10px] text-slate-500">
          <span>By ${n.author_name || 'Office of Chief Librarian'}</span>
          ${currentUser && ['admin', 'librarian'].includes(currentUser.role) ? `
            <button onclick="handleDeleteNotice(${n.id}); playSound('close');" class="hover:text-pink-400">
              <i class="fa-solid fa-trash mr-1"></i>Delete
            </button>
          ` : ''}
        </div>
      `;
      container.appendChild(el);
    });
  } catch (err) {
    console.error('Fetch notices error:', err);
  }
}

// -----------------------------------------------------------------------------
// ANALYTICS TAB
// -----------------------------------------------------------------------------
async function fetchAnalytics() {
  const deptContainer = document.getElementById('deptBarsContainer');
  const topList = document.getElementById('topBooksList');
  if (!deptContainer) return;

  try {
    const data = await apiRequest('/api/admin/analytics');
    const { departmentShare, topBooks } = data.analytics;

    // Render department share
    deptContainer.innerHTML = '';
    const colors = [
      'from-emerald-500 to-teal-400 text-emerald-400',
      'from-cyan-500 to-blue-500 text-cyan-400',
      'from-purple-500 to-pink-500 text-purple-400',
      'from-amber-500 to-orange-500 text-amber-400'
    ];

    departmentShare.forEach((d, i) => {
      const colorScheme = colors[i % colors.length];
      const barColor = colorScheme.split(' ')[0] + ' ' + colorScheme.split(' ')[1];
      const textColor = colorScheme.split(' ')[2];

      const item = document.createElement('div');
      item.innerHTML = `
        <div class="flex justify-between text-xs font-bold mb-1.5">
          <span>${d.department}</span>
          <span class="${textColor}">${d.percentage}% (${d.count} loans)</span>
        </div>
        <div class="w-full bg-slate-900 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
          <div class="bg-gradient-to-r ${barColor} h-full rounded-full transition-all duration-1000" style="width: ${d.percentage}%;"></div>
        </div>
      `;
      deptContainer.appendChild(item);
    });

    // Top books
    if (topList) {
      topList.innerHTML = '';
      topBooks.forEach((b, idx) => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between py-1.5 border-b border-slate-800/80';
        row.innerHTML = `
          <div class="truncate mr-3">
            <span class="font-extrabold text-slate-200">#${idx + 1} ${b.title}</span>
            <span class="block text-[10px] text-slate-500">${b.author}</span>
          </div>
          <span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">${b.total_borrows} issues</span>
        `;
        topList.appendChild(row);
      });
    }
  } catch (err) {
    console.warn('Analytics fetch error:', err);
  }
}

// -----------------------------------------------------------------------------
// STUDENT PORTAL WORKSPACE
// -----------------------------------------------------------------------------
async function fetchStudentPortal() {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  // Populate Banner
  const nameEl = document.getElementById('studentProfileName');
  const rollEl = document.getElementById('studentProfileRoll');
  const deptEl = document.getElementById('studentProfileDept');
  if (nameEl) nameEl.innerText = currentUser.name;
  if (rollEl) rollEl.innerText = currentUser.student_id || 'STUDENT';
  if (deptEl) deptEl.innerText = `${currentUser.department || 'Polytechnic Engineering'} • ${currentUser.semester || 'Semester 1'}`;

  // Fetch loans, reservations, requests, fines
  try {
    const [loansData, resData, reqData, finesData] = await Promise.all([
      apiRequest('/api/loans/my-loans'),
      apiRequest('/api/reservations/my'),
      apiRequest('/api/requests/my'),
      apiRequest('/api/fines/my')
    ]);

    const loans = loansData.loans || [];
    const activeLoans = loans.filter(l => l.status === 'active' || l.status === 'overdue');

    // Update Student Summary Stats
    const actLoansEl = document.getElementById('studentStatActiveLoans');
    const resCountEl = document.getElementById('studentStatReservations');
    const finesEl = document.getElementById('studentStatFines');
    const fineBadge = document.getElementById('studentFinesStatusBadge');

    if (actLoansEl) actLoansEl.innerText = activeLoans.length;
    if (resCountEl) resCountEl.innerText = (resData.reservations || []).length;
    if (finesEl) finesEl.innerText = `₹${finesData.totalUnpaid}`;
    if (fineBadge) {
      if (parseFloat(finesData.totalUnpaid) > 0) {
        fineBadge.className = 'text-[10px] font-black uppercase px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 border border-pink-500/30';
        fineBadge.innerText = 'Dues Pending';
      } else {
        fineBadge.className = 'text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
        fineBadge.innerText = 'Clean';
      }
    }

    // Render Active Checked Out Loans with Due Countdown
    const activeContainer = document.getElementById('studentActiveLoansList');
    if (activeContainer) {
      activeContainer.innerHTML = '';
      if (activeLoans.length === 0) {
        activeContainer.innerHTML = '<p class="text-xs text-slate-400 p-4 glass-card rounded-2xl text-center">No active books currently borrowed.</p>';
      } else {
        activeLoans.forEach(loan => {
          const card = document.createElement('div');
          const isOverdue = loan.is_overdue;
          card.className = `p-4 rounded-2xl glass-card border ${isOverdue ? 'border-amber-500/50 bg-amber-500/5' : 'border-emerald-500/30'} flex flex-col sm:flex-row sm:items-center justify-between gap-4`;

          card.innerHTML = `
            <div>
              <div class="flex items-center space-x-2 mb-1">
                <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase ${isOverdue ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400'}">
                  ${isOverdue ? `Overdue by ${Math.abs(loan.days_remaining)} days` : `${loan.days_remaining} days left`}
                </span>
                <span class="text-[10px] font-mono text-slate-400">Barcode: ${loan.barcode}</span>
              </div>
              <h4 class="font-extrabold text-base text-slate-100">${loan.title}</h4>
              <p class="text-xs text-slate-400 mt-0.5">Borrowed on: ${loan.issue_date} • Expected Due: <strong class="text-slate-200">${loan.due_date}</strong></p>
            </div>

            <div class="flex items-center space-x-2">
              ${!isOverdue && loan.renewal_count < 1 ? `
                <button onclick="handleRenewLoan(${loan.id}); playSound('click');" class="px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 font-bold text-xs uppercase tracking-wider transition-all">
                  <i class="fa-solid fa-arrows-rotate mr-1"></i> Renew 14d
                </button>
              ` : ''}
              ${isOverdue ? `
                <span class="text-xs font-bold text-amber-400 px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-500/30">
                  Return at Desk
                </span>
              ` : ''}
            </div>
          `;
          activeContainer.appendChild(card);
        });
      }
    }

    // Render Reservations
    const resvContainer = document.getElementById('studentReservationsList');
    if (resvContainer) {
      resvContainer.innerHTML = '';
      const list = resData.reservations || [];
      if (list.length === 0) {
        resvContainer.innerHTML = '<p class="text-xs text-slate-400 p-4 glass-card rounded-2xl text-center">No active book reservations.</p>';
      } else {
        list.forEach(r => {
          const item = document.createElement('div');
          item.className = 'p-3.5 rounded-2xl glass-card border border-slate-800 flex items-center justify-between text-xs';
          item.innerHTML = `
            <div>
              <span class="font-bold text-slate-200 block">${r.book_title}</span>
              <span class="text-[10px] text-slate-400">Status: <strong class="text-cyan-400 uppercase">${r.status.replace(/_/g, ' ')}</strong></span>
            </div>
            ${r.status === 'pending' || r.status === 'ready_for_pickup' ? `
              <button onclick="handleCancelReservation(${r.id}); playSound('close');" class="text-slate-400 hover:text-pink-400 text-xs" title="Cancel Reservation">
                <i class="fa-solid fa-xmark"></i>
              </button>
            ` : ''}
          `;
          resvContainer.appendChild(item);
        });
      }
    }

    // Render Acquisition Requests
    const reqContainer = document.getElementById('studentRequestsList');
    if (reqContainer) {
      reqContainer.innerHTML = '';
      const list = reqData.requests || [];
      if (list.length === 0) {
        reqContainer.innerHTML = '<p class="text-xs text-slate-400 p-4 glass-card rounded-2xl text-center">No purchase requests submitted yet.</p>';
      } else {
        list.forEach(reqItem => {
          const item = document.createElement('div');
          item.className = 'p-3.5 rounded-2xl glass-card border border-slate-800 text-xs space-y-1';
          item.innerHTML = `
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-200">${reqItem.title}</span>
              <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-900 ${reqItem.status === 'approved' ? 'text-emerald-400 border border-emerald-500/30' : 'text-slate-400'}">${reqItem.status}</span>
            </div>
            <p class="text-[10px] text-slate-400">By ${reqItem.author}</p>
            ${reqItem.admin_remarks ? `<p class="text-[10px] text-cyan-300 italic">Remarks: ${reqItem.admin_remarks}</p>` : ''}
          `;
          reqContainer.appendChild(item);
        });
      }
    }

    // Render Complete History Table
    const histTable = document.getElementById('studentHistoryTableBody');
    if (histTable) {
      histTable.innerHTML = '';
      if (loans.length === 0) {
        histTable.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">No borrowing records on file.</td></tr>';
      } else {
        loans.forEach(loan => {
          const tr = document.createElement('tr');
          tr.className = 'hover:bg-slate-900/40 transition-colors';
          tr.innerHTML = `
            <td class="p-3.5 font-bold text-slate-200">${loan.title}</td>
            <td class="p-3.5 font-mono text-slate-400">${loan.barcode}</td>
            <td class="p-3.5 text-slate-400">${loan.issue_date}</td>
            <td class="p-3.5 text-slate-300 font-semibold">${loan.due_date}</td>
            <td class="p-3.5 text-slate-400">${loan.return_date || '<span class="text-amber-400">Active</span>'}</td>
            <td class="p-3.5">
              <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase ${loan.status === 'returned' ? 'bg-slate-800 text-slate-300' : 'bg-emerald-500/20 text-emerald-400'}">
                ${loan.status}
              </span>
            </td>
          `;
          histTable.appendChild(tr);
        });
      }
    }

  } catch (err) {
    console.error('Fetch student portal error:', err);
  }
}

// -----------------------------------------------------------------------------
// LIBRARIAN PANEL WORKSPACE
// -----------------------------------------------------------------------------
async function fetchLibrarianPanel() {
  if (!currentUser || !['admin', 'librarian'].includes(currentUser.role)) {
    showToast('Unauthorized access. Librarian role required.', 'error');
    switchTab('catalog');
    return;
  }

  try {
    const [overdueData, requestsData] = await Promise.all([
      apiRequest('/api/loans/overdue'),
      apiRequest('/api/requests/all')
    ]);

    // Overdue List
    const overdueList = document.getElementById('librarianOverdueList');
    const badge = document.getElementById('overdueCountBadge');
    const overdue = overdueData.overdue || [];

    if (badge) badge.innerText = `${overdue.length} Overdue`;
    if (overdueList) {
      overdueList.innerHTML = '';
      if (overdue.length === 0) {
        overdueList.innerHTML = '<p class="text-xs text-emerald-400 p-4 glass-card rounded-2xl text-center">All borrowed holdings are within their allowed loan duration! Zero overdues.</p>';
      } else {
        overdue.forEach(o => {
          const item = document.createElement('div');
          item.className = 'p-4 rounded-2xl glass-card border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs';
          item.innerHTML = `
            <div>
              <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                ${o.overdue_days} Days Overdue • Fine: ₹${o.current_fine}
              </span>
              <h4 class="font-bold text-slate-100 text-sm mt-1">${o.book_title}</h4>
              <p class="text-slate-400 text-[11px]">Student: <strong class="text-slate-200">${o.student_name}</strong> (Roll: ${o.student_roll}) • Phone: ${o.phone || 'N/A'}</p>
            </div>
            <button onclick="handleLibrarianReturnLoan(${o.id}); playSound('success');" class="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:scale-105 active:scale-95 transition-all">
              Process Return
            </button>
          `;
          overdueList.appendChild(item);
        });
      }
    }

    // Acquisition Requests Queue
    const reqQueue = document.getElementById('librarianRequestsQueue');
    const requests = requestsData.requests || [];
    if (reqQueue) {
      reqQueue.innerHTML = '';
      const pendingReqs = requests.filter(r => r.status === 'pending');
      if (pendingReqs.length === 0) {
        reqQueue.innerHTML = '<p class="text-xs text-slate-400 p-4 glass-card rounded-2xl text-center">No student requests currently pending review.</p>';
      } else {
        pendingReqs.forEach(r => {
          const item = document.createElement('div');
          item.className = 'p-4 rounded-2xl glass-card border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs';
          item.innerHTML = `
            <div class="space-y-1">
              <span class="font-bold text-slate-100 text-sm">${r.title}</span>
              <p class="text-slate-400 text-[11px]">By ${r.author} • Requested by: <strong>${r.student_name}</strong> (${r.student_roll})</p>
              <p class="text-slate-300 text-[11px] italic">"${r.reason || ''}"</p>
            </div>
            <div class="flex items-center space-x-2">
              <button onclick="handleReviewRequest(${r.id}, 'approved'); playSound('success');" class="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 font-bold text-xs uppercase">
                Approve
              </button>
              <button onclick="handleReviewRequest(${r.id}, 'rejected'); playSound('close');" class="px-3.5 py-1.5 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30 hover:bg-pink-500/30 font-bold text-xs uppercase">
                Reject
              </button>
            </div>
          `;
          reqQueue.appendChild(item);
        });
      }
    }
  } catch (err) {
    console.error('Librarian panel error:', err);
  }
}

// -----------------------------------------------------------------------------
// ADMIN PANEL WORKSPACE
// -----------------------------------------------------------------------------
async function fetchAdminPanel() {
  if (!currentUser || currentUser.role !== 'admin') {
    showToast('Unauthorized. Admin privilege required.', 'error');
    switchTab('catalog');
    return;
  }

  try {
    const [pendingData, logsData, settingsData] = await Promise.all([
      apiRequest('/api/students?status=pending'),
      apiRequest('/api/admin/activity-logs?limit=40'),
      apiRequest('/api/admin/settings')
    ]);

    // Pending Student Approvals
    const pendingList = document.getElementById('adminPendingStudentsList');
    const badge = document.getElementById('adminPendingCountBadge');
    const students = pendingData.students || [];

    if (badge) badge.innerText = `${students.length} Pending`;
    if (pendingList) {
      pendingList.innerHTML = '';
      if (students.length === 0) {
        pendingList.innerHTML = '<p class="text-xs text-emerald-400 p-4 glass-card rounded-2xl text-center">Zero pending registrations. All student accounts are up to date!</p>';
      } else {
        students.forEach(s => {
          const item = document.createElement('div');
          item.className = 'p-4 rounded-2xl glass-card border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs';
          item.innerHTML = `
            <div>
              <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                ${s.department} • ${s.semester || 'Semester 1'}
              </span>
              <h4 class="font-bold text-slate-100 text-sm mt-1">${s.name}</h4>
              <p class="text-slate-400 text-[11px]">Roll: <strong class="text-slate-200">${s.student_id}</strong> • Email: ${s.email} • Phone: ${s.phone || 'N/A'}</p>
            </div>
            <div class="flex items-center space-x-2">
              <button onclick="handleApproveStudent(${s.id}); playSound('success');" class="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider hover:scale-105 active:scale-95 transition-all">
                Authorize Account
              </button>
              <button onclick="handleRejectStudent(${s.id}); playSound('close');" class="px-4 py-2 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/30 hover:bg-pink-500/20 font-bold text-xs uppercase tracking-wider transition-all">
                Reject
              </button>
            </div>
          `;
          pendingList.appendChild(item);
        });
      }
    }

    // Populate Settings form
    const settings = settingsData.settings || [];
    settings.forEach(set => {
      if (set.setting_key === 'max_loan_days') document.getElementById('settingMaxDays').value = set.setting_value;
      if (set.setting_key === 'daily_fine_rate') document.getElementById('settingDailyFine').value = set.setting_value;
      if (set.setting_key === 'max_books_per_student') document.getElementById('settingMaxBooks').value = set.setting_value;
    });

    // Populate Activity Logs Table
    const logsBody = document.getElementById('adminActivityLogsBody');
    const logs = logsData.logs || [];
    if (logsBody) {
      logsBody.innerHTML = '';
      logs.forEach(log => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-900/40 text-[11px]';
        tr.innerHTML = `
          <td class="p-3 font-bold text-emerald-400">${log.action}</td>
          <td class="p-3 font-mono text-slate-400">${log.entity_type}</td>
          <td class="p-3 text-slate-300">${log.user_name || 'System / Desk'}</td>
          <td class="p-3 text-slate-400">${log.details || ''}</td>
          <td class="p-3 font-mono text-slate-500">${log.ip_address || '127.0.0.1'}</td>
          <td class="p-3 text-slate-500">${new Date(log.created_at).toLocaleTimeString()}</td>
        `;
        logsBody.appendChild(tr);
      });
    }

  } catch (err) {
    console.error('Admin panel error:', err);
  }
}

// -----------------------------------------------------------------------------
// ACTIONS & HANDLERS
// -----------------------------------------------------------------------------
async function handleStudentBorrowOrReserve(bookId, type) {
  if (!currentUser) {
    showToast('Please log in with your Student account first.', 'info');
    openAuthModal('login');
    return;
  }

  if (type === 'borrow') {
    // Open prompt or issue
    openIssueModalWithBook(bookId);
  } else {
    // Reserve
    try {
      const data = await apiRequest('/api/reservations', 'POST', { book_id: bookId });
      showToast(data.message, 'success');
      fetchBooks();
      fetchNotifications();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}

function openIssueModalWithBook(bookId) {
  const book = books.find(b => b.id === bookId);
  if (!book) return;

  switchTab('librarian');
  const sel = document.getElementById('libIssueBookSelect');
  if (sel) sel.value = book.id;
  
  // If current user is student, autofill roll
  if (currentUser && currentUser.role === 'student') {
    const rollInput = document.getElementById('libIssueStudent');
    if (rollInput) rollInput.value = currentUser.student_id;
  }
}

async function handleLibrarianIssueSubmit(e) {
  e.preventDefault();
  const student = document.getElementById('libIssueStudent').value;
  const bookId = document.getElementById('libIssueBookSelect').value;
  const dueDate = document.getElementById('libIssueDueDate').value;

  try {
    const data = await apiRequest('/api/loans/issue', 'POST', {
      student_roll: student,
      book_id: bookId,
      due_date: dueDate
    });

    playSound('success');
    showToast(data.message, 'success');
    fetchBooks();
    fetchLiveStats();
    fetchLibrarianPanel();
    e.target.reset();
  } catch (err) {
    playSound('close');
    showToast(err.message, 'error');
  }
}

async function handleLibrarianReturnSubmit(e) {
  e.preventDefault();
  const barcode = document.getElementById('libReturnBarcode').value;

  try {
    const data = await apiRequest('/api/loans/return', 'POST', { barcode });
    playSound('success');
    showToast(data.message, 'success');
    if (data.fine) {
      showToast(`Overdue return! Fine of ₹${data.fine.amount} generated.`, 'info');
    }
    fetchBooks();
    fetchLiveStats();
    fetchLibrarianPanel();
    e.target.reset();
  } catch (err) {
    playSound('close');
    showToast(err.message, 'error');
  }
}

async function handleLibrarianReturnLoan(loanId) {
  try {
    const data = await apiRequest('/api/loans/return', 'POST', { loan_id: loanId });
    playSound('success');
    showToast(data.message, 'success');
    fetchBooks();
    fetchLiveStats();
    fetchLibrarianPanel();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleRenewLoan(loanId) {
  try {
    const data = await apiRequest(`/api/loans/renew/${loanId}`, 'POST');
    playSound('success');
    showToast(data.message, 'success');
    fetchStudentPortal();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleCancelReservation(resId) {
  try {
    const data = await apiRequest(`/api/reservations/${resId}`, 'DELETE');
    showToast(data.message, 'info');
    fetchStudentPortal();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleReviewRequest(reqId, status) {
  try {
    const data = await apiRequest(`/api/requests/${reqId}`, 'PUT', { status, admin_remarks: `Processed by ${currentUser.name}` });
    showToast(data.message, 'success');
    fetchLibrarianPanel();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleApproveStudent(studentId) {
  try {
    const data = await apiRequest(`/api/students/${studentId}/status`, 'PUT', { status: 'active' });
    showToast(data.message, 'success');
    fetchAdminPanel();
    fetchLiveStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleRejectStudent(studentId) {
  try {
    const data = await apiRequest(`/api/students/${studentId}/status`, 'PUT', { status: 'rejected' });
    showToast(data.message, 'info');
    fetchAdminPanel();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleSaveSettings(e) {
  e.preventDefault();
  const maxDays = document.getElementById('settingMaxDays').value;
  const fineRate = document.getElementById('settingDailyFine').value;
  const maxBooks = document.getElementById('settingMaxBooks').value;

  try {
    const data = await apiRequest('/api/admin/settings', 'PUT', {
      settings: {
        max_loan_days: maxDays,
        daily_fine_rate: fineRate,
        max_books_per_student: maxBooks
      }
    });

    playSound('success');
    showToast(data.message, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeleteBook(bookId) {
  if (!confirm('Are you sure you want to delete this book from the library catalog?')) return;
  try {
    const data = await apiRequest(`/api/books/${bookId}`, 'DELETE');
    showToast(data.message, 'success');
    fetchBooks();
    fetchLiveStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// -----------------------------------------------------------------------------
// ADD BOOK MODAL LOGIC
// -----------------------------------------------------------------------------
function openAddBookModal() {
  const modal = document.getElementById('addBookModal');
  const content = document.getElementById('addBookModalContent');
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-90');
    content.classList.add('scale-100');
  }, 10);
}

function closeAddBookModal() {
  const modal = document.getElementById('addBookModal');
  const content = document.getElementById('addBookModalContent');
  content.classList.remove('scale-100');
  content.classList.add('scale-90');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

async function handleAddBookSubmit(e) {
  e.preventDefault();
  const payload = {
    title: document.getElementById('newBookTitle').value,
    author_name: document.getElementById('newBookAuthor').value,
    category_name: document.getElementById('newBookCategory').value,
    isbn: document.getElementById('newBookIsbn').value,
    total_copies: document.getElementById('newBookCopies').value,
    publisher_name: document.getElementById('newBookPublisher').value,
    shelf_location: document.getElementById('newBookShelf').value,
    description: document.getElementById('newBookDesc').value
  };

  try {
    const data = await apiRequest('/api/books', 'POST', payload);
    closeAddBookModal();
    playSound('success');
    showToast(data.message, 'success');
    fetchBooks();
    fetchLiveStats();
    e.target.reset();
  } catch (err) {
    playSound('close');
    showToast(err.message, 'error');
  }
}

// -----------------------------------------------------------------------------
// BOOK DETAILS MODAL
// -----------------------------------------------------------------------------
async function viewBookDetails(bookId) {
  try {
    const data = await apiRequest(`/api/books/${bookId}`);
    const b = data.book;

    document.getElementById('detModalTitle').innerText = b.title;
    document.getElementById('detModalAuthor').innerText = b.author_name;
    document.getElementById('detModalCategory').innerText = b.category_name;
    document.getElementById('detModalIsbn').innerText = b.isbn;
    document.getElementById('detModalPublisher').innerText = `${b.publisher_name || 'Standard Edition'} (${b.publication_year || 2026})`;
    document.getElementById('detModalDesc').innerText = b.description || 'No detailed abstract recorded.';

    const copiesList = document.getElementById('detModalCopiesList');
    copiesList.innerHTML = '';
    (b.copies || []).forEach(c => {
      const el = document.createElement('div');
      el.className = 'flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px]';
      el.innerHTML = `
        <span class="font-mono text-cyan-400">${c.barcode}</span>
        <span class="text-slate-400">${c.shelf_location || 'Stack Main'}</span>
        <span class="px-2 py-0.5 rounded text-[9px] font-bold uppercase ${c.status === 'available' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">${c.status}</span>
      `;
      copiesList.appendChild(el);
    });

    const modal = document.getElementById('bookDetailsModal');
    const content = document.getElementById('bookDetailsModalContent');
    modal.classList.remove('hidden');
    setTimeout(() => {
      modal.classList.remove('opacity-0');
      content.classList.remove('scale-90');
      content.classList.add('scale-100');
    }, 10);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function closeBookDetailsModal() {
  const modal = document.getElementById('bookDetailsModal');
  const content = document.getElementById('bookDetailsModalContent');
  content.classList.remove('scale-100');
  content.classList.add('scale-90');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

// -----------------------------------------------------------------------------
// STUDENT REQUEST BOOK MODAL
// -----------------------------------------------------------------------------
function openRequestBookModal() {
  const modal = document.getElementById('requestBookModal');
  const content = document.getElementById('requestBookModalContent');
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-90');
    content.classList.add('scale-100');
  }, 10);
}

function closeRequestBookModal() {
  const modal = document.getElementById('requestBookModal');
  const content = document.getElementById('requestBookModalContent');
  content.classList.remove('scale-100');
  content.classList.add('scale-90');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

async function handleStudentRequestSubmit(e) {
  e.preventDefault();
  const payload = {
    title: document.getElementById('reqBookTitle').value,
    author: document.getElementById('reqBookAuthor').value,
    reason: document.getElementById('reqBookReason').value
  };

  try {
    const data = await apiRequest('/api/requests', 'POST', payload);
    closeRequestBookModal();
    playSound('success');
    showToast(data.message, 'success');
    fetchStudentPortal();
    e.target.reset();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// -----------------------------------------------------------------------------
// NOTIFICATIONS DRAWER
// -----------------------------------------------------------------------------
async function fetchNotifications() {
  if (!currentUser) return;
  try {
    const data = await apiRequest('/api/notifications');
    const badge = document.getElementById('unreadNotifBadge');
    const list = data.notifications || [];
    const unread = data.unreadCount || 0;

    if (badge) {
      if (unread > 0) {
        badge.innerText = unread;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    const container = document.getElementById('notifListContainer');
    if (container) {
      container.innerHTML = '';
      if (list.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">No notifications on file.</p>';
      } else {
        list.forEach(n => {
          const item = document.createElement('div');
          item.className = `p-3 rounded-2xl ${n.is_read ? 'bg-slate-900/60' : 'bg-emerald-500/10 border border-emerald-500/30'} space-y-1 transition-all`;
          item.innerHTML = `
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-200 text-xs">${n.title}</span>
              <span class="text-[9px] text-slate-500">${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-snug">${n.message}</p>
          `;
          container.appendChild(item);
        });
      }
    }
  } catch (err) {
    console.warn('Notifications error:', err);
  }
}

function toggleNotificationDrawer() {
  const drawer = document.getElementById('notifDrawer');
  if (drawer.classList.contains('hidden')) {
    drawer.classList.remove('hidden');
    fetchNotifications();
  } else {
    drawer.classList.add('hidden');
  }
}

async function markAllNotificationsRead() {
  try {
    await apiRequest('/api/notifications/mark-all-read', 'PUT');
    fetchNotifications();
    showToast('All notifications marked as read', 'info');
  } catch (err) {
    console.error(err);
  }
}

// -----------------------------------------------------------------------------
// TOAST NOTIFICATION STACK
// -----------------------------------------------------------------------------
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');

  let bgStyle = 'bg-slate-900 border-emerald-500/50 text-emerald-300';
  let icon = 'fa-circle-check';

  if (type === 'info') {
    bgStyle = 'bg-slate-900 border-cyan-500/50 text-cyan-300';
    icon = 'fa-circle-info';
  } else if (type === 'error') {
    bgStyle = 'bg-slate-900 border-pink-500/50 text-pink-300';
    icon = 'fa-triangle-exclamation';
  }

  toast.className = `pointer-events-auto flex items-center space-x-3 px-6 py-4 rounded-2xl glass-card border ${bgStyle} transform translate-y-6 opacity-0 transition-all duration-300 shadow-2xl font-bold text-xs uppercase tracking-wider`;
  toast.innerHTML = `<i class="fa-solid ${icon} text-base"></i><span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-6', 'opacity-0');
  }, 30);

  setTimeout(() => {
    toast.classList.add('translate-y-6', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// -----------------------------------------------------------------------------
// SECONDARY MODALS (Resources, Notices, Profile, Staff, Metadata)
// -----------------------------------------------------------------------------
function openAddResourceModal() {
  const modal = document.getElementById('addResourceModal');
  const content = document.getElementById('addResourceModalContent');
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-90');
    content.classList.add('scale-100');
  }, 10);
}

function closeAddResourceModal() {
  const modal = document.getElementById('addResourceModal');
  const content = document.getElementById('addResourceModalContent');
  content.classList.remove('scale-100');
  content.classList.add('scale-90');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

async function handleAddResourceSubmit(e) {
  e.preventDefault();
  const payload = {
    title: document.getElementById('resTitle').value,
    resource_type: document.getElementById('resType').value,
    category_name: document.getElementById('resCategory').value,
    author: document.getElementById('resAuthor').value,
    external_url: document.getElementById('resUrl').value,
    description: document.getElementById('resDesc').value
  };

  try {
    const data = await apiRequest('/api/eresources', 'POST', payload);
    closeAddResourceModal();
    playSound('success');
    showToast(data.message, 'success');
    fetchEResources();
    e.target.reset();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeleteEResource(id) {
  if (!confirm('Delete this digital resource?')) return;
  try {
    const data = await apiRequest(`/api/eresources/${id}`, 'DELETE');
    showToast(data.message, 'info');
    fetchEResources();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openAddNoticeModal() {
  const modal = document.getElementById('addNoticeModal');
  const content = document.getElementById('addNoticeModalContent');
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-90');
    content.classList.add('scale-100');
  }, 10);
}

function closeAddNoticeModal() {
  const modal = document.getElementById('addNoticeModal');
  const content = document.getElementById('addNoticeModalContent');
  content.classList.remove('scale-100');
  content.classList.add('scale-90');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

async function handleAddNoticeSubmit(e) {
  e.preventDefault();
  const payload = {
    title: document.getElementById('noticeTitle').value,
    category: document.getElementById('noticeCategory').value,
    is_pinned: document.getElementById('noticePinned').checked,
    content: document.getElementById('noticeContent').value
  };

  try {
    const data = await apiRequest('/api/notices', 'POST', payload);
    closeAddNoticeModal();
    playSound('success');
    showToast(data.message, 'success');
    fetchNotices();
    e.target.reset();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeleteNotice(id) {
  if (!confirm('Delete this library notice?')) return;
  try {
    const data = await apiRequest(`/api/notices/${id}`, 'DELETE');
    showToast(data.message, 'info');
    fetchNotices();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openProfileSettingsModal() {
  if (!currentUser) return;
  const modal = document.getElementById('profileSettingsModal');
  const content = document.getElementById('profileSettingsModalContent');
  if (document.getElementById('profPhone')) document.getElementById('profPhone').value = currentUser.phone || '';
  if (document.getElementById('profSemester')) document.getElementById('profSemester').value = currentUser.semester || 'Semester 1';

  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-90');
    content.classList.add('scale-100');
  }, 10);
}

function closeProfileSettingsModal() {
  const modal = document.getElementById('profileSettingsModal');
  const content = document.getElementById('profileSettingsModalContent');
  content.classList.remove('scale-100');
  content.classList.add('scale-90');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

async function handleProfileSettingsSubmit(e) {
  e.preventDefault();
  const payload = {
    phone: document.getElementById('profPhone').value,
    semester: document.getElementById('profSemester').value
  };

  const curr = document.getElementById('profCurrentPass').value;
  const next = document.getElementById('profNewPass').value;
  if (next) {
    payload.currentPassword = curr;
    payload.newPassword = next;
  }

  try {
    const data = await apiRequest('/api/auth/profile', 'PUT', payload);
    closeProfileSettingsModal();
    playSound('success');
    showToast(data.message, 'success');
    currentUser.phone = payload.phone;
    currentUser.semester = payload.semester;
    localStorage.setItem('itp_user', JSON.stringify(currentUser));
    fetchStudentPortal();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openStaffModal() {
  const modal = document.getElementById('staffModal');
  const content = document.getElementById('staffModalContent');
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-90');
    content.classList.add('scale-100');
  }, 10);
}

function closeStaffModal() {
  const modal = document.getElementById('staffModal');
  const content = document.getElementById('staffModalContent');
  content.classList.remove('scale-100');
  content.classList.add('scale-90');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

async function handleStaffSubmit(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('staffName').value,
    email: document.getElementById('staffEmail').value,
    role: document.getElementById('staffRole').value,
    password: document.getElementById('staffPass').value
  };

  try {
    const data = await apiRequest('/api/admin/staff', 'POST', payload);
    closeStaffModal();
    playSound('success');
    showToast(data.message, 'success');
    e.target.reset();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openMetadataModal() {
  const modal = document.getElementById('metadataModal');
  const content = document.getElementById('metadataModalContent');
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-90');
    content.classList.add('scale-100');
  }, 10);
}

function closeMetadataModal() {
  const modal = document.getElementById('metadataModal');
  const content = document.getElementById('metadataModalContent');
  content.classList.remove('scale-100');
  content.classList.add('scale-90');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

async function handleQuickAddCategory(e) {
  e.preventDefault();
  const name = document.getElementById('metaCatName').value;
  const code = document.getElementById('metaCatCode').value;

  try {
    const data = await apiRequest('/api/metadata/categories', 'POST', { name, code });
    showToast(data.message, 'success');
    closeMetadataModal();
    e.target.reset();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleQuickAddAuthor(e) {
  e.preventDefault();
  const name = document.getElementById('metaAuthorName').value;

  try {
    const data = await apiRequest('/api/metadata/authors', 'POST', { name });
    showToast(data.message, 'success');
    closeMetadataModal();
    e.target.reset();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// -----------------------------------------------------------------------------
// FINE SETTLEMENT MODAL LOGIC
// -----------------------------------------------------------------------------
function openPayFineModal(fineId, amount, reason) {
  document.getElementById('payFineId').value = fineId;
  document.getElementById('payFineAmount').innerText = `₹${parseFloat(amount).toFixed(2)}`;
  document.getElementById('payFineReason').innerText = reason || 'Overdue book fine';

  const modal = document.getElementById('payFineModal');
  const content = document.getElementById('payFineModalContent');
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-90');
    content.classList.add('scale-100');
  }, 10);
}

function closePayFineModal() {
  const modal = document.getElementById('payFineModal');
  const content = document.getElementById('payFineModalContent');
  content.classList.remove('scale-100');
  content.classList.add('scale-90');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('hidden'), 300);
}

async function confirmFinePayment() {
  const fineId = document.getElementById('payFineId').value;
  const method = document.getElementById('payFineMethod').value;

  try {
    const data = await apiRequest(`/api/fines/pay/${fineId}`, 'POST', { payment_method: method });
    closePayFineModal();
    playSound('success');
    showToast(data.message, 'success');
    if (currentUser && currentUser.role === 'student') {
      fetchStudentPortal();
    }
    fetchLiveStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
