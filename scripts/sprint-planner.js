/* ── Sprint Capacity Planner ── */

// ─── Constants ───
const BOARD_KEY = 'sprint-board';
const STORY_SOURCE_KEY = 'user-stories';

// ─── State ───
let sprintConfig = { days: 10, ceremonyHours: 6 };
let teamMembers = [];
let backlogItems = []; // reference to current sprint's plannerBacklog
let sprints = [];
let currentSprintId = null;
let importAccordionOpen = new Set();

// Track which item is currently being dragged
let draggedItemId = null;

// ─── Sprint Helpers ───
function getCurrentSprint() {
  return sprints.find(s => s.id === currentSprintId) || null;
}

function saveSprints() {
  saveProjectData(BOARD_KEY, sprints);
}

function syncBacklogRef() {
  const sprint = getCurrentSprint();
  backlogItems = sprint ? sprint.plannerBacklog : [];
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  buildNav('capacity-planner.html');

  sprintConfig = migrateToolDataToProject('sprint-config', { days: 10, ceremonyHours: 6 });
  teamMembers = migrateToolDataToProject('sprint-team', []);
  migratePlannerData();

  const header = buildPageHeader(
    'Sprint Capacity Planner',
    'Plan sprints, import stories from User Story Forge, groom and commit based on team capacity.',
    `<div>
      <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">What is Capacity Planning?</h3>
      <p>Capacity planning answers a simple question: <span class="font-medium text-slate-700 dark:text-slate-300">"How much work can the team actually take on this sprint?"</span> It calculates available working hours by accounting for team size, sprint length, holidays, meetings, and other non-development time. Without it, teams routinely over-commit and then scramble to meet deadlines or silently drop scope.</p>
    </div>
    <div>
      <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">How It Works</h3>
      <p>This is where sprint planning happens. Create sprints, import stories from User Story Forge into the planning backlog, then groom and commit them based on your team's capacity. Only committed stories flow to the Sprint Board for execution. The commitment bar shows whether the team is under-loaded, at a healthy level (around 80%), or over-committed.</p>
    </div>
    <div>
      <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">Workflow</h3>
      <ul class="list-disc list-inside space-y-1 ml-1">
        <li><span class="font-medium text-slate-700 dark:text-slate-300">1. Create a sprint</span> -- Set the name, dates, and sprint goal</li>
        <li><span class="font-medium text-slate-700 dark:text-slate-300">2. Set up your team</span> -- Add team members with their daily capacity and PTO</li>
        <li><span class="font-medium text-slate-700 dark:text-slate-300">3. Import stories</span> -- Pull stories from User Story Forge into the planning backlog</li>
        <li><span class="font-medium text-slate-700 dark:text-slate-300">4. Groom and commit</span> -- Estimate hours, drag stories to committed when ready</li>
        <li><span class="font-medium text-slate-700 dark:text-slate-300">5. Go to Sprint Board</span> -- Import committed stories and start execution</li>
      </ul>
    </div>
    <div>
      <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">Key Concepts</h3>
      <ul class="list-disc list-inside space-y-1 ml-1">
        <li><span class="font-medium text-slate-700 dark:text-slate-300">Available Capacity</span> -- Total working hours minus holidays, meetings, and other overhead. A 2-week sprint with 5 developers is not 400 hours -- it is typically closer to 250-300 after realistic deductions.</li>
        <li><span class="font-medium text-slate-700 dark:text-slate-300">Commitment Level</span> -- The percentage of available capacity allocated to backlog items. Best practice is 70-85%. Going to 100% leaves zero buffer for bugs, code reviews, and unexpected work.</li>
        <li><span class="font-medium text-slate-700 dark:text-slate-300">Velocity</span> -- The average number of story points a team completes per sprint. Over time, velocity becomes a reliable predictor of how much work the team can handle.</li>
      </ul>
    </div>`
  );
  document.getElementById('page-header').appendChild(header);

  populateSprintDropdown();
  updateSprintUI();
  hydrateConfigInputs();
  bindConfigListeners();
  renderTeamTable();
  renderColumns();
  recalculate();
  initAiSprintButton();
  initImportFromStoriesButton();
});

// ─── Sprint Data Migration ───
function migratePlannerData() {
  const raw = loadProjectData(BOARD_KEY, []);

  if (Array.isArray(raw) && raw.length > 0 && raw[0] && typeof raw[0].name === 'string' && Array.isArray(raw[0].items)) {
    sprints = raw;
    sprints.forEach(s => { if (!s.plannerBacklog) s.plannerBacklog = []; });
    currentSprintId = (sprints.find(s => s.status === 'active') || sprints.find(s => s.status === 'planned') || sprints[0])?.id || null;
  } else if (Array.isArray(raw) && raw.length > 0) {
    const sprint = {
      id: uid(), name: 'Sprint 1', status: 'active',
      items: raw, plannerBacklog: [],
      startDate: new Date().toISOString().slice(0, 10), endDate: '', goal: '',
      createdAt: new Date().toISOString(), completedAt: null,
    };
    sprints = [sprint];
    currentSprintId = sprint.id;
    saveSprints();
  } else {
    const sprint = {
      id: uid(), name: 'Sprint 1', status: 'active',
      items: [], plannerBacklog: [],
      startDate: new Date().toISOString().slice(0, 10), endDate: '', goal: '',
      createdAt: new Date().toISOString(), completedAt: null,
    };
    sprints = [sprint];
    currentSprintId = sprint.id;
    saveSprints();
  }

  // Migrate old sprint-backlog items into active sprint's plannerBacklog
  const oldBacklog = loadProjectData('sprint-backlog', []);
  if (oldBacklog.length > 0) {
    const sprint = getCurrentSprint();
    if (sprint && sprint.plannerBacklog.length === 0) {
      sprint.plannerBacklog = oldBacklog;
      saveSprints();
      saveProjectData('sprint-backlog', []);
    }
  }

  syncBacklogRef();
}

