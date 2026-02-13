/* -- Sprint Board -- */

// ─── Constants ───
const BOARD_KEY = 'sprint-board';
const STORY_SOURCE_KEY = 'user-stories';

const COLUMNS = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'To Do' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];

const PRIORITY_COLORS = {
  'Must Have': { bar: 'priority-bar-must', badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300', accent: 'bg-red-500', short: 'Must' },
  'Should Have': { bar: 'priority-bar-should', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300', accent: 'bg-amber-500', short: 'Should' },
  'Could Have': { bar: 'priority-bar-could', badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300', accent: 'bg-blue-500', short: 'Could' },
  "Won't Have": { bar: 'priority-bar-wont', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400', accent: 'bg-slate-400', short: "Won't" },
};

// Maps board columns to User Story Forge statuses (1:1 match)
const COLUMN_TO_STORY_STATUS = {
  'backlog': 'Backlog',
  'todo': 'To Do',
  'in-progress': 'In Progress',
  'review': 'Review',
  'done': 'Done',
};

// ─── State ───
let sprints = [];
let currentSprintId = null;
let draggedItemId = null;
let mobileActiveColumn = 'backlog';
let importAccordionOpen = new Set();
let epicMap = new Map(); // storyId -> epic object

// Rebuild epic lookup from traceability data
function buildEpicMap() {
  epicMap = new Map();
  const epics = loadProjectData('traceability', []);
  epics.forEach(epic => {
    (epic.linkedStories || []).forEach(storyId => {
      epicMap.set(storyId, epic);
    });
  });
}

// ─── Sprint Helpers ───
function getCurrentSprint() {
  return sprints.find(s => s.id === currentSprintId) || null;
}

function getActiveItems() {
  const sprint = getCurrentSprint();
  return sprint ? sprint.items : [];
}

function isSprintReadOnly() {
  const sprint = getCurrentSprint();
  return sprint ? sprint.status === 'completed' : true;
}

function saveSprints() {
  saveProjectData(BOARD_KEY, sprints);
}

// ─── Migration ───
// Detects old flat board item arrays and wraps them into Sprint 1
function migrateSprintData() {
  const raw = migrateToolDataToProject(BOARD_KEY, []);

  // Already new format: array of sprint objects with .name and .status
  if (Array.isArray(raw) && raw.length > 0 && raw[0] && typeof raw[0].name === 'string' && typeof raw[0].status === 'string' && Array.isArray(raw[0].items)) {
    sprints = raw;
    // Ensure each sprint has plannerBacklog
    sprints.forEach(s => { if (!s.plannerBacklog) s.plannerBacklog = []; });
    // Auto-select: active first, then planned, then first available
    currentSprintId = (sprints.find(s => s.status === 'active') || sprints.find(s => s.status === 'planned') || sprints[0])?.id || null;
    return;
  }

  // Old format: flat array of board items (or empty)
  if (Array.isArray(raw)) {
    const sprint = {
      id: uid(),
      name: 'Sprint 1',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      status: 'active',
      goal: '',
      items: raw.length > 0 ? raw : [],
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    sprints = [sprint];
    currentSprintId = sprint.id;
    saveSprints();
    return;
  }

  // Fallback: fresh start
  const sprint = {
    id: uid(),
    name: 'Sprint 1',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    status: 'active',
    goal: '',
    items: [],
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
  sprints = [sprint];
  currentSprintId = sprint.id;
  saveSprints();
}

// ─── Sprint Management ───
function populateSprintDropdown() {
  // Sort: active first, then planned, then completed
  const statusOrder = { active: 0, planned: 1, completed: 2 };
  const sorted = [...sprints].sort((a, b) => (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1));

  const statusLabels = { active: 'Active', planned: 'Planned', completed: 'Completed' };
  const optionsHtml = sorted.map(s =>
    `<option value="${s.id}" ${s.id === currentSprintId ? 'selected' : ''}>${escHtml(s.name)} (${statusLabels[s.status] || s.status})</option>`
  ).join('');

  const desktopSelect = document.getElementById('sprint-select');
  const mobileSelect = document.getElementById('sprint-select-mobile');
  if (desktopSelect) desktopSelect.innerHTML = optionsHtml;
  if (mobileSelect) mobileSelect.innerHTML = optionsHtml;
}

function handleSprintChange(source) {
  const select = document.getElementById(source === 'mobile' ? 'sprint-select-mobile' : 'sprint-select');
  if (!select) return;
  currentSprintId = select.value || null;

  // Sync the other select
  const otherSelect = document.getElementById(source === 'mobile' ? 'sprint-select' : 'sprint-select-mobile');
  if (otherSelect) otherSelect.value = currentSprintId || '';

  // Reload sprints from storage to pick up planner changes
  const freshSprints = loadProjectData(BOARD_KEY, []);
  if (Array.isArray(freshSprints) && freshSprints.length > 0 && freshSprints[0].name) {
    sprints = freshSprints;
    sprints.forEach(s => { if (!s.plannerBacklog) s.plannerBacklog = []; });
  }

  renderBoard();
  updateSprintUI();
}

function updateSprintUI() {
  const sprint = getCurrentSprint();
  const readOnly = isSprintReadOnly();

  // Toggle action buttons based on sprint status
  const completeBtnD = document.getElementById('btn-complete-sprint');
  const completeBtnM = document.getElementById('btn-complete-sprint-mobile');
  const addBtnD = document.getElementById('btn-add-story-desktop');
  const addBtnM = document.getElementById('btn-add-story-mobile');
  const aiBtnD = document.getElementById('btn-ai-generate-desktop');
  const aiBtnM = document.getElementById('btn-ai-generate-mobile');
  const importBtnD = document.getElementById('btn-import');
  const importBtnM = document.getElementById('btn-import-mobile');
  const clearBtnD = document.getElementById('btn-clear-desktop');
  const clearBtnM = document.getElementById('btn-clear-mobile');
  // Complete button: only visible for active sprints
  const showComplete = sprint && sprint.status === 'active';
  if (completeBtnD) completeBtnD.classList.toggle('hidden', !showComplete);
  if (completeBtnM) completeBtnM.classList.toggle('hidden', !showComplete);

  // Disable mutation buttons when read-only (completed sprint)
  [addBtnD, addBtnM, aiBtnD, aiBtnM, importBtnD, importBtnM, clearBtnD, clearBtnM].forEach(btn => {
    if (!btn) return;
    if (readOnly) {
      btn.classList.add('opacity-50', 'pointer-events-none');
    } else {
      btn.classList.remove('opacity-50', 'pointer-events-none');
    }
  });
}

function openNewSprintModal() {
  let modal = document.getElementById('new-sprint-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'new-sprint-modal';
    modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">New Sprint</h2>
          <button onclick="closeModal('new-sprint-modal')" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="px-6 py-5 space-y-4">
          <div>
            <label for="new-sprint-name" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sprint Name</label>
            <input type="text" id="new-sprint-name" placeholder="Sprint 2"
              class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="new-sprint-start" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
              <input type="date" id="new-sprint-start"
                class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400">
            </div>
            <div>
              <label for="new-sprint-end" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Date</label>
              <input type="date" id="new-sprint-end"
                class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400">
            </div>
          </div>
          <div>
            <label for="new-sprint-goal" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sprint Goal <span class="text-slate-400 font-normal">(optional)</span></label>
            <textarea id="new-sprint-goal" rows="2" placeholder="What the team aims to achieve this sprint..."
              class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"></textarea>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button onclick="closeModal('new-sprint-modal')" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button onclick="handleCreateSprint()" class="px-5 py-2 rounded-lg bg-slate-800 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 text-sm font-semibold transition-colors">Create Sprint</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // Auto-suggest name
  const nextNum = sprints.length + 1;
  document.getElementById('new-sprint-name').value = 'Sprint ' + nextNum;
  document.getElementById('new-sprint-start').value = new Date().toISOString().slice(0, 10);
  document.getElementById('new-sprint-end').value = '';
  document.getElementById('new-sprint-goal').value = '';

  openModal('new-sprint-modal');
  setTimeout(() => document.getElementById('new-sprint-name').focus(), 100);
}

function handleCreateSprint() {
  const name = document.getElementById('new-sprint-name').value.trim();
  if (!name) {
    showToast('Enter a sprint name', 'error');
    return;
  }

  const sprint = {
    id: uid(),
    name,
    startDate: document.getElementById('new-sprint-start').value || new Date().toISOString().slice(0, 10),
    endDate: document.getElementById('new-sprint-end').value || '',
    status: 'planned',
    goal: document.getElementById('new-sprint-goal').value.trim(),
    items: [],
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  sprints.push(sprint);
  currentSprintId = sprint.id;
  saveSprints();

  closeModal('new-sprint-modal');
  populateSprintDropdown();
  renderBoard();
  updateSprintUI();
  showToast('Sprint created: ' + name);
}

function completeSprint() {
  const sprint = getCurrentSprint();
  if (!sprint || sprint.status !== 'active') return;

  const items = sprint.items;
  const total = items.length;
  const doneItems = items.filter(i => i.column === 'done');
  const doneCount = doneItems.length;
  const notDone = total - doneCount;
  const totalPts = items.reduce((s, i) => s + (i.storyPoints || 0), 0);
  const donePts = doneItems.reduce((s, i) => s + (i.storyPoints || 0), 0);

  const msg = `Complete "${sprint.name}"?\n\n` +
    `Stories: ${doneCount} done / ${notDone} remaining\n` +
    `Points: ${donePts} delivered / ${totalPts} total\n\n` +
    `Completed sprints become read-only.`;

  if (!confirm(msg)) return;

  sprint.status = 'completed';
  sprint.completedAt = new Date().toISOString();
  saveSprints();

  populateSprintDropdown();
  renderBoard();
  updateSprintUI();
  showToast(`Sprint completed -- ${donePts} pts delivered`);
}

function deleteCurrentSprint() {
  const sprint = getCurrentSprint();
  if (!sprint) return;

  const itemCount = sprint.items.length;
  const msg = itemCount > 0
    ? `Delete "${sprint.name}" and its ${itemCount} stories? This cannot be undone.`
    : `Delete "${sprint.name}"? This cannot be undone.`;

  if (!confirm(msg)) return;

  sprints = sprints.filter(s => s.id !== sprint.id);

  if (sprints.length === 0) {
    // Always keep at least one sprint
    const newSprint = {
      id: uid(),
      name: 'Sprint 1',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      status: 'active',
      goal: '',
      items: [],
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    sprints.push(newSprint);
    currentSprintId = newSprint.id;
  } else {
    currentSprintId = (sprints.find(s => s.status === 'active') || sprints.find(s => s.status === 'planned') || sprints[0])?.id || null;
  }

  saveSprints();
  populateSprintDropdown();
  renderBoard();
  updateSprintUI();
  showToast('Sprint deleted');
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  buildNav('sprint-board.html');

  const header = buildPageHeader(
    'Sprint Board',
    'Kanban-style sprint board. Import stories, drag between columns, and get AI implementation guidance.',
    `<div>
      <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">What is a Sprint Board?</h3>
      <p>A sprint board (also called a Kanban board or task board) is a visual workflow management tool that shows work items moving through stages from left to right. Each column represents a stage of work: <span class="font-medium text-slate-700 dark:text-slate-300">Backlog, To Do, In Progress, Review, and Done</span>. By looking at the board, anyone on the team can instantly see what is being worked on, what is stuck, and what is finished.</p>
    </div>
    <div>
      <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">Why Use This Tool?</h3>
      <p>Without a visual board, sprint progress lives in spreadsheets or people's heads. This tool makes work visible. It connects directly to User Story Forge -- you import stories rather than retyping them. When you drag a card to a new column, the status syncs back to the Stories page automatically. Each card also has an AI Solve feature that analyzes the story and provides implementation guidance: technical breakdown, step-by-step plan, code suggestions, and potential challenges.</p>
    </div>
    <div>
      <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">When to Use It</h3>
      <ul class="list-disc list-inside space-y-1 ml-1">
        <li><span class="font-medium text-slate-700 dark:text-slate-300">Sprint execution</span> -- Track daily progress during a sprint. Move cards as work advances.</li>
        <li><span class="font-medium text-slate-700 dark:text-slate-300">Daily standups</span> -- Walk the board left-to-right to discuss blockers and progress</li>
        <li><span class="font-medium text-slate-700 dark:text-slate-300">Implementation planning</span> -- Use AI Solve on a story before coding to get a technical breakdown</li>
        <li><span class="font-medium text-slate-700 dark:text-slate-300">Workload visibility</span> -- See at a glance if too many items are stuck in one column (a bottleneck)</li>
      </ul>
    </div>
    <div>
      <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">Key Concepts</h3>
      <ul class="list-disc list-inside space-y-1 ml-1">
        <li><span class="font-medium text-slate-700 dark:text-slate-300">Kanban Flow</span> -- Work items move through columns left-to-right. The goal is smooth, continuous flow with minimal bottlenecks. If "In Progress" piles up but "Review" is empty, something is wrong.</li>
        <li><span class="font-medium text-slate-700 dark:text-slate-300">WIP Limits</span> -- A best practice is to limit Work In Progress. Having 10 items "In Progress" usually means nothing is actually getting finished. Focus on finishing before starting.</li>
        <li><span class="font-medium text-slate-700 dark:text-slate-300">Status Sync</span> -- Moving a card here automatically updates the story status in User Story Forge, keeping both tools in sync without manual effort.</li>
      </ul>
    </div>`
  );
  document.getElementById('page-header').appendChild(header);

  migrateSprintData();
  populateSprintDropdown();
  renderBoard();
  updateSprintUI();
});

// ─── Board Rendering ───
function renderBoard() {
  buildEpicMap();
  const items = getActiveItems();
  const readOnly = isSprintReadOnly();

  // Desktop board
  const board = document.getElementById('board');
  board.innerHTML = COLUMNS.map(col => {
    const colItems = items.filter(i => i.column === col.id);
    const colPoints = colItems.reduce((sum, i) => sum + (i.storyPoints || 0), 0);

    return `
      <div class="flex-shrink-0 w-52 lg:w-56">
        <div class="flex items-center justify-between mb-3 px-1">
          <h3 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            ${col.label}
            <span class="ml-1 text-slate-400 dark:text-slate-600 font-normal">${colItems.length}</span>
          </h3>
          ${colPoints > 0 ? `<span class="text-xs text-slate-400 dark:text-slate-600">${colPoints} pts</span>` : ''}
        </div>
        <div class="relative">
          <div id="col-${col.id}"
            class="board-col rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-2 space-y-2 transition-colors max-h-[700px] overflow-y-auto scrollbar-hide"
            onscroll="updateColScrollIndicator('${col.id}')"
            ${readOnly ? '' : `ondrop="handleDrop(event, '${col.id}')" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)"`}>
            ${colItems.length === 0
              ? '<p class="text-xs text-slate-400 dark:text-slate-600 text-center py-8">Drop stories here</p>'
              : colItems.map(item => renderCard(item, readOnly)).join('')}
          </div>
          <div id="col-scroll-${col.id}" class="hidden absolute bottom-0 left-0 right-0 pointer-events-none rounded-b-xl overflow-hidden">
            <div class="h-10 bg-gradient-to-t from-slate-100/90 dark:from-slate-900/90 to-transparent"></div>
            <div class="flex justify-center pb-1.5 -mt-1 bg-slate-100/90 dark:bg-slate-900/90">
              <svg class="w-4 h-4 text-slate-400 dark:text-slate-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Mobile view
  renderMobileTabs();
  renderMobileColumn();

  updateBoardSummary();
  updateAllColumnScrollIndicators();
}

function updateAllColumnScrollIndicators() {
  COLUMNS.forEach(col => updateColScrollIndicator(col.id));
}

function updateMobileColScrollIndicator() {
  const area = document.getElementById('mobile-col-scroll-area');
  const indicator = document.getElementById('mobile-col-scroll-indicator');
  if (!area || !indicator) return;

  const hasMore = area.scrollHeight > area.clientHeight + 10 &&
                  area.scrollTop + area.clientHeight < area.scrollHeight - 10;
  indicator.classList.toggle('hidden', !hasMore);
}

function updateColScrollIndicator(colId) {
  const col = document.getElementById('col-' + colId);
  const indicator = document.getElementById('col-scroll-' + colId);
  if (!col || !indicator) return;

  const hasMore = col.scrollHeight > col.clientHeight + 10 &&
                  col.scrollTop + col.clientHeight < col.scrollHeight - 10;
  indicator.classList.toggle('hidden', !hasMore);
}

function renderCard(item, readOnly) {
  const colors = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS['Could Have'];
  const commentCount = (item.comments || []).length;
  const acCount = (item.acceptanceCriteria || []).length;
  const epic = item.storyId ? epicMap.get(item.storyId) : null;

  return `
    <div class="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden ${readOnly ? 'cursor-default' : 'cursor-grab'} hover:border-slate-400 dark:hover:border-slate-600 transition-all hover:shadow-md select-none"
      ${readOnly ? '' : 'draggable="true"'}
      data-item-id="${item.id}"
      ${readOnly ? '' : 'ondragstart="handleDragStart(event)" ondragend="handleDragEnd(event)"'}
      onclick="openDetail('${item.id}')">
      <div class="h-1 ${colors.accent}"></div>
      <!-- Header -->
      <div class="flex items-center gap-1.5 px-2.5 pt-2.5 pb-1.5">
        <span class="text-[10px] px-1.5 py-0.5 rounded ${colors.badge} font-semibold">${colors.short}</span>
        <span class="ml-auto text-[11px] font-bold text-slate-700 dark:text-slate-300">${item.storyPoints || 0}<span class="font-normal text-slate-400 ml-0.5">pts</span></span>
      </div>
      ${epic ? `<div class="px-2.5 pb-1"><span class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 font-medium" title="${escHtml(epic.title || '')}"><svg class="w-2.5 h-2.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>${escHtml(epic.id)}</span></div>` : ''}
      <!-- Body -->
      <div class="px-2.5 pb-2">
        <p class="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5 truncate">${escHtml(item.role)}</p>
        <p class="text-[13px] font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">${escHtml(item.action)}</p>
        ${item.benefit ? `<p class="text-[10px] text-slate-400 dark:text-slate-500 mt-1 line-clamp-1">${escHtml(item.benefit)}</p>` : ''}
      </div>
      <!-- Footer -->
      <div class="flex items-center gap-1.5 px-2.5 py-1.5 border-t border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-800/20">
        ${item.assignee
          ? `<span class="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[80px]" title="${escHtml(item.assignee)}">
              <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              ${escHtml(item.assignee)}</span>`
          : `<span class="text-[10px] text-slate-300 dark:text-slate-700">Unassigned</span>`}
        <span class="ml-auto flex items-center gap-1.5 shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
          ${acCount > 0 ? `<span class="flex items-center gap-0.5"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4"/></svg>${acCount}</span>` : ''}
          ${commentCount > 0 ? `<span class="flex items-center gap-0.5"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>${commentCount}</span>` : ''}
          ${item.aiSolution ? `<span class="flex items-center gap-0.5 text-indigo-400"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg></span>` : ''}
        </span>
      </div>
    </div>
  `;
}

function updateBoardSummary() {
  const items = getActiveItems();
  const sprint = getCurrentSprint();
  const total = items.length;
  const totalPts = items.reduce((s, i) => s + (i.storyPoints || 0), 0);
  const done = items.filter(i => i.column === 'done').length;
  const sprintLabel = sprint ? sprint.name : 'No sprint';
  const text = total === 0
    ? sprintLabel + ' -- No stories on board'
    : sprintLabel + ' -- ' + total + ' stories / ' + totalPts + ' pts / ' + done + ' done';
  const el = document.getElementById('board-summary');
  const elMobile = document.getElementById('board-summary-mobile');
  if (el) el.textContent = text;
  if (elMobile) elMobile.textContent = text;
}

// ─── Mobile Board ───

function renderMobileTabs() {
  const tabs = document.getElementById('mobile-col-tabs');
  if (!tabs) return;
  const items = getActiveItems();

  tabs.innerHTML = COLUMNS.map(col => {
    const count = items.filter(i => i.column === col.id).length;
    const active = col.id === mobileActiveColumn;
    return `<button onclick="setMobileColumn('${col.id}')"
      class="shrink-0 px-3.5 py-2 rounded-full text-xs font-semibold transition-colors whitespace-nowrap
      ${active
        ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}">
      ${col.label} <span class="opacity-60">${count}</span>
    </button>`;
  }).join('');
}

function renderMobileColumn() {
  const container = document.getElementById('mobile-col-view');
  if (!container) return;
  const items = getActiveItems();
  const readOnly = isSprintReadOnly();

  const colItems = items.filter(i => i.column === mobileActiveColumn);

  if (colItems.length === 0) {
    container.innerHTML = `
      <div class="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 py-12 text-center">
        <p class="text-sm text-slate-400 dark:text-slate-600">No stories in this column</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="relative">
      <div id="mobile-col-scroll-area" class="space-y-3 max-h-[70vh] overflow-y-auto scrollbar-hide" onscroll="updateMobileColScrollIndicator()">
        ${colItems.map(item => renderMobileCard(item, readOnly)).join('')}
      </div>
      <div id="mobile-col-scroll-indicator" class="hidden absolute bottom-0 left-0 right-0 pointer-events-none rounded-b-xl overflow-hidden">
        <div class="h-12 bg-gradient-to-t from-white/90 dark:from-slate-950/90 to-transparent"></div>
        <div class="flex justify-center pb-2 -mt-1 bg-white/90 dark:bg-slate-950/90">
          <svg class="w-5 h-5 text-slate-400 dark:text-slate-500 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </div>
      </div>
    </div>`;
  updateMobileColScrollIndicator();
}

function renderMobileCard(item, readOnly) {
  const colors = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS['Could Have'];
  const colIdx = COLUMNS.findIndex(c => c.id === item.column);
  const canBack = !readOnly && colIdx > 0;
  const canFwd = !readOnly && colIdx < COLUMNS.length - 1;
  const backLabel = colIdx > 0 ? COLUMNS[colIdx - 1].label : '';
  const fwdLabel = colIdx < COLUMNS.length - 1 ? COLUMNS[colIdx + 1].label : '';
  const acCount = (item.acceptanceCriteria || []).length;
  const commentCount = (item.comments || []).length;
  const epic = item.storyId ? epicMap.get(item.storyId) : null;

  const backBtnClass = canBack
    ? 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
    : 'text-slate-300 dark:text-slate-700 bg-slate-50 dark:bg-slate-900 cursor-not-allowed';
  const fwdBtnClass = canFwd
    ? 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
    : 'text-slate-300 dark:text-slate-700 bg-slate-50 dark:bg-slate-900 cursor-not-allowed';

  return `
    <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div class="h-1 ${colors.accent}"></div>
      <div class="p-4 cursor-pointer" onclick="openDetail('${item.id}')">
        <!-- Epic badge -->
        ${epic ? `<div class="mb-2"><span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 font-medium"><svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>${escHtml(epic.id)}</span></div>` : ''}
        <!-- Header: role pill + priority + points -->
        <div class="flex items-center gap-2 mb-2.5">
          <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">${escHtml(item.role)}</span>
          <span class="text-xs px-1.5 py-0.5 rounded ${colors.badge} font-semibold">${colors.short}</span>
          <span class="ml-auto text-sm font-bold text-slate-900 dark:text-white">${item.storyPoints || 0}<span class="text-xs font-normal text-slate-400 ml-0.5">pts</span></span>
        </div>

        <!-- Action text (hero) -->
        <p class="text-[15px] font-semibold text-slate-900 dark:text-slate-100 leading-snug mb-1">
          ${escHtml(item.action)}
        </p>

        <!-- Benefit (if exists) -->
        ${item.benefit ? `<p class="text-xs text-slate-400 dark:text-slate-500 leading-relaxed mb-3 line-clamp-2">so that ${escHtml(item.benefit)}</p>` : '<div class="mb-3"></div>'}

        <!-- Metadata strip -->
        <div class="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          ${item.assignee ? `
            <span class="inline-flex items-center gap-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              <span class="truncate max-w-[100px]">${escHtml(item.assignee)}</span>
            </span>` : ''}
          ${acCount > 0 ? `
            <span class="inline-flex items-center gap-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              ${acCount}
            </span>` : ''}
          ${commentCount > 0 ? `
            <span class="inline-flex items-center gap-1">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
              ${commentCount}
            </span>` : ''}
          ${item.aiSolution ? `
            <span class="inline-flex items-center gap-1 text-indigo-400">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
              AI
            </span>` : ''}
        </div>
      </div>

      <!-- Move buttons -->
      <div class="flex items-center gap-2 px-3 py-2.5 border-t border-slate-100 dark:border-slate-800">
        <button ${canBack ? `onclick="moveCardBack('${item.id}')"` : 'disabled'}
          class="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-colors ${backBtnClass}">
          <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          ${backLabel}
        </button>
        <button ${canFwd ? `onclick="moveCardForward('${item.id}')"` : 'disabled'}
          class="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-colors ${fwdBtnClass}">
          ${fwdLabel}
          <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
        </button>
      </div>
    </div>
  `;
}

function setMobileColumn(colId) {
  mobileActiveColumn = colId;
  renderMobileTabs();
  renderMobileColumn();
}

function moveCardForward(itemId) {
  if (isSprintReadOnly()) return;
  const items = getActiveItems();
  const idx = items.findIndex(i => i.id === itemId);
  if (idx === -1) return;
  const colIdx = COLUMNS.findIndex(c => c.id === items[idx].column);
  if (colIdx >= COLUMNS.length - 1) return;

  items[idx].column = COLUMNS[colIdx + 1].id;
  items[idx].updatedAt = new Date().toISOString();
  saveSprints();
  syncStoryStatus(items[idx]);
  renderBoard();
  showToast('Moved to ' + COLUMNS[colIdx + 1].label);
}

function moveCardBack(itemId) {
  if (isSprintReadOnly()) return;
  const items = getActiveItems();
  const idx = items.findIndex(i => i.id === itemId);
  if (idx === -1) return;
  const colIdx = COLUMNS.findIndex(c => c.id === items[idx].column);
  if (colIdx <= 0) return;

  items[idx].column = COLUMNS[colIdx - 1].id;
  items[idx].updatedAt = new Date().toISOString();
  saveSprints();
  syncStoryStatus(items[idx]);
  renderBoard();
  showToast('Moved to ' + COLUMNS[colIdx - 1].label);
}

// ─── Drag and Drop (Desktop) ───
function handleDragStart(e) {
  if (isSprintReadOnly()) { e.preventDefault(); return; }
  const card = e.currentTarget;
  draggedItemId = card.dataset.itemId;
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedItemId);
}

function handleDragEnd(e) {
  draggedItemId = null;
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-over');
  }
}

function handleDrop(e, targetColumn) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (isSprintReadOnly()) return;

  const itemId = e.dataTransfer.getData('text/plain') || draggedItemId;
  if (!itemId) return;

  const items = getActiveItems();
  const idx = items.findIndex(i => i.id === itemId);
  if (idx === -1) return;

  if (items[idx].column !== targetColumn) {
    items[idx].column = targetColumn;
    items[idx].updatedAt = new Date().toISOString();
    saveSprints();
    syncStoryStatus(items[idx]);
    renderBoard();
    showToast('Moved to ' + getColumnLabel(targetColumn));
  }

  draggedItemId = null;
}

function getColumnLabel(colId) {
  const col = COLUMNS.find(c => c.id === colId);
  return col ? col.label : colId;
}

// ─── Add Story Manually ───
function openAddStoryModal() {
  if (isSprintReadOnly()) { showToast('Cannot add stories to a completed sprint', 'error'); return; }
  document.getElementById('add-story-form').reset();
  document.getElementById('add-ac-list').innerHTML = '';
  addBoardAcRow('');
  openModal('add-story-modal');
  setTimeout(() => document.getElementById('add-role').focus(), 100);
}

function addBoardAcRow(value) {
  const list = document.getElementById('add-ac-list');
  const row = document.createElement('div');
  row.className = 'flex items-center gap-2';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Given / When / Then...';
  input.value = typeof value === 'string' ? value : '';
  input.className = 'flex-1 px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 add-ac-input';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0';
  removeBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
  removeBtn.setAttribute('aria-label', 'Remove criterion');
  removeBtn.onclick = () => {
    row.remove();
    if (list.querySelectorAll('.add-ac-input').length === 0) addBoardAcRow('');
  };

  row.appendChild(input);
  row.appendChild(removeBtn);
  list.appendChild(row);

  if (typeof value !== 'string' || value === '') {
    setTimeout(() => input.focus(), 50);
  }
}

function handleAddStory(event) {
  event.preventDefault();
  if (isSprintReadOnly()) return;

  const role = document.getElementById('add-role').value.trim();
  const action = document.getElementById('add-action').value.trim();
  const benefit = document.getElementById('add-benefit').value.trim();
  const storyPoints = parseInt(document.getElementById('add-points').value, 10);
  const priority = document.getElementById('add-priority').value;
  const column = document.getElementById('add-column').value;

  // Collect acceptance criteria
  const acInputs = document.querySelectorAll('#add-ac-list .add-ac-input');
  const acceptanceCriteria = [];
  acInputs.forEach(input => {
    const val = input.value.trim();
    if (val) acceptanceCriteria.push(val);
  });

  // Create story in User Story Forge so it stays in sync
  const storyId = uid();
  const stories = loadProjectData(STORY_SOURCE_KEY, []);
  const maxOrder = stories.reduce((max, s) => Math.max(max, s.order ?? 0), -1);
  stories.push({
    id: storyId,
    role,
    action,
    benefit,
    acceptanceCriteria,
    storyPoints,
    priority,
    status: COLUMN_TO_STORY_STATUS[column] || 'Backlog',
    createdAt: new Date().toISOString(),
    order: maxOrder + 1,
  });
  saveProjectData(STORY_SOURCE_KEY, stories);

  // Add to current sprint
  const item = {
    id: uid(),
    storyId,
    role,
    action,
    benefit,
    acceptanceCriteria,
    storyPoints,
    priority,
    column,
    assignee: '',
    aiSolution: null,
    comments: [],
    importedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  getActiveItems().push(item);
  saveSprints();
  closeModal('add-story-modal');
  renderBoard();
  showToast('Story added to ' + getColumnLabel(column));
}

// ─── AI Generate Story (Board) ───
function openAiBoardStoryInput() {
  if (isSprintReadOnly()) { showToast('Cannot add stories to a completed sprint', 'error'); return; }
  if (!ensureApiKey()) return;

  let modal = document.getElementById('ai-board-story-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ai-board-story-modal';
    modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md" onclick="event.stopPropagation()">
        <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Generate User Story</h2>
        </div>
        <div class="px-6 py-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Describe the feature</label>
            <textarea id="ai-board-story-prompt" rows="3" placeholder="e.g., Allow users to reset their password via email..."
              class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-y"></textarea>
          </div>
          <div class="flex justify-end gap-3">
            <button onclick="closeModal('ai-board-story-modal')" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button id="btn-ai-board-generate" onclick="handleAiBoardStoryGenerate()" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">${AI_ICON} Generate</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('ai-board-story-prompt').value = '';
  openModal('ai-board-story-modal');
  setTimeout(() => document.getElementById('ai-board-story-prompt').focus(), 100);
}

async function handleAiBoardStoryGenerate() {
  const prompt = document.getElementById('ai-board-story-prompt').value.trim();
  if (!prompt) {
    showToast('Describe the feature first', 'error');
    return;
  }

  const btn = document.getElementById('btn-ai-board-generate');
  setAiButtonLoading(btn, true);

  const projectCtx = getProjectContextForAI();

  try {
    const result = await callOpenRouterAPI([
      {
        role: 'system',
        content: projectCtx + '\n\nYou are a product management assistant. Generate a user story from a feature description. Return ONLY valid JSON with this exact structure: {"role": "string", "action": "string", "benefit": "string", "acceptanceCriteria": ["string"], "suggestedPoints": number, "priority": "Must Have|Should Have|Could Have|Won\'t Have"}. Do not wrap in markdown code blocks.'
      },
      {
        role: 'user',
        content: 'Generate a user story for this feature: ' + prompt
      }
    ]);

    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    closeModal('ai-board-story-modal');

    // Pre-fill the add story form
    openAddStoryModal();
    document.getElementById('add-role').value = parsed.role || '';
    document.getElementById('add-action').value = parsed.action || '';
    document.getElementById('add-benefit').value = parsed.benefit || '';
    document.getElementById('add-points').value = parsed.suggestedPoints || 3;
    document.getElementById('add-priority').value = parsed.priority || 'Could Have';

    // Fill acceptance criteria
    if (parsed.acceptanceCriteria && parsed.acceptanceCriteria.length > 0) {
      document.getElementById('add-ac-list').innerHTML = '';
      parsed.acceptanceCriteria.forEach(ac => addBoardAcRow(ac));
    }

    showToast('Story generated -- review and save');
  } catch (err) {
    showToast('AI error: ' + err.message, 'error');
  } finally {
    setAiButtonLoading(btn, false);
  }
}

// ─── Import Committed Stories from Capacity Planner ───
function openImportModal() {
  if (isSprintReadOnly()) { showToast('Cannot import into a completed sprint', 'error'); return; }

  // Reload sprints from storage to pick up planner changes
  const freshSprints = loadProjectData(BOARD_KEY, []);
  if (Array.isArray(freshSprints) && freshSprints.length > 0 && freshSprints[0].name) {
    sprints = freshSprints;
  }

  const sprint = getCurrentSprint();
  if (!sprint) { showToast('No active sprint selected', 'error'); return; }

  const plannerBacklog = sprint.plannerBacklog || [];
  const committedItems = plannerBacklog.filter(i => i.committed);

  if (committedItems.length === 0) {
    showToast('No committed stories -- groom and commit stories in Capacity Planner first', 'error');
    return;
  }

  // Which storyIds are already on the board
  const boardStoryIds = new Set(getActiveItems().map(i => i.storyId).filter(Boolean));
  // Also track planner item IDs already imported
  const boardPlannerIds = new Set(getActiveItems().map(i => i.plannerItemId).filter(Boolean));

  // Full story data from User Story Forge for rich card info
  const sourceStories = loadProjectData(STORY_SOURCE_KEY, []);
  const storyMap = new Map();
  sourceStories.forEach(s => storyMap.set(s.id, s));

  // Build epic grouping
  const epics = loadProjectData('traceability', []);
  const storyEpicMap = new Map();
  epics.forEach(epic => {
    (epic.linkedStories || []).forEach(storyId => {
      storyEpicMap.set(storyId, epic);
    });
  });

  // Group committed items by epic
  const epicStoryGroups = new Map();
  const unlinked = [];

  committedItems.forEach(item => {
    const epic = item.storyId ? storyEpicMap.get(item.storyId) : null;
    if (epic) {
      if (!epicStoryGroups.has(epic.id)) {
        epicStoryGroups.set(epic.id, { epic, items: [] });
      }
      epicStoryGroups.get(epic.id).items.push(item);
    } else {
      unlinked.push(item);
    }
  });

  const orderedGroups = [];
  epics.forEach(epic => {
    const group = epicStoryGroups.get(epic.id);
    if (group && group.items.length > 0) {
      orderedGroups.push(group);
    }
  });

  // Determine which items are already on board
  const alreadyOnBoard = (item) => {
    return boardPlannerIds.has(item.id) || (item.storyId && boardStoryIds.has(item.storyId));
  };

  // If no epics, render flat list
  if (orderedGroups.length === 0 && unlinked.length > 0) {
    document.getElementById('import-story-list').innerHTML = unlinked.map(item =>
      renderImportPlannerRow(item, storyMap.get(item.storyId), alreadyOnBoard(item))
    ).join('');
    openModal('import-modal');
    return;
  }

  let html = '';
  orderedGroups.forEach(group => {
    html += renderImportPlannerAccordion(group.epic, group.items, storyMap, alreadyOnBoard);
  });
  if (unlinked.length > 0) {
    html += renderImportPlannerAccordion(null, unlinked, storyMap, alreadyOnBoard);
  }

  document.getElementById('import-story-list').innerHTML = html;
  openModal('import-modal');
}

function renderImportPlannerAccordion(epic, groupItems, storyMap, alreadyOnBoard) {
  const key = epic ? epic.id : '_unlinked';
  const isOpen = importAccordionOpen.has(key);
  const count = groupItems.length;
  const totalPts = groupItems.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
  const alreadyCount = groupItems.filter(i => alreadyOnBoard(i)).length;

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
    headerContent = `
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <span class="text-sm font-semibold text-slate-500 dark:text-slate-400">Unlinked Stories</span>
      </div>`;
  }

  return `
    <div class="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 mb-2 overflow-hidden">
      <button onclick="toggleImportAccordion('${key}')" class="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <svg id="import-accordion-icon-${key}" class="w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform" style="${isOpen ? 'transform:rotate(180deg)' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        ${headerContent}
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">${count} stor${count === 1 ? 'y' : 'ies'}</span>
          <span class="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">${totalPts} pts</span>
          ${alreadyCount > 0 ? `<span class="text-[10px] text-slate-400 italic">${alreadyCount} on board</span>` : ''}
        </div>
      </button>
      <div id="import-accordion-body-${key}" class="${isOpen ? '' : 'hidden'} border-t border-slate-100 dark:border-slate-800">
        <div class="p-2 space-y-0.5">
          ${groupItems.map(item => renderImportPlannerRow(item, storyMap.get(item.storyId), alreadyOnBoard(item))).join('')}
        </div>
      </div>
    </div>`;
}

function renderImportPlannerRow(item, story, isOnBoard) {
  const checked = isOnBoard ? 'checked disabled' : '';
  const dimClass = isOnBoard ? 'opacity-50' : '';
  const title = item.title || (story ? ('As a ' + story.role + ', I want ' + story.action) : 'Untitled');
  const priority = story ? story.priority : 'Could Have';
  const colors = PRIORITY_COLORS[priority] || PRIORITY_COLORS['Could Have'];

  return `
    <label class="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${dimClass}">
      <input type="checkbox" value="${item.id}" data-story-id="${item.storyId || ''}" ${checked}
        class="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white focus:ring-slate-400">
      <div class="flex-1 min-w-0">
        <p class="text-sm text-slate-800 dark:text-slate-200 leading-snug">${escHtml(title)}</p>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-xs px-1.5 py-0.5 rounded ${colors.badge}">${escHtml(priority)}</span>
          <span class="text-xs text-slate-500">${item.storyPoints || 0} pts</span>
          <span class="text-xs text-slate-400">${item.estimatedHours || 0} hrs</span>
          ${isOnBoard ? '<span class="text-xs text-slate-400 italic ml-auto">Already on board</span>' : ''}
        </div>
      </div>
    </label>
  `;
}

function toggleImportAccordion(key) {
  if (importAccordionOpen.has(key)) {
    importAccordionOpen.delete(key);
  } else {
    importAccordionOpen.add(key);
  }
  const body = document.getElementById('import-accordion-body-' + key);
  const icon = document.getElementById('import-accordion-icon-' + key);
  if (body) body.classList.toggle('hidden');
  if (icon) icon.style.transform = importAccordionOpen.has(key) ? 'rotate(180deg)' : '';
}

function handleImport() {
  if (isSprintReadOnly()) return;
  const checkboxes = document.querySelectorAll('#import-story-list input[type="checkbox"]:checked:not(:disabled)');
  if (checkboxes.length === 0) {
    showToast('Select at least one story to import', 'error');
    return;
  }

  // Collect selected planner item IDs and their storyIds
  const selectedPlannerIds = new Set();
  const plannerToStoryMap = new Map();
  checkboxes.forEach(cb => {
    selectedPlannerIds.add(cb.value);
    if (cb.dataset.storyId) plannerToStoryMap.set(cb.value, cb.dataset.storyId);
  });

  // Load full story data for rich card info
  const sourceStories = loadProjectData(STORY_SOURCE_KEY, []);
  const storyLookup = new Map();
  sourceStories.forEach(s => storyLookup.set(s.id, s));

  // Get planner backlog items for the selected IDs
  const sprint = getCurrentSprint();
  const plannerBacklog = sprint ? (sprint.plannerBacklog || []) : [];

  const items = getActiveItems();
  let count = 0;

  plannerBacklog.forEach(plannerItem => {
    if (!selectedPlannerIds.has(plannerItem.id)) return;

    const story = plannerItem.storyId ? storyLookup.get(plannerItem.storyId) : null;

    items.push({
      id: uid(),
      storyId: plannerItem.storyId || null,
      plannerItemId: plannerItem.id,
      role: story ? (story.role || '') : '',
      action: story ? (story.action || '') : (plannerItem.title || ''),
      benefit: story ? (story.benefit || '') : '',
      acceptanceCriteria: story ? [...(story.acceptanceCriteria || [])] : [],
      storyPoints: plannerItem.storyPoints || (story ? story.storyPoints : 0) || 0,
      priority: story ? (story.priority || 'Could Have') : 'Could Have',
      column: 'backlog',
      assignee: '',
      aiSolution: null,
      comments: [],
      importedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    count++;
  });

  saveSprints();
  renderBoard();
  closeModal('import-modal');
  showToast(count + ' committed stor' + (count === 1 ? 'y' : 'ies') + ' imported to Backlog');
}

function toggleSelectAll(selectAll) {
  const checkboxes = document.querySelectorAll('#import-story-list input[type="checkbox"]:not(:disabled)');
  checkboxes.forEach(cb => cb.checked = selectAll);
}

// ─── Card Detail ───
function openDetail(itemId) {
  const items = getActiveItems();
  const item = items.find(i => i.id === itemId);
  if (!item) return;
  const readOnly = isSprintReadOnly();

  // Title & benefit
  document.getElementById('detail-title').textContent =
    'As a ' + item.role + ', I want ' + item.action;
  document.getElementById('detail-benefit').textContent =
    item.benefit ? 'So that ' + item.benefit : '';

  // Epic info
  const epic = item.storyId ? epicMap.get(item.storyId) : null;
  const epicSection = document.getElementById('detail-epic-section');
  if (epicSection) {
    if (epic) {
      document.getElementById('detail-epic-id').textContent = epic.id;
      epicSection.classList.remove('hidden');
    } else {
      epicSection.classList.add('hidden');
    }
  }

  // Acceptance criteria
  const acSection = document.getElementById('detail-ac-section');
  const acList = document.getElementById('detail-ac');
  if (item.acceptanceCriteria && item.acceptanceCriteria.length > 0) {
    acList.innerHTML = item.acceptanceCriteria.map(ac =>
      `<li class="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
        <svg class="w-4 h-4 mt-0.5 text-slate-400 dark:text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4"/></svg>
        <span>${escHtml(ac)}</span>
      </li>`
    ).join('');
    acSection.classList.remove('hidden');
  } else {
    acSection.classList.add('hidden');
  }

  // Right panel: badges
  const colors = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS['Could Have'];
  document.getElementById('detail-points').textContent = (item.storyPoints || 0) + ' pts';
  const prioEl = document.getElementById('detail-priority');
  prioEl.textContent = item.priority;
  prioEl.className = 'inline-block text-xs px-2.5 py-1 rounded-full font-semibold ' + colors.badge;

  // Right panel: controls
  const colSelect = document.getElementById('detail-column');
  const assigneeSelect = document.getElementById('detail-assignee');
  colSelect.value = item.column;

  // Populate assignee dropdown from capacity planner team
  const team = loadProjectData('sprint-team', []);
  let assigneeOpts = '<option value="">Unassigned</option>';
  const currentAssignee = item.assignee || '';
  let foundCurrent = false;
  team.forEach(m => {
    const selected = m.name === currentAssignee ? ' selected' : '';
    if (m.name === currentAssignee) foundCurrent = true;
    assigneeOpts += `<option value="${escHtml(m.name)}"${selected}>${escHtml(m.name)} (${escHtml(m.role || 'Other')})</option>`;
  });
  // If current assignee isn't in the team list, keep it as an option
  if (currentAssignee && !foundCurrent) {
    assigneeOpts += `<option value="${escHtml(currentAssignee)}" selected>${escHtml(currentAssignee)}</option>`;
  }
  assigneeSelect.innerHTML = assigneeOpts;

  // Read-only state for completed sprints
  colSelect.disabled = readOnly;
  assigneeSelect.disabled = readOnly;

  // AI Solve and Remove buttons
  const aiSolveBtn = document.getElementById('btn-ai-solve');
  const removeBtn = document.getElementById('btn-remove-from-board');
  if (aiSolveBtn) {
    if (readOnly) {
      aiSolveBtn.classList.add('opacity-50', 'pointer-events-none');
    } else {
      aiSolveBtn.classList.remove('opacity-50', 'pointer-events-none');
    }
  }
  if (removeBtn) {
    if (readOnly) {
      removeBtn.classList.add('opacity-50', 'pointer-events-none');
    } else {
      removeBtn.classList.remove('opacity-50', 'pointer-events-none');
    }
  }

  // Comment input -- allow comments even on completed sprints (for retrospective notes)
  document.getElementById('comment-input').value = '';

  // Render comments
  renderComments(item);

  // Store current item reference
  document.getElementById('detail-modal').dataset.itemId = itemId;
  openModal('detail-modal');
}

// ─── Comments ───
function renderComments(item) {
  const list = document.getElementById('comments-list');
  const comments = item.comments || [];

  if (comments.length === 0) {
    list.innerHTML = '<p class="text-xs text-slate-400 dark:text-slate-600 text-center py-4">No activity yet</p>';
    return;
  }

  // Show newest first
  list.innerHTML = [...comments].reverse().map(c => {
    const isAi = c.type === 'ai';
    const timeAgo = getTimeAgo(c.createdAt);

    const avatarHtml = isAi
      ? `<div class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
           <svg class="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
         </div>`
      : `<div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
           <svg class="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
         </div>`;

    const authorName = isAi ? 'AI Assistant' : 'You';
    const authorClass = isAi ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300';

    const contentHtml = isAi
      ? `<div class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">${formatAiSolution(c.text)}</div>`
      : `<p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">${escHtml(c.text)}</p>`;

    return `
      <div class="flex items-start gap-3">
        ${avatarHtml}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-semibold ${authorClass}">${authorName}</span>
            <span class="text-xs text-slate-400 dark:text-slate-600">${timeAgo}</span>
            ${isAi ? '<span class="text-xs px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium">AI</span>' : ''}
            <button onclick="deleteComment('${c.id}')" class="ml-auto p-0.5 rounded text-slate-300 dark:text-slate-700 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Delete">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 ${isAi ? 'border border-indigo-100 dark:border-indigo-900/30' : ''}">
            ${contentHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function addComment() {
  const input = document.getElementById('comment-input');
  const text = input.value.trim();
  if (!text) return;

  const itemId = document.getElementById('detail-modal').dataset.itemId;
  const items = getActiveItems();
  const idx = items.findIndex(i => i.id === itemId);
  if (idx === -1) return;

  if (!items[idx].comments) items[idx].comments = [];

  items[idx].comments.push({
    id: uid(),
    type: 'user',
    text: text,
    createdAt: new Date().toISOString(),
  });
  items[idx].updatedAt = new Date().toISOString();

  saveSprints();
  input.value = '';
  renderComments(items[idx]);
  showToast('Comment added');
}

function deleteComment(commentId) {
  const itemId = document.getElementById('detail-modal').dataset.itemId;
  const items = getActiveItems();
  const idx = items.findIndex(i => i.id === itemId);
  if (idx === -1) return;

  items[idx].comments = (items[idx].comments || []).filter(c => c.id !== commentId);
  items[idx].updatedAt = new Date().toISOString();
  saveSprints();
  renderComments(items[idx]);
}

function getTimeAgo(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
  return new Date(dateStr).toLocaleDateString();
}

function handleDetailColumnChange() {
  if (isSprintReadOnly()) return;
  const itemId = document.getElementById('detail-modal').dataset.itemId;
  const newColumn = document.getElementById('detail-column').value;
  const items = getActiveItems();
  const idx = items.findIndex(i => i.id === itemId);
  if (idx === -1) return;

  items[idx].column = newColumn;
  items[idx].updatedAt = new Date().toISOString();
  saveSprints();
  syncStoryStatus(items[idx]);
  renderBoard();
  showToast('Moved to ' + getColumnLabel(newColumn));
}

function handleAssigneeChange() {
  if (isSprintReadOnly()) return;
  const itemId = document.getElementById('detail-modal').dataset.itemId;
  const assignee = document.getElementById('detail-assignee').value.trim();
  const items = getActiveItems();
  const idx = items.findIndex(i => i.id === itemId);
  if (idx === -1) return;

  items[idx].assignee = assignee;
  items[idx].updatedAt = new Date().toISOString();
  saveSprints();
  renderBoard();
}

function removeFromBoard() {
  if (isSprintReadOnly()) return;
  if (!confirm('Remove this story from the sprint board?')) return;

  const itemId = document.getElementById('detail-modal').dataset.itemId;
  const sprint = getCurrentSprint();
  if (sprint) {
    sprint.items = sprint.items.filter(i => i.id !== itemId);
  }
  saveSprints();
  closeModal('detail-modal');
  renderBoard();
  showToast('Story removed from board');
}

// ─── Clear Board ───
function clearBoard() {
  if (isSprintReadOnly()) { showToast('Cannot clear a completed sprint', 'error'); return; }
  const items = getActiveItems();
  if (items.length === 0) {
    showToast('Board is already empty');
    return;
  }
  if (!confirm('Remove all ' + items.length + ' stories from the sprint board? This cannot be undone.')) return;

  const sprint = getCurrentSprint();
  if (sprint) sprint.items = [];
  saveSprints();
  renderBoard();
  showToast('Board cleared');
}

// ─── AI Solve ───
function openAiSolveModal() {
  if (!ensureApiKey()) return;

  const itemId = document.getElementById('detail-modal').dataset.itemId;
  const items = getActiveItems();
  const item = items.find(i => i.id === itemId);
  if (!item) return;

  // Build the context preview
  const acText = (item.acceptanceCriteria || [])
    .map((ac, i) => (i + 1) + '. ' + ac)
    .join('\n');

  // Look up epic for context preview
  let epicPreview = '';
  if (item.storyId) {
    const epics = loadProjectData('traceability', []);
    const epic = epics.find(e => (e.linkedStories || []).includes(item.storyId));
    if (epic) {
      epicPreview = '\n\nEpic: ' + epic.id + ' - ' + (epic.title || '');
      if (epic.description) epicPreview += '\n' + epic.description;
    }
  }

  const contextPreview =
    'As a ' + item.role + ', I want ' + item.action + ', so that ' + (item.benefit || '(not specified)') + '.\n\n' +
    'Story Points: ' + (item.storyPoints || 0) + '\n' +
    'Priority: ' + item.priority + '\n\n' +
    (acText ? 'Acceptance Criteria:\n' + acText : 'No acceptance criteria defined.') +
    epicPreview;

  // Build or reuse modal
  let modal = document.getElementById('ai-solve-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ai-solve-modal';
    modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[85vh] flex flex-col" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">AI Solve</h2>
          </div>
          <button onclick="closeModal('ai-solve-modal')" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Context being sent</label>
            <pre id="ai-solve-context" class="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto"></pre>
          </div>
          <div>
            <label for="ai-solve-extra" class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Additional instructions <span class="font-normal normal-case text-slate-400">(optional)</span></label>
            <textarea id="ai-solve-extra" rows="3" placeholder="e.g., Use React with TypeScript, focus on error handling, include unit test suggestions..."
              class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-y"></textarea>
          </div>
        </div>
        <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <button onclick="closeModal('ai-solve-modal')" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
          <button id="btn-ai-solve-submit" onclick="submitAiSolve()" class="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
            Generate Solution
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('ai-solve-context').textContent = contextPreview;
  document.getElementById('ai-solve-extra').value = '';
  openModal('ai-solve-modal');
  setTimeout(() => document.getElementById('ai-solve-extra').focus(), 100);
}

async function submitAiSolve() {
  const itemId = document.getElementById('detail-modal').dataset.itemId;
  const items = getActiveItems();
  const item = items.find(i => i.id === itemId);
  if (!item) return;

  const extraInstructions = document.getElementById('ai-solve-extra').value.trim();
  const btn = document.getElementById('btn-ai-solve-submit');
  setAiButtonLoading(btn, true);

  const projectCtx = getProjectContextForAI();

  try {
    const acText = (item.acceptanceCriteria || [])
      .map((ac, i) => (i + 1) + '. ' + ac)
      .join('\n');

    // Look up epic context for bigger-picture understanding
    let epicContext = '';
    if (item.storyId) {
      const epics = loadProjectData('traceability', []);
      const epic = epics.find(e => (e.linkedStories || []).includes(item.storyId));
      if (epic) {
        epicContext = '\n\nEpic Context (the bigger picture this story belongs to):\n' +
          'Epic: ' + epic.id + ' - ' + (epic.title || '') + '\n' +
          (epic.description ? 'Epic Description: ' + epic.description + '\n' : '') +
          (epic.goal ? 'Epic Goal: ' + epic.goal + '\n' : '');
        // Include sibling stories for architectural awareness
        const allStories = loadProjectData('user-stories', []);
        const siblings = (epic.linkedStories || [])
          .filter(sid => sid !== item.storyId)
          .map(sid => allStories.find(s => s.id === sid))
          .filter(Boolean)
          .slice(0, 5);
        if (siblings.length > 0) {
          epicContext += 'Other stories in this epic:\n' +
            siblings.map(s => '- As a ' + s.role + ', I want ' + s.action).join('\n') + '\n';
        }
      }
    }

    let userContent = 'Implement this user story:\n\n' +
      'As a ' + item.role + ', I want ' + item.action + ', so that ' + (item.benefit || '(not specified)') + '.\n\n' +
      'Story Points: ' + (item.storyPoints || 0) + '\n' +
      'Priority: ' + item.priority + '\n\n' +
      (acText ? 'Acceptance Criteria:\n' + acText : 'No acceptance criteria defined.') +
      epicContext;

    if (extraInstructions) {
      userContent += '\n\nAdditional instructions from the product owner:\n' + extraInstructions;
    }

    const result = await callOpenRouterAPI([
      {
        role: 'system',
        content: projectCtx + '\n\nYou are a senior software engineer helping a product team implement a user story. ' +
          'Given a user story with acceptance criteria, provide:\n\n' +
          '## Technical Breakdown\nKey components, services, and data models needed.\n\n' +
          '## Implementation Steps\nOrdered list of development tasks with clear deliverables.\n\n' +
          '## Code Suggestions\nPseudocode or code snippets for critical parts.\n\n' +
          '## Potential Challenges\nRisks, edge cases, and things to watch for.\n\n' +
          'Use markdown formatting with ## headers. Be specific and actionable, not theoretical.'
      },
      {
        role: 'user',
        content: userContent
      }
    ], null, 4096, 0.7);

    const idx = items.findIndex(i => i.id === itemId);
    if (idx !== -1) {
      items[idx].aiSolution = result;

      if (!items[idx].comments) items[idx].comments = [];
      items[idx].comments.push({
        id: uid(),
        type: 'ai',
        text: result,
        createdAt: new Date().toISOString(),
      });

      items[idx].updatedAt = new Date().toISOString();
      saveSprints();
      renderComments(items[idx]);
    }

    closeModal('ai-solve-modal');
    renderBoard();
    showToast('AI solution generated');
  } catch (err) {
    showToast('AI error: ' + err.message, 'error');
  } finally {
    setAiButtonLoading(btn, false);
  }
}

// ─── Markdown Formatter ───
function formatAiSolution(text) {
  let html = escHtml(text);

  // Code blocks first (before other transforms)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g,
    '<pre class="mt-2 mb-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap">$2</pre>');

  // Headers
  html = html.replace(/^### (.+)$/gm,
    '<h5 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-3 mb-1">$1</h5>');
  html = html.replace(/^## (.+)$/gm,
    '<h4 class="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mt-5 mb-2">$1</h4>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g,
    '<strong class="font-semibold text-slate-900 dark:text-slate-100">$1</strong>');

  // Inline code
  html = html.replace(/`([^`]+)`/g,
    '<code class="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200">$1</code>');

  // Numbered lists
  html = html.replace(/^(\d+)\. (.+)$/gm,
    '<div class="flex gap-2 ml-1 my-0.5"><span class="text-slate-400 shrink-0 text-xs w-4 text-right">$1.</span><span>$2</span></div>');

  // Bullet lists
  html = html.replace(/^[-*] (.+)$/gm,
    '<div class="flex gap-2 ml-1 my-0.5"><span class="text-slate-400 shrink-0">--</span><span>$1</span></div>');

  // Paragraphs
  html = html.replace(/\n\n/g, '<div class="h-3"></div>');
  html = html.replace(/\n/g, '<br>');

  return html;
}

// ─── Story Sync ───
// When a card moves columns, update the original story's status in User Story Forge
function syncStoryStatus(boardItem) {
  if (!boardItem.storyId) return;

  const newStatus = COLUMN_TO_STORY_STATUS[boardItem.column];
  if (!newStatus) return;

  const stories = loadProjectData(STORY_SOURCE_KEY, []);
  const idx = stories.findIndex(s => s.id === boardItem.storyId);
  if (idx === -1) return;

  if (stories[idx].status !== newStatus) {
    stories[idx].status = newStatus;
    saveProjectData(STORY_SOURCE_KEY, stories);
  }
}

// ─── Utilities ───
function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}