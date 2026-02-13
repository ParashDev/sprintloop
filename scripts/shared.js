/* ── SprintLoop Shared Module ── */

// ─── Theme Toggle ───
function initTheme() {
  const stored = localStorage.getItem('po-toolkit-theme');
  if (stored === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.classList.toggle('dark');
  localStorage.setItem('po-toolkit-theme', isDark ? 'dark' : 'light');
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const isDark = document.documentElement.classList.contains('dark');
  btn.innerHTML = isDark ? SUN_ICON : MOON_ICON;
}

const SUN_ICON = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`;

const MOON_ICON = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>`;

const AI_ICON = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>`;
const AI_NAV_ICON = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>`;

// ─── Navigation ───
const NAV_ITEMS = [
  { label: 'Dashboard', href: 'dashboard.html', icon: 'dashboard' },
  { label: 'Docs', href: 'business-docs.html', icon: 'docs' },
  { label: 'Risk', href: 'risk-register.html', icon: 'shield' },
  { label: 'Epics', href: 'epics.html', icon: 'link' },
  { label: 'Stories', href: 'user-stories.html', icon: 'doc' },
  { label: 'Capacity', href: 'capacity-planner.html', icon: 'capacity' },
  { label: 'Sprint', href: 'sprint-board.html', icon: 'sprint' },
  { label: 'RACI', href: 'raci-matrix.html', icon: 'grid' },
  { label: 'Retro', href: 'retro-log.html', icon: 'chat' },
];

const NAV_ICONS = {
  dashboard: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-2a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z"/></svg>`,
  docs: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 2v5a2 2 0 002 2h5"/></svg>`,
  doc: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
  capacity: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>`,
  grid: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>`,
  link: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>`,
  chat: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>`,
  shield: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>`,
  sprint: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"/></svg>`,
};

function buildNav(currentPage) {
  const isRoot = !currentPage;
  const prefix = isRoot ? 'pages/' : '';
  const homeHref = isRoot ? '#' : '../index.html';
  const docsHref = isRoot ? 'pages/business-docs.html' : 'business-docs.html';

  const projectName = getActiveProjectName();
  const projectIndicator = projectName
    ? `<span class="text-slate-300 dark:text-slate-600 mx-1">/</span><button onclick="openProjectSwitcherModal()" class="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors max-w-[140px] truncate">${escapeHtmlShared(projectName)}<svg class="w-3 h-3 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></button>`
    : `<span class="text-slate-300 dark:text-slate-600 mx-1">/</span><button onclick="openProjectSwitcherModal()" class="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">No Project<svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></button>`;

  const mobileProjectName = projectName
    ? `<div class="px-3 py-2 mb-1 border-b border-slate-200 dark:border-slate-800"><button onclick="openProjectSwitcherModal()" class="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 w-full"><svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>${escapeHtmlShared(projectName)}<svg class="w-3 h-3 ml-auto text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4"/></svg></button></div>`
    : `<div class="px-3 py-2 mb-1 border-b border-slate-200 dark:border-slate-800"><button onclick="openProjectSwitcherModal()" class="flex items-center gap-2 text-sm font-medium text-slate-400 dark:text-slate-500 w-full"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>No Project Selected<svg class="w-3 h-3 ml-auto text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4"/></svg></button></div>`;

  const navLinks = NAV_ITEMS.map(item => {
    const isActive = currentPage === item.href;
    const activeClass = isActive
      ? 'text-slate-900 dark:text-white'
      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200';
    return `<a href="${prefix}${item.href}" class="flex items-center gap-1.5 text-sm font-medium ${activeClass} transition-colors">${NAV_ICONS[item.icon]}<span class="hidden lg:inline">${item.label}</span></a>`;
  }).join('');

  const mobileLinks = NAV_ITEMS.map(item => {
    const isActive = currentPage === item.href;
    const activeClass = isActive ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800/50' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50';
    return `<a href="${prefix}${item.href}" class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${activeClass} transition-colors">${NAV_ICONS[item.icon]}${item.label}</a>`;
  }).join('');

  const nav = document.createElement('nav');
  nav.id = 'main-nav';
  nav.className = 'sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800';
  nav.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-14">
        <div class="flex items-center min-w-0">
          <a href="${homeHref}" class="flex items-center gap-2 text-slate-900 dark:text-white tracking-tight shrink-0"><span class="inline-flex items-center justify-center w-7 h-7 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold">SL</span><span class="text-sm font-semibold hidden sm:inline">SprintLoop</span></a>
          ${projectIndicator}
        </div>
        <div class="hidden md:flex items-center gap-6">${navLinks}</div>
        <div class="flex items-center gap-3">
          <button id="ai-key-nav-btn" onclick="openApiKeyModal()" class="relative p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="AI Settings">${AI_NAV_ICON}<span class="ai-status-dot absolute top-1 right-1 w-2 h-2 rounded-full bg-slate-500"></span></button>
          <button id="theme-toggle" onclick="toggleTheme()" class="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Toggle theme"></button>
          <button id="mobile-menu-btn" onclick="toggleMobileMenu()" class="md:hidden p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Menu">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div id="mobile-menu" class="hidden md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/98 dark:bg-slate-900/98 backdrop-blur">
      <div class="px-4 py-3 space-y-1 nav-mobile-enter">
        ${mobileProjectName}
        ${mobileLinks}
      </div>
    </div>
  `;

  document.body.prepend(nav);
  updateThemeIcon();
  updateApiKeyStatus();
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  menu.classList.toggle('hidden');
}

// ─── Light theme nav override ───
// The nav always uses dark styling; light pages need a class swap on body only.
// Light theme body classes are set via tailwind dark: variants on the page content.

// ─── Page Header ───
function buildPageHeader(title, description, guide) {
  const header = document.createElement('div');
  header.className = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4';

  let guideHtml = '';
  if (guide) {
    guideHtml = `
      <div id="tool-guide" class="mt-4 rounded-xl border border-slate-200 dark:border-slate-700/60 bg-slate-50/80 dark:bg-slate-800/40 overflow-hidden transition-all duration-300">
        <button onclick="toggleToolGuide()" class="w-full flex items-center justify-between px-5 py-3 text-left group">
          <span class="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <svg class="w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            What is this tool and when should I use it?
          </span>
          <svg id="guide-chevron" class="w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div id="guide-content" class="hidden px-5 pb-5">
          <div class="space-y-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            ${guide}
          </div>
        </div>
      </div>`;
  }

  header.innerHTML = `
    <nav class="text-sm text-slate-400 dark:text-slate-500 mb-2">
      <a href="../index.html" class="hover:text-slate-900 dark:hover:text-white transition-colors">Home</a>
      <span class="mx-2">/</span>
      <span class="text-slate-600 dark:text-slate-300">${title}</span>
    </nav>
    <h1 class="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 font-serif">${title}</h1>
    <p class="mt-1 text-slate-500 dark:text-slate-400 text-sm">${description}</p>
    ${guideHtml}
  `;
  return header;
}

function toggleToolGuide() {
  const content = document.getElementById('guide-content');
  const chevron = document.getElementById('guide-chevron');
  if (!content) return;
  const isHidden = content.classList.contains('hidden');
  content.classList.toggle('hidden');
  chevron.style.transform = isHidden ? 'rotate(180deg)' : '';
}

// ─── Toast Notifications ───
let toastContainer = null;

function showToast(message, type = 'success') {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'fixed top-16 right-4 z-[100] flex flex-col gap-2';
    document.body.appendChild(toastContainer);
  }

  const colors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-slate-700 text-white',
  };

  const toast = document.createElement('div');
  toast.className = `px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg toast-enter ${colors[type] || colors.success}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ─── localStorage Helpers ───
function loadData(key, fallback = []) {
  try {
    const raw = localStorage.getItem(`po-toolkit-${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveData(key, data) {
  try {
    localStorage.setItem(`po-toolkit-${key}`, JSON.stringify(data));
  } catch (e) {
    showToast('Storage full -- export your data', 'error');
  }
}

// ─── Project-Scoped Storage ───

const PROJECT_SCOPED_KEYS = [
  'risk-register', 'user-stories', 'traceability', 'sprint-board',
  'sprint-config', 'sprint-team', 'sprint-backlog',
  'raci-matrix', 'retro-sessions', 'decisions',
];

function getActiveProjectId() {
  try {
    const raw = localStorage.getItem('po-toolkit-business-docs');
    if (!raw) return null;
    const store = JSON.parse(raw);
    return store.activeProjectId || null;
  } catch { return null; }
}

function getActiveProjectName() {
  try {
    const raw = localStorage.getItem('po-toolkit-business-docs');
    if (!raw) return null;
    const store = JSON.parse(raw);
    const proj = store.projects?.find(p => p.id === store.activeProjectId);
    return proj ? (proj.projectName || 'Untitled') : null;
  } catch { return null; }
}

function loadProjectData(key, fallback) {
  const pid = getActiveProjectId();
  if (!pid) return typeof fallback === 'function' ? fallback() : fallback;
  return loadData(key + '-' + pid, fallback);
}

function saveProjectData(key, data) {
  const pid = getActiveProjectId();
  if (!pid) { showToast('No active project -- create one in Business Docs first', 'error'); return; }
  saveData(key + '-' + pid, data);
}

function deleteProjectToolData(projectId) {
  PROJECT_SCOPED_KEYS.forEach(key => {
    try { localStorage.removeItem('po-toolkit-' + key + '-' + projectId); } catch {}
  });
}

function migrateToolDataToProject(toolKey, fallback) {
  const pid = getActiveProjectId();
  if (!pid) return typeof fallback === 'function' ? fallback() : fallback;
  const scopedKey = 'po-toolkit-' + toolKey + '-' + pid;
  const unscopedKey = 'po-toolkit-' + toolKey;
  if (localStorage.getItem(scopedKey) !== null) return loadProjectData(toolKey, fallback);
  const legacy = localStorage.getItem(unscopedKey);
  if (legacy !== null) {
    localStorage.setItem(scopedKey, legacy);
    localStorage.removeItem(unscopedKey);
    return loadProjectData(toolKey, fallback);
  }
  return typeof fallback === 'function' ? fallback() : fallback;
}

function getProjectContextForAI() {
  try {
    const raw = localStorage.getItem('po-toolkit-business-docs');
    if (!raw) return '';
    const store = JSON.parse(raw);
    const project = store.projects?.find(p => p.id === store.activeProjectId);
    if (!project) return '';
    let ctx = '';
    if (project.projectName) ctx += 'Project: ' + project.projectName + '\n';
    if (project.projectDescription) ctx += 'Description: ' + project.projectDescription + '\n';
    if (project.prd?.sections) {
      ctx += '\nPRD Summary:\n';
      project.prd.sections.forEach(s => { ctx += '- ' + s.title + ': ' + s.content.substring(0, 200) + '\n'; });
    }
    if (project.brd?.sections) {
      ctx += '\nBRD Summary:\n';
      project.brd.sections.forEach(s => { ctx += '- ' + s.title + ': ' + s.content.substring(0, 200) + '\n'; });
    }
    return ctx;
  } catch { return ''; }
}

function escapeHtmlShared(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Export: CSV ───
function exportCSV(filename, headers, rows) {
  const escape = (val) => {
    const str = String(val == null ? '' : val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(escape).join(','))
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
  showToast('CSV exported');
}

// ─── Export: Markdown ───
function exportMarkdown(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
  downloadBlob(blob, filename);
  showToast('Markdown exported');
}

// ─── Export: PDF (via print) ───
function exportPDF() {
  window.print();
  showToast('PDF dialog opened');
}

// ─── Download helper ───
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Unique ID generator ───
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Date formatting ───
function formatDate(dateStr) {
  if (!dateStr) return '';
  // Date-only strings (YYYY-MM-DD) parse as UTC midnight, which shifts back a day in western timezones
  const normalized = dateStr.length === 10 ? dateStr + 'T00:00' : dateStr;
  const d = new Date(normalized);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Modal helper ───
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.getElementById(id).classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  document.getElementById(id).classList.remove('flex');
  document.body.style.overflow = '';
}

// ─── Confirm dialog ───
function confirmAction(message) {
  return window.confirm(message);
}

// ─── AI: OpenRouter Integration ───

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_KEY_PREFIX = 'sk-or-v1-';
const DEFAULT_MODEL_ID = 'openai/gpt-4o';
const DEFAULT_MODEL_NAME = 'GPT-4o';

function getOpenRouterKey() {
  return localStorage.getItem('openrouter-api-key') || '';
}

function getPreferredModel() {
  return localStorage.getItem('openrouter-model-id') || DEFAULT_MODEL_ID;
}

function getPreferredModelName() {
  return localStorage.getItem('openrouter-model-name') || DEFAULT_MODEL_NAME;
}

function ensureApiKey() {
  if (!getOpenRouterKey()) {
    openApiKeyModal();
    return false;
  }
  return true;
}

async function callOpenRouterAPI(messages, model, maxTokens, temperature, retryCount) {
  const key = getOpenRouterKey();
  if (!key) {
    openApiKeyModal();
    throw new Error('API key not configured');
  }

  model = model || getPreferredModel();
  maxTokens = maxTokens || 2048;
  temperature = temperature != null ? temperature : 0.7;
  retryCount = retryCount || 0;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'SprintLoop',
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || 'API error: ' + response.status);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    clearTimeout(timeout);
    // Retry on network errors, not API errors
    if ((error.name === 'AbortError' || error.name === 'TypeError') && retryCount < 2) {
      return callOpenRouterAPI(messages, model, maxTokens, temperature, retryCount + 1);
    }
    throw error;
  }
}

function setAiButtonLoading(btn, loading) {
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="ai-spinner"></span><span class="ml-1.5">Working...</span>';
    btn.classList.add('opacity-70', 'cursor-wait');
  } else {
    btn.disabled = false;
    if (btn.dataset.originalHtml) {
      btn.innerHTML = btn.dataset.originalHtml;
    }
    btn.classList.remove('opacity-70', 'cursor-wait');
  }
}

// ─── AI: API Key Modal ───

let aiKeyModalInjected = false;

function toggleKeyVisibility() {
  const input = document.getElementById('ai-api-key-input');
  const showIcon = document.getElementById('eye-icon-show');
  const hideIcon = document.getElementById('eye-icon-hide');
  if (input.type === 'password') {
    input.type = 'text';
    showIcon.classList.add('hidden');
    hideIcon.classList.remove('hidden');
  } else {
    input.type = 'password';
    showIcon.classList.remove('hidden');
    hideIcon.classList.add('hidden');
  }
}

function openApiKeyModal() {
  if (!aiKeyModalInjected) {
    injectApiKeyModal();
    aiKeyModalInjected = true;
  }
  document.getElementById('ai-api-key-input').value = getOpenRouterKey();
  document.getElementById('ai-model-input').value = getPreferredModel();
  document.getElementById('ai-model-name-input').value = getPreferredModelName();
  document.getElementById('ai-key-test-status').textContent = '';
  openModal('ai-key-modal');
}

function closeApiKeyModal() {
  closeModal('ai-key-modal');
}

function saveApiKey() {
  const key = document.getElementById('ai-api-key-input').value.trim();
  const model = document.getElementById('ai-model-input').value.trim() || DEFAULT_MODEL_ID;
  const modelName = document.getElementById('ai-model-name-input').value.trim() || DEFAULT_MODEL_NAME;

  if (key && !key.startsWith(OPENROUTER_KEY_PREFIX)) {
    showToast('Key must start with ' + OPENROUTER_KEY_PREFIX, 'error');
    return;
  }

  localStorage.setItem('openrouter-api-key', key);
  localStorage.setItem('openrouter-model-id', model);
  localStorage.setItem('openrouter-model-name', modelName);

  updateApiKeyStatus();
  closeApiKeyModal();
  showToast(key ? 'API key saved' : 'API key cleared');
}

async function testApiKey() {
  const key = document.getElementById('ai-api-key-input').value.trim();
  if (!key) {
    showToast('Enter an API key first', 'error');
    return;
  }

  const statusEl = document.getElementById('ai-key-test-status');
  statusEl.textContent = 'Testing...';
  statusEl.className = 'text-sm text-slate-500 dark:text-slate-400';

  const oldKey = localStorage.getItem('openrouter-api-key') || '';
  localStorage.setItem('openrouter-api-key', key);

  try {
    await callOpenRouterAPI(
      [{ role: 'user', content: 'Reply with just the word ok' }],
      null, 5, 0
    );
    statusEl.textContent = 'Connection successful';
    statusEl.className = 'text-sm text-emerald-500';
  } catch (err) {
    statusEl.textContent = 'Failed: ' + err.message;
    statusEl.className = 'text-sm text-red-500';
  } finally {
    // Restore original key; user must click Save to persist
    localStorage.setItem('openrouter-api-key', oldKey);
  }
}

function updateApiKeyStatus() {
  const btn = document.getElementById('ai-key-nav-btn');
  if (!btn) return;
  const hasKey = !!getOpenRouterKey();
  const dot = btn.querySelector('.ai-status-dot');
  if (dot) {
    dot.className = 'ai-status-dot absolute top-1 right-1 w-2 h-2 rounded-full ' + (hasKey ? 'bg-emerald-400' : 'bg-slate-500');
  }
}

function injectApiKeyModal() {
  const modal = document.createElement('div');
  modal.id = 'ai-key-modal';
  modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 items-center justify-center p-4';

  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white">AI Configuration</h2>
        <button onclick="closeApiKeyModal()" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="px-6 py-5 space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">OpenRouter API Key</label>
          <div class="relative">
            <input type="password" id="ai-api-key-input" placeholder="sk-or-v1-..."
              class="w-full px-3 py-2 pr-10 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400">
            <button type="button" onclick="toggleKeyVisibility()" class="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" title="Show/hide key">
              <svg id="eye-icon-show" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              <svg id="eye-icon-hide" class="w-4 h-4 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>
            </button>
          </div>
          <p class="text-xs text-slate-400 dark:text-slate-500 mt-1"><a href="https://openrouter.ai/keys" target="_blank" rel="noopener" class="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline underline-offset-2 transition-colors">Get your API key</a></p>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Model Name</label>
          <input type="text" id="ai-model-name-input" placeholder="GPT-4o"
            class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400">
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Model ID</label>
          <input type="text" id="ai-model-input" placeholder="openai/gpt-4o"
            class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400">
          <p class="text-xs text-slate-400 dark:text-slate-500 mt-1"><a href="https://openrouter.ai/models" target="_blank" rel="noopener" class="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline underline-offset-2 transition-colors">Browse available models</a></p>
        </div>
        <div id="ai-key-test-status" class="text-sm"></div>
        <div class="flex items-center justify-end gap-3 pt-2">
          <button onclick="testApiKey()" class="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Test Key</button>
          <button onclick="saveApiKey()" class="px-4 py-2 rounded-lg bg-slate-800 dark:bg-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 text-white text-sm font-semibold transition-colors">Save</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

// ─── Project Switcher Modal ───

let projectSwitcherInjected = false;

function openProjectSwitcherModal() {
  if (!projectSwitcherInjected) {
    injectProjectSwitcherModal();
    projectSwitcherInjected = true;
  }
  renderProjectSwitcherList();
  openModal('project-switcher-modal');
}

function closeProjectSwitcherModal() {
  closeModal('project-switcher-modal');
}

function renderProjectSwitcherList() {
  const container = document.getElementById('project-switcher-list-container');
  if (!container) return;

  let store = null;
  try {
    const raw = localStorage.getItem('po-toolkit-business-docs');
    if (raw) store = JSON.parse(raw);
  } catch {}

  const projects = store?.projects || [];
  const activeId = store?.activeProjectId || null;

  if (projects.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8">
        <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">No projects yet</p>
        <a href="${document.querySelector('#main-nav a[href^="pages/"]') ? 'pages/' : ''}business-docs.html" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 dark:bg-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 text-white text-sm font-medium transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Create Project
        </a>
      </div>`;
    return;
  }

  container.innerHTML = projects.map(p => {
    const isActive = p.id === activeId;
    const hasPrd = !!p.prd;
    const hasBrd = !!p.brd;
    const name = p.projectName || 'Untitled';
    const activeRing = isActive ? 'ring-2 ring-slate-400 dark:ring-slate-500' : '';
    const activeBg = isActive ? 'bg-slate-50 dark:bg-slate-800/60' : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40';
    return `
      <button onclick="switchToProject('${p.id}')" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 ${activeBg} ${activeRing} transition-all text-left">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">${escapeHtmlShared(name)}</span>
            ${isActive ? '<span class="shrink-0 text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">Active</span>' : ''}
          </div>
          <div class="flex items-center gap-3 mt-1">
            <span class="flex items-center gap-1 text-xs ${hasPrd ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}">
              <span class="w-1.5 h-1.5 rounded-full ${hasPrd ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}"></span>PRD
            </span>
            <span class="flex items-center gap-1 text-xs ${hasBrd ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}">
              <span class="w-1.5 h-1.5 rounded-full ${hasBrd ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}"></span>BRD
            </span>
          </div>
        </div>
        <svg class="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      </button>`;
  }).join('');
}

function switchToProject(projectId) {
  try {
    const raw = localStorage.getItem('po-toolkit-business-docs');
    if (!raw) return;
    const store = JSON.parse(raw);
    if (store.activeProjectId === projectId) {
      closeProjectSwitcherModal();
      return;
    }
    store.activeProjectId = projectId;
    localStorage.setItem('po-toolkit-business-docs', JSON.stringify(store));
    location.reload();
  } catch {}
}

function injectProjectSwitcherModal() {
  const isRoot = !!document.querySelector('#main-nav a[href^="pages/"]');
  const docsHref = isRoot ? 'pages/business-docs.html' : 'business-docs.html';

  const modal = document.createElement('div');
  modal.id = 'project-switcher-modal';
  modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 items-center justify-center p-4';
  modal.onclick = function() { closeProjectSwitcherModal(); };

  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <h2 class="text-base font-bold text-slate-900 dark:text-white">Switch Project</h2>
        <button onclick="closeProjectSwitcherModal()" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div id="project-switcher-list-container" class="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
      </div>
      <div class="px-5 py-3 border-t border-slate-200 dark:border-slate-800">
        <a href="${docsHref}" class="flex items-center justify-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          Manage Projects
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

// ─── AI: Namespace ───

window.POToolkit = {
  getOpenRouterKey: getOpenRouterKey,
  getPreferredModel: getPreferredModel,
  getPreferredModelName: getPreferredModelName,
  callOpenRouterAPI: callOpenRouterAPI,
  openApiKeyModal: openApiKeyModal,
  closeApiKeyModal: closeApiKeyModal,
  saveApiKey: saveApiKey,
  testApiKey: testApiKey,
  ensureApiKey: ensureApiKey,
  setAiButtonLoading: setAiButtonLoading,
  getActiveProjectId: getActiveProjectId,
  getActiveProjectName: getActiveProjectName,
  getProjectContextForAI: getProjectContextForAI,
};

// ─── Initialize on every page ───
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
});