// ─── Sprint Management ───
function populateSprintDropdown() {
  const statusOrder = { active: 0, planned: 1, completed: 2 };
  const sorted = [...sprints].sort((a, b) => (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1));
  const statusLabels = { active: 'Active', planned: 'Planned', completed: 'Completed' };

  const optionsHtml = sorted.map(s =>
    `<option value="${s.id}" ${s.id === currentSprintId ? 'selected' : ''}>${escHtml(s.name)} (${statusLabels[s.status] || s.status})</option>`
  ).join('');

  const desktopSelect = document.getElementById('planner-sprint-select');
  const mobileSelect = document.getElementById('planner-sprint-select-mobile');
  if (desktopSelect) desktopSelect.innerHTML = optionsHtml;
  if (mobileSelect) mobileSelect.innerHTML = optionsHtml;
}

function handlePlannerSprintChange(source) {
  const select = document.getElementById(source === 'mobile' ? 'planner-sprint-select-mobile' : 'planner-sprint-select');
  if (!select) return;
  currentSprintId = select.value || null;

  const otherSelect = document.getElementById(source === 'mobile' ? 'planner-sprint-select' : 'planner-sprint-select-mobile');
  if (otherSelect) otherSelect.value = currentSprintId || '';

  syncBacklogRef();
  renderColumns();
  recalculate();
  updateSprintUI();
}

function updateSprintUI() {
  const sprint = getCurrentSprint();
  const deleteBtnD = document.getElementById('btn-delete-planner-sprint');
  const deleteBtnM = document.getElementById('btn-delete-planner-sprint-mobile');
  if (deleteBtnD) deleteBtnD.classList.toggle('hidden', !sprint);
  if (deleteBtnM) deleteBtnM.classList.toggle('hidden', !sprint);

  // Update sprint summary
  const summaryText = sprint
    ? sprint.name + (sprint.goal ? ' -- ' + sprint.goal : '')
    : 'No sprint selected';
  const summaryD = document.getElementById('planner-sprint-summary');
  const summaryM = document.getElementById('planner-sprint-summary-mobile');
  if (summaryD) summaryD.textContent = summaryText;
  if (summaryM) summaryM.textContent = summaryText;
}

function openNewPlannerSprintModal() {
  let modal = document.getElementById('new-planner-sprint-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'new-planner-sprint-modal';
    modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">New Sprint</h2>
          <button onclick="closeModal('new-planner-sprint-modal')" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="px-6 py-5 space-y-4">
          <div>
            <label for="planner-sprint-name" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sprint Name</label>
            <input type="text" id="planner-sprint-name" placeholder="Sprint 2"
              class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="planner-sprint-start" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
              <input type="date" id="planner-sprint-start"
                class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400">
            </div>
            <div>
              <label for="planner-sprint-end" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Date</label>
              <input type="date" id="planner-sprint-end"
                class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400">
            </div>
          </div>
          <div>
            <label for="planner-sprint-goal" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sprint Goal <span class="text-slate-400 font-normal">(optional)</span></label>
            <textarea id="planner-sprint-goal" rows="2" placeholder="What the team aims to achieve..."
              class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"></textarea>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button onclick="closeModal('new-planner-sprint-modal')" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button onclick="handleCreatePlannerSprint()" class="px-5 py-2 rounded-lg bg-slate-800 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 text-sm font-semibold transition-colors">Create Sprint</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('planner-sprint-name').value = 'Sprint ' + (sprints.length + 1);
  document.getElementById('planner-sprint-start').value = new Date().toISOString().slice(0, 10);
  document.getElementById('planner-sprint-end').value = '';
  document.getElementById('planner-sprint-goal').value = '';
  openModal('new-planner-sprint-modal');
  setTimeout(() => document.getElementById('planner-sprint-name').focus(), 100);
}

function handleCreatePlannerSprint() {
  const name = document.getElementById('planner-sprint-name').value.trim();
  if (!name) { showToast('Enter a sprint name', 'error'); return; }

  const sprint = {
    id: uid(), name,
    startDate: document.getElementById('planner-sprint-start').value || new Date().toISOString().slice(0, 10),
    endDate: document.getElementById('planner-sprint-end').value || '',
    status: 'planned', goal: document.getElementById('planner-sprint-goal').value.trim(),
    items: [], plannerBacklog: [],
    createdAt: new Date().toISOString(), completedAt: null,
  };

  sprints.push(sprint);
  currentSprintId = sprint.id;
  saveSprints();
  syncBacklogRef();

  closeModal('new-planner-sprint-modal');
  populateSprintDropdown();
  renderColumns();
  recalculate();
  updateSprintUI();
  showToast('Sprint created: ' + name);
}

function deletePlannerSprint() {
  const sprint = getCurrentSprint();
  if (!sprint) return;

  const msg = sprint.plannerBacklog.length > 0
    ? `Delete "${sprint.name}" and its ${sprint.plannerBacklog.length} planned stories? This cannot be undone.`
    : `Delete "${sprint.name}"? This cannot be undone.`;
  if (!confirm(msg)) return;

  sprints = sprints.filter(s => s.id !== sprint.id);

  if (sprints.length === 0) {
    const newSprint = {
      id: uid(), name: 'Sprint 1', status: 'active',
      items: [], plannerBacklog: [],
      startDate: new Date().toISOString().slice(0, 10), endDate: '', goal: '',
      createdAt: new Date().toISOString(), completedAt: null,
    };
    sprints.push(newSprint);
    currentSprintId = newSprint.id;
  } else {
    currentSprintId = (sprints.find(s => s.status === 'active') || sprints.find(s => s.status === 'planned') || sprints[0])?.id || null;
  }

  saveSprints();
  syncBacklogRef();
  populateSprintDropdown();
  renderColumns();
  recalculate();
  updateSprintUI();
  showToast('Sprint deleted');
}

// ─── Config Hydration & Binding ───

function hydrateConfigInputs() {
  document.getElementById('sprint-days').value = sprintConfig.days;
  document.getElementById('ceremony-hours').value = sprintConfig.ceremonyHours;
}

function bindConfigListeners() {
  document.getElementById('sprint-days').addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10);
    if (val > 0 && val <= 30) {
      sprintConfig.days = val;
      persistConfig();
      recalculate();
    }
  });

  document.getElementById('ceremony-hours').addEventListener('change', (e) => {
    const val = parseFloat(e.target.value);
    if (val >= 0) {
      sprintConfig.ceremonyHours = val;
      persistConfig();
      recalculate();
    }
  });
}

function persistConfig() {
  saveProjectData('sprint-config', sprintConfig);
}

// ─── Team Members ───

function renderTeamTable() {
  const tbody = document.getElementById('team-table-body');
  const cards = document.getElementById('team-cards');
  const content = document.getElementById('team-content');
  const empty = document.getElementById('team-empty');

  if (teamMembers.length === 0) {
    tbody.innerHTML = '';
    if (cards) cards.innerHTML = '';
    content.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  content.classList.remove('hidden');
  empty.classList.add('hidden');

  const avatarColors = [
    'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
    'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
    'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
  ];

  // Desktop table rows
  tbody.innerHTML = teamMembers.map((m, idx) => {
    const netHours = calcMemberNetHours(m);
    const initials = m.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const colorClass = avatarColors[idx % avatarColors.length];
    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
        <td class="px-5 py-3.5">
          <div class="flex items-center gap-3">
            <div class="member-avatar ${colorClass}">${initials}</div>
            <div>
              <p class="text-sm font-medium text-slate-900 dark:text-slate-100">${escHtml(m.name)}</p>
              <p class="text-xs text-slate-400 dark:text-slate-500">${escHtml(m.role)}</p>
            </div>
          </div>
        </td>
        <td class="px-4 py-3.5 text-center">
          <span class="text-sm font-medium text-slate-700 dark:text-slate-300">${m.dailyCapacity}</span>
        </td>
        <td class="px-4 py-3.5 text-center">
          <span class="text-sm text-slate-500 dark:text-slate-400">${m.ptoDays}</span>
        </td>
        <td class="px-4 py-3.5 text-center">
          <span class="text-sm font-semibold text-slate-900 dark:text-white">${netHours.toFixed(1)}</span>
        </td>
        <td class="px-5 py-3.5 text-right">
          <button onclick="editMember('${m.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Edit">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button onclick="deleteMember('${m.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Mobile cards
  if (cards) {
    cards.innerHTML = teamMembers.map((m, idx) => {
      const netHours = calcMemberNetHours(m);
      const initials = m.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
      const colorClass = avatarColors[idx % avatarColors.length];
      return `
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div class="flex items-center gap-3 mb-3">
            <div class="member-avatar ${colorClass}">${initials}</div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">${escHtml(m.name)}</p>
              <p class="text-xs text-slate-400 dark:text-slate-500">${escHtml(m.role)}</p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button onclick="editMember('${m.id}')" class="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Edit">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button onclick="deleteMember('${m.id}')" class="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="py-2 px-1 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <p class="text-xs text-slate-400 dark:text-slate-500">Daily</p>
              <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">${m.dailyCapacity}h</p>
            </div>
            <div class="py-2 px-1 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <p class="text-xs text-slate-400 dark:text-slate-500">PTO</p>
              <p class="text-sm font-semibold text-slate-500 dark:text-slate-400">${m.ptoDays}d</p>
            </div>
            <div class="py-2 px-1 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <p class="text-xs text-slate-400 dark:text-slate-500">Net</p>
              <p class="text-sm font-bold text-slate-900 dark:text-white">${netHours.toFixed(1)}h</p>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
}

function calcMemberNetHours(member) {
  // Net hours = (sprint days - pto days) * daily capacity - ceremony hours
  const workDays = Math.max(0, sprintConfig.days - member.ptoDays);
  return Math.max(0, workDays * member.dailyCapacity - sprintConfig.ceremonyHours);
}

function openMemberModal(memberId) {
  const titleEl = document.getElementById('member-modal-title');
  const form = document.getElementById('member-form');
  form.reset();
  document.getElementById('member-edit-id').value = '';

  if (memberId) {
    const m = teamMembers.find(x => x.id === memberId);
    if (!m) return;
    titleEl.textContent = 'Edit Team Member';
    document.getElementById('member-edit-id').value = m.id;
    document.getElementById('member-name').value = m.name;
    document.getElementById('member-role').value = m.role;
    document.getElementById('member-capacity').value = m.dailyCapacity;
    document.getElementById('member-pto').value = m.ptoDays;
  } else {
    titleEl.textContent = 'Add Team Member';
    document.getElementById('member-capacity').value = 6;
    document.getElementById('member-pto').value = 0;
  }

  openModal('member-modal');
}

function editMember(id) {
  openMemberModal(id);
}

function handleMemberSubmit(e) {
  e.preventDefault();

  const editId = document.getElementById('member-edit-id').value;
  const name = document.getElementById('member-name').value.trim();
  const role = document.getElementById('member-role').value.trim();
  const dailyCapacity = parseFloat(document.getElementById('member-capacity').value);
  const ptoDays = parseInt(document.getElementById('member-pto').value, 10);

  if (!name || !role) return;

  if (editId) {
    const idx = teamMembers.findIndex(m => m.id === editId);
    if (idx !== -1) {
      teamMembers[idx] = { ...teamMembers[idx], name, role, dailyCapacity, ptoDays };
      showToast('Member updated');
    }
  } else {
    teamMembers.push({ id: uid(), name, role, dailyCapacity, ptoDays });
    showToast('Member added');
  }

  persistTeam();
  renderTeamTable();
  recalculate();
  closeModal('member-modal');
}

function deleteMember(id) {
  if (!confirmAction('Remove this team member?')) return;
  teamMembers = teamMembers.filter(m => m.id !== id);
  persistTeam();
  renderTeamTable();
  recalculate();
  showToast('Member removed');
}

function persistTeam() {
  saveProjectData('sprint-team', teamMembers);
}

// ─── Backlog Items ───

function openItemModal(committed) {
  const titleEl = document.getElementById('item-modal-title');
  const form = document.getElementById('item-form');
  form.reset();
  document.getElementById('item-edit-id').value = '';
  document.getElementById('item-committed-flag').value = committed ? 'true' : 'false';
  titleEl.textContent = committed ? 'Add Committed Item' : 'Add Backlog Item';
  document.getElementById('item-points').value = 3;
  document.getElementById('item-hours').value = 8;
  openModal('item-modal');
}

function editItem(id) {
  const item = backlogItems.find(x => x.id === id);
  if (!item) return;

  document.getElementById('item-modal-title').textContent = 'Edit Item';
  document.getElementById('item-edit-id').value = item.id;
  document.getElementById('item-committed-flag').value = item.committed ? 'true' : 'false';
  document.getElementById('item-title').value = item.title;
  document.getElementById('item-points').value = item.storyPoints;
  document.getElementById('item-hours').value = item.estimatedHours;
  openModal('item-modal');
}

function handleItemSubmit(e) {
  e.preventDefault();

  const editId = document.getElementById('item-edit-id').value;
  const title = document.getElementById('item-title').value.trim();
  const storyPoints = parseInt(document.getElementById('item-points').value, 10);
  const estimatedHours = parseFloat(document.getElementById('item-hours').value);
  const committed = document.getElementById('item-committed-flag').value === 'true';

  if (!title) return;

  if (editId) {
    const idx = backlogItems.findIndex(i => i.id === editId);
    if (idx !== -1) {
      backlogItems[idx] = { ...backlogItems[idx], title, storyPoints, estimatedHours };
      showToast('Item updated');
    }
  } else {
    backlogItems.push({ id: uid(), title, storyPoints, estimatedHours, committed });
    showToast('Item added');
  }

  persistBacklog();
  renderColumns();
  recalculate();
  closeModal('item-modal');
}

function deleteItem(id) {
  if (!confirmAction('Delete this item?')) return;
  const idx2 = backlogItems.findIndex(i => i.id === id);
  if (idx2 !== -1) backlogItems.splice(idx2, 1);
  persistBacklog();
  renderColumns();
  recalculate();
  showToast('Item deleted');
}

function moveItem(id) {
  const idx = backlogItems.findIndex(i => i.id === id);
  if (idx === -1) return;
  backlogItems[idx].committed = !backlogItems[idx].committed;
  persistBacklog();
  renderColumns();
  recalculate();
  showToast(backlogItems[idx].committed ? 'Item committed to sprint' : 'Item moved to backlog');
}

// ─── Planner Detail Modal ───

function openPlannerDetail(itemId) {
  const item = backlogItems.find(i => i.id === itemId);
  if (!item) return;

  // Look up full story data if linked
  const story = item.storyId ? (loadProjectData(STORY_SOURCE_KEY, []).find(s => s.id === item.storyId) || null) : null;

  // Look up epic via traceability
  const epics = loadProjectData('traceability', []);
  let epic = null;
  if (item.storyId) {
    epic = epics.find(e => (e.linkedStories || []).includes(item.storyId)) || null;
  }

  // Title
  const titleEl = document.getElementById('pd-title');
  if (story) {
    titleEl.textContent = 'As a ' + (story.role || '') + ', I want ' + (story.action || '');
  } else {
    titleEl.textContent = item.title || 'Untitled Item';
  }

  // Benefit
  const benefitEl = document.getElementById('pd-benefit');
  if (story && story.benefit) {
    const b = story.benefit.trim();
    benefitEl.textContent = b.toLowerCase().startsWith('so that') ? b : 'So that ' + b;
  } else {
    benefitEl.textContent = '';
  }

  // Acceptance criteria
  const acSection = document.getElementById('pd-ac-section');
  const acList = document.getElementById('pd-ac-list');
  const noStory = document.getElementById('pd-no-story');
  if (story && story.acceptanceCriteria && story.acceptanceCriteria.length > 0) {
    acList.innerHTML = story.acceptanceCriteria.map(ac =>
      `<li class="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
        <svg class="w-4 h-4 mt-0.5 text-slate-400 dark:text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4"/></svg>
        <span>${escHtml(ac)}</span>
      </li>`
    ).join('');
    acSection.classList.remove('hidden');
    noStory.classList.add('hidden');
  } else if (!story) {
    acSection.classList.add('hidden');
    noStory.classList.remove('hidden');
  } else {
    acSection.classList.add('hidden');
    noStory.classList.add('hidden');
  }

  // Epic
  const epicSection = document.getElementById('pd-epic-section');
  if (epic) {
    document.getElementById('pd-epic-id').textContent = epic.id;
    epicSection.classList.remove('hidden');
  } else {
    epicSection.classList.add('hidden');
  }

  // Status
  const statusEl = document.getElementById('pd-status');
  if (item.committed) {
    statusEl.textContent = 'Committed';
    statusEl.className = 'inline-block text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
  } else {
    statusEl.textContent = 'Backlog';
    statusEl.className = 'inline-block text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
  }

  // Points + Hours
  document.getElementById('pd-points').textContent = (item.storyPoints || 0) + ' pts';
  document.getElementById('pd-hours').textContent = (item.estimatedHours || 0) + ' hrs';

  // Priority
  const prioSection = document.getElementById('pd-priority-section');
  const prioEl = document.getElementById('pd-priority');
  if (story && story.priority) {
    const prioColors = {
      'Must Have': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
      'Should Have': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
      'Could Have': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
      "Won't Have": 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    };
    prioEl.textContent = story.priority;
    prioEl.className = 'inline-block text-xs px-2.5 py-1 rounded-full font-semibold ' + (prioColors[story.priority] || prioColors['Could Have']);
    prioSection.classList.remove('hidden');
  } else {
    prioSection.classList.add('hidden');
  }

  // Move button label
  document.getElementById('pd-move-label').textContent = item.committed ? 'Move to Backlog' : 'Commit to Sprint';

  // Store item id on modal
  document.getElementById('planner-detail-modal').dataset.itemId = itemId;
  openModal('planner-detail-modal');
}

function movePlannerDetailItem() {
  const itemId = document.getElementById('planner-detail-modal').dataset.itemId;
  moveItem(itemId);
  // Refresh the modal state
  const item = backlogItems.find(i => i.id === itemId);
  if (item) {
    const statusEl = document.getElementById('pd-status');
    if (item.committed) {
      statusEl.textContent = 'Committed';
      statusEl.className = 'inline-block text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
    } else {
      statusEl.textContent = 'Backlog';
      statusEl.className = 'inline-block text-xs px-2.5 py-1 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
    }
    document.getElementById('pd-move-label').textContent = item.committed ? 'Move to Backlog' : 'Commit to Sprint';
  }
}

function editPlannerDetailItem() {
  const itemId = document.getElementById('planner-detail-modal').dataset.itemId;
  closeModal('planner-detail-modal');
  editItem(itemId);
}

function deletePlannerDetailItem() {
  const itemId = document.getElementById('planner-detail-modal').dataset.itemId;
  closeModal('planner-detail-modal');
  deleteItem(itemId);
}

function persistBacklog() {
  const sprint = getCurrentSprint();
  if (sprint) sprint.plannerBacklog = backlogItems;
  saveSprints();
}

// ─── Render Columns ───

let plannerEpicMap = new Map(); // storyId -> epic

function buildPlannerEpicMap() {
  plannerEpicMap = new Map();
  const epics = loadProjectData('traceability', []);
  epics.forEach(epic => {
    (epic.linkedStories || []).forEach(storyId => {
      plannerEpicMap.set(storyId, epic);
    });
  });
}

function renderColumns() {
  buildPlannerEpicMap();
  const backlogCol = document.getElementById('backlog-column');
  const committedCol = document.getElementById('committed-column');

  const backlog = backlogItems.filter(i => !i.committed);
  const committed = backlogItems.filter(i => i.committed);

  document.getElementById('backlog-count').textContent = backlog.length;
  document.getElementById('committed-count').textContent = committed.length;

  backlogCol.innerHTML = backlog.length
    ? backlog.map(renderItemCard).join('')
    : '<p class="text-sm text-slate-500 dark:text-slate-500 text-center py-8">No backlog items yet</p>';

  committedCol.innerHTML = committed.length
    ? committed.map(renderItemCard).join('')
    : '<p class="text-sm text-slate-500 dark:text-slate-500 text-center py-8">Move or drag items here to commit them</p>';
}

function renderItemCard(item) {
  const moveIcon = item.committed
    ? '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>'
    : '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>';
  const moveTitle = item.committed ? 'Move to Backlog' : 'Commit to Sprint';
  const moveColor = item.committed
    ? 'text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
    : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20';
  const epic = item.storyId ? plannerEpicMap.get(item.storyId) : null;

  return `
    <div class="item-card flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-grab transition-colors hover:border-slate-400 dark:hover:border-slate-500"
      draggable="true"
      data-item-id="${item.id}"
      onclick="openPlannerDetail('${item.id}')"
      ondragstart="handleDragStart(event)"
      ondragend="handleDragEnd(event)">
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">${escHtml(item.title)}</p>
        <div class="flex items-center gap-3 mt-1">
          ${epic ? `<span class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 font-medium"><svg class="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>${escHtml(epic.id)}</span>` : ''}
          ${item.carriedFrom ? `<span class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 font-medium" title="Was ${escHtml(item.carriedFrom.previousColumn)} in ${escHtml(item.carriedFrom.sprintName)}"><svg class="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>${escHtml(item.carriedFrom.sprintName)} / ${escHtml(item.carriedFrom.previousColumn)}</span>` : ''}
          <span class="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-500">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>
            ${item.storyPoints} pts
          </span>
          <span class="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-500">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            ${item.estimatedHours} hrs
          </span>
        </div>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <button onclick="event.stopPropagation(); moveItem('${item.id}')" class="p-2 rounded ${moveColor} transition-colors" title="${moveTitle}">
          ${moveIcon}
        </button>
        <button onclick="event.stopPropagation(); editItem('${item.id}')" class="p-2 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Edit">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <button onclick="event.stopPropagation(); deleteItem('${item.id}')" class="p-2 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>
  `;
}

// ─── Drag and Drop ───

function handleDragStart(e) {
  draggedItemId = e.currentTarget.dataset.itemId;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  // Required for Firefox
  e.dataTransfer.setData('text/plain', draggedItemId);
}

function handleDragEnd(e) {
  draggedItemId = null;
  e.currentTarget.classList.remove('dragging');
  // Clean up drag-over styles from all columns
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  // Only remove if leaving the column itself, not a child
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-over');
  }
}

function handleDrop(e, targetCommitted) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  const itemId = e.dataTransfer.getData('text/plain') || draggedItemId;
  if (!itemId) return;

  const idx = backlogItems.findIndex(i => i.id === itemId);
  if (idx === -1) return;

  // Only update if the committed state actually changes
  if (backlogItems[idx].committed !== targetCommitted) {
    backlogItems[idx].committed = targetCommitted;
    persistBacklog();
    renderColumns();
    recalculate();
    showToast(targetCommitted ? 'Item committed to sprint' : 'Item moved to backlog');
  }

  draggedItemId = null;
}

// ─── Capacity Calculation ───

function recalculate() {
  const available = teamMembers.reduce((sum, m) => sum + calcMemberNetHours(m), 0);
  const committed = backlogItems
    .filter(i => i.committed)
    .reduce((sum, i) => sum + i.estimatedHours, 0);
  const remaining = available - committed;
  const ratio = available > 0 ? committed / available : 0;

  // Update stats
  document.getElementById('stat-available').textContent = `${available.toFixed(1)} hrs`;
  document.getElementById('stat-committed').textContent = `${committed.toFixed(1)} hrs`;
  document.getElementById('stat-remaining').textContent = `${remaining.toFixed(1)} hrs`;
  document.getElementById('stat-ratio').textContent = `${(ratio * 100).toFixed(0)}%`;

  // Color the remaining stat based on sign
  const remainingEl = document.getElementById('stat-remaining');
  if (remaining < 0) {
    remainingEl.classList.add('text-red-500');
    remainingEl.classList.remove('text-emerald-500', 'text-slate-900', 'dark:text-white');
  } else if (remaining > 0) {
    remainingEl.classList.add('text-emerald-500');
    remainingEl.classList.remove('text-red-500', 'text-slate-900', 'dark:text-white');
  } else {
    remainingEl.classList.remove('text-red-500', 'text-emerald-500');
  }

  // Capacity bar: clamp visual width to 100%, color by threshold
  const barPct = Math.min(ratio * 100, 100);
  const bar = document.getElementById('capacity-bar');
  bar.style.width = `${barPct}%`;

  if (ratio < 0.8) {
    bar.className = 'capacity-fill bg-emerald-500';
  } else if (ratio <= 1.0) {
    bar.className = 'capacity-fill bg-amber-500';
  } else {
    bar.className = 'capacity-fill bg-red-500';
  }

  const pctText = `${(ratio * 100).toFixed(0)}%`;
  const pctLabel = document.getElementById('capacity-pct-label');
  if (pctLabel) pctLabel.textContent = pctText;

  const capLabel = document.getElementById('capacity-label');
  if (capLabel) {
    if (ratio <= 0) capLabel.textContent = 'Target: 70-85%';
    else if (ratio < 0.7) capLabel.textContent = 'Under-committed';
    else if (ratio <= 0.85) capLabel.textContent = 'Healthy range';
    else if (ratio <= 1.0) capLabel.textContent = 'Approaching limit';
    else capLabel.textContent = 'Over-committed';
  }
}

// ─── CSV Export ───

function handleExportCSV() {
  const teamHeaders = ['Name', 'Role', 'Daily Capacity (hrs)', 'PTO Days', 'Net Hours'];
  const teamRows = teamMembers.map(m => [
    m.name,
    m.role,
    m.dailyCapacity,
    m.ptoDays,
    calcMemberNetHours(m).toFixed(1),
  ]);

  const available = teamMembers.reduce((sum, m) => sum + calcMemberNetHours(m), 0);
  const committedHours = backlogItems
    .filter(i => i.committed)
    .reduce((sum, i) => sum + i.estimatedHours, 0);

  // Add summary row after team data
  teamRows.push([]);
  teamRows.push(['Sprint Summary']);
  teamRows.push(['Sprint Days', sprintConfig.days]);
  teamRows.push(['Ceremony Hours / Person', sprintConfig.ceremonyHours]);
  teamRows.push(['Total Available Capacity', available.toFixed(1)]);
  teamRows.push(['Committed Hours', committedHours.toFixed(1)]);
  teamRows.push(['Remaining Capacity', (available - committedHours).toFixed(1)]);
  teamRows.push(['Commitment Ratio', `${(available > 0 ? (committedHours / available) * 100 : 0).toFixed(0)}%`]);

  // Add committed items section
  teamRows.push([]);
  teamRows.push(['Committed Items']);
  teamRows.push(['Title', 'Story Points', 'Estimated Hours']);
  backlogItems
    .filter(i => i.committed)
    .forEach(i => teamRows.push([i.title, i.storyPoints, i.estimatedHours]));

  exportCSV('sprint-capacity.csv', teamHeaders, teamRows);
}

// ─── AI: Sprint Review ───

function initAiSprintButton() {
  const wrapper = document.getElementById('config-buttons');
  if (!wrapper) return;

  const btn = document.createElement('button');
  btn.id = 'btn-ai-sprint-review';
  btn.className = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors flex-1 sm:flex-initial';
  btn.innerHTML = AI_ICON + ' <span class="hidden sm:inline">AI </span>Review';
  btn.onclick = handleAiSprintReview;
  wrapper.prepend(btn);
}

async function handleAiSprintReview() {
  if (!ensureApiKey()) return;

  if (teamMembers.length === 0 || backlogItems.filter(i => i.committed).length === 0) {
    showToast('Add team members and commit items first', 'error');
    return;
  }

  const btn = document.getElementById('btn-ai-sprint-review');
  setAiButtonLoading(btn, true);

  try {
    const projectCtx = getProjectContextForAI();
    const available = teamMembers.reduce((sum, m) => sum + calcMemberNetHours(m), 0);
    const committed = backlogItems.filter(i => i.committed);
    const committedHours = committed.reduce((sum, i) => sum + i.estimatedHours, 0);
    const ratio = available > 0 ? (committedHours / available * 100).toFixed(0) : 0;

    const teamSummary = teamMembers.map(m =>
      m.name + ' (' + m.role + '): ' + calcMemberNetHours(m).toFixed(1) + ' hrs available'
    ).join('\n');

    const itemsSummary = committed.map(i =>
      '- ' + i.title + ': ' + i.storyPoints + ' pts, ' + i.estimatedHours + ' hrs'
    ).join('\n');

    const result = await callOpenRouterAPI([
      {
        role: 'system',
        content: 'You are an agile coach reviewing a sprint plan. Provide a brief, actionable analysis in plain text. Cover: 1) Is the team overcommitted or undercommitted? 2) Any team balance concerns? 3) Specific suggestions to improve the sprint plan. Keep it concise (3-5 short paragraphs).' + projectCtx
      },
      {
        role: 'user',
        content: 'Sprint: ' + sprintConfig.days + ' days, ' + sprintConfig.ceremonyHours + ' hrs ceremony/person\n\nTeam (' + teamMembers.length + ' members):\n' + teamSummary + '\n\nTotal Available: ' + available.toFixed(1) + ' hrs\nCommitted: ' + committedHours.toFixed(1) + ' hrs (' + ratio + '%)\n\nCommitted Items:\n' + itemsSummary
      }
    ]);

    showAiSprintResults(result);
  } catch (err) {
    showToast('AI error: ' + err.message, 'error');
  } finally {
    setAiButtonLoading(btn, false);
  }
}

function showAiSprintResults(text) {
  let panel = document.getElementById('ai-sprint-results');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'ai-sprint-results';
    const capacityPanel = document.getElementById('capacity-panel');
    capacityPanel.after(panel);
  }

  panel.className = 'ai-results-panel max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6';
  panel.innerHTML = `
    <div class="rounded-xl border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-900/10 p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">AI Sprint Review</h3>
        <button onclick="document.getElementById('ai-sprint-results').remove()" class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">${escHtml(text)}</div>
    </div>
  `;
}

// ─── Import from User Story Forge (Epic-Grouped) ───

function initImportFromStoriesButton() {
  const wrapper = document.getElementById('config-buttons');
  if (!wrapper) return;

  const btn = document.createElement('button');
  btn.id = 'btn-import-stories';
  btn.className = 'inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex-1 sm:flex-initial';
  btn.innerHTML = '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg> Import<span class="hidden sm:inline"> Stories</span>';
  btn.onclick = openStoryImportModal;
  wrapper.prepend(btn);
}

function openStoryImportModal() {
  const allStories = loadProjectData(STORY_SOURCE_KEY, []);
  // Only show stories that aren't already done
  const sourceStories = allStories.filter(s => s.status !== 'Done');
  if (sourceStories.length === 0) {
    const hasDone = allStories.some(s => s.status === 'Done');
    showToast(hasDone ? 'All stories are Done -- no incomplete stories to import' : 'No stories found -- create stories in User Story Forge first', 'error');
    return;
  }

  // Already-imported story titles (to dim duplicates)
  const existingTitles = new Set(backlogItems.map(i => i.title.toLowerCase()));

  // Build epic grouping
  const epics = loadProjectData('traceability', []);
  const storyEpicMap = new Map();
  epics.forEach(epic => {
    (epic.linkedStories || []).forEach(storyId => {
      storyEpicMap.set(storyId, epic);
    });
  });

  const epicStoryGroups = new Map();
  const unlinked = [];

  sourceStories.forEach(story => {
    const epic = storyEpicMap.get(story.id);
    if (epic) {
      if (!epicStoryGroups.has(epic.id)) epicStoryGroups.set(epic.id, { epic, stories: [] });
      epicStoryGroups.get(epic.id).stories.push(story);
    } else {
      unlinked.push(story);
    }
  });

  const orderedGroups = [];
  epics.forEach(epic => {
    const group = epicStoryGroups.get(epic.id);
    if (group && group.stories.length > 0) orderedGroups.push(group);
  });

  // Build or reuse modal
  let modal = document.getElementById('story-import-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'story-import-modal';
    modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Import from User Story Forge</h2>
          <button onclick="closeModal('story-import-modal')" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <p class="px-5 pt-3 text-xs text-slate-500 dark:text-slate-400">Select stories to add to this sprint's planning backlog.</p>
        <div class="flex items-center gap-2 px-5 pt-2">
          <button onclick="toggleStoryImportAll(true)" class="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline">Select All</button>
          <span class="text-slate-300 dark:text-slate-700">|</span>
          <button onclick="toggleStoryImportAll(false)" class="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline">Deselect All</button>
        </div>
        <div id="story-import-list" class="flex-1 overflow-y-auto p-5 space-y-1"></div>
        <div class="flex items-center justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-800">
          <button onclick="closeModal('story-import-modal')" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Cancel</button>
          <button onclick="handleStoryImport()" class="px-4 py-2 rounded-lg bg-slate-800 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 text-sm font-semibold transition-colors">Import Selected</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const listEl = document.getElementById('story-import-list');

  // If no epics, render flat list
  if (orderedGroups.length === 0 && unlinked.length > 0) {
    listEl.innerHTML = unlinked.map(s => renderStoryImportRow(s, existingTitles)).join('');
    openModal('story-import-modal');
    return;
  }

  let html = '';
  orderedGroups.forEach(group => {
    html += renderStoryImportAccordion(group.epic, group.stories, existingTitles);
  });
  if (unlinked.length > 0) {
    html += renderStoryImportAccordion(null, unlinked, existingTitles);
  }

  listEl.innerHTML = html;
  openModal('story-import-modal');
}

function renderStoryImportAccordion(epic, stories, existingTitles) {
  const key = epic ? epic.id : '_unlinked';
  const isOpen = importAccordionOpen.has(key);
  const count = stories.length;
  const totalPts = stories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);

  const epicPriorityColors = {
    High: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    Low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };

  let headerContent;
  if (epic) {
    const pClass = epicPriorityColors[epic.priority] || epicPriorityColors.Medium;
    headerContent = `
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <span class="text-[10px] font-mono text-slate-400 dark:text-slate-500 shrink-0">${escHtml(epic.id)}</span>
        <span class="text-sm font-semibold text-slate-900 dark:text-white truncate">${escHtml(epic.title || 'Untitled')}</span>
        ${epic.priority ? `<span class="inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${pClass} shrink-0">${escHtml(epic.priority)}</span>` : ''}
      </div>`;
  } else {
    headerContent = `<div class="flex items-center gap-2 min-w-0 flex-1"><span class="text-sm font-semibold text-slate-500 dark:text-slate-400">Unlinked Stories</span></div>`;
  }

  return `
    <div class="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 mb-2 overflow-hidden">
      <button onclick="togglePlannerAccordion('${key}')" class="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <svg id="planner-accordion-icon-${key}" class="w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform" style="${isOpen ? 'transform:rotate(180deg)' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        ${headerContent}
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">${count} stor${count === 1 ? 'y' : 'ies'}</span>
          <span class="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">${totalPts} pts</span>
        </div>
      </button>
      <div id="planner-accordion-body-${key}" class="${isOpen ? '' : 'hidden'} border-t border-slate-100 dark:border-slate-800">
        <div class="p-2 space-y-0.5">
          ${stories.map(s => renderStoryImportRow(s, existingTitles)).join('')}
        </div>
      </div>
    </div>`;
}

function renderStoryImportRow(story, existingTitles) {
  const title = 'As a ' + (story.role || '') + ', I want ' + (story.action || '');
  const alreadyImported = existingTitles.has(title.toLowerCase());
  const checked = alreadyImported ? 'checked disabled' : '';
  const dimClass = alreadyImported ? 'opacity-50' : '';

  const priorityColors = {
    'Must Have': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    'Should Have': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    'Could Have': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    "Won't Have": 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  };
  const pColor = priorityColors[story.priority] || priorityColors['Could Have'];

  return `
    <label class="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${dimClass}">
      <input type="checkbox" value="${story.id}" ${checked}
        class="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white focus:ring-slate-400">
      <div class="flex-1 min-w-0">
        <p class="text-sm text-slate-800 dark:text-slate-200 leading-snug">${escHtml(title)}</p>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-xs px-1.5 py-0.5 rounded ${pColor}">${escHtml(story.priority || 'Unset')}</span>
          <span class="text-xs text-slate-500">${story.storyPoints || 0} pts</span>
          ${alreadyImported ? '<span class="text-xs text-slate-400 italic ml-auto">Already imported</span>' : ''}
        </div>
      </div>
    </label>
  `;
}

function togglePlannerAccordion(key) {
  if (importAccordionOpen.has(key)) {
    importAccordionOpen.delete(key);
  } else {
    importAccordionOpen.add(key);
  }
  const body = document.getElementById('planner-accordion-body-' + key);
  const icon = document.getElementById('planner-accordion-icon-' + key);
  if (body) body.classList.toggle('hidden');
  if (icon) icon.style.transform = importAccordionOpen.has(key) ? 'rotate(180deg)' : '';
}

function toggleStoryImportAll(selectAll) {
  const checkboxes = document.querySelectorAll('#story-import-list input[type="checkbox"]:not(:disabled)');
  checkboxes.forEach(cb => cb.checked = selectAll);
}

function handleStoryImport() {
  const checkboxes = document.querySelectorAll('#story-import-list input[type="checkbox"]:checked:not(:disabled)');
  if (checkboxes.length === 0) {
    showToast('Select at least one story to import', 'error');
    return;
  }

  const sourceStories = loadProjectData(STORY_SOURCE_KEY, []);
  const selectedIds = new Set();
  checkboxes.forEach(cb => selectedIds.add(cb.value));

  let imported = 0;
  sourceStories.forEach(story => {
    if (!selectedIds.has(story.id)) return;

    backlogItems.push({
      id: uid(),
      storyId: story.id,
      title: 'As a ' + (story.role || '') + ', I want ' + (story.action || ''),
      storyPoints: story.storyPoints || 0,
      estimatedHours: (story.storyPoints || 0) * 4,
      committed: false,
    });
    imported++;
  });

  persistBacklog();
  renderColumns();
  recalculate();
  closeModal('story-import-modal');
  showToast(imported + ' stor' + (imported === 1 ? 'y' : 'ies') + ' imported to backlog');
}

// ─── Utility ───

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
