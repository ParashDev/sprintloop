/* ── User Story Forge ── */

const STORAGE_KEY = 'user-stories';

let stories = [];
let editingId = null;
let dragSourceId = null;
let storyEpicMap = {};
let openAccordions = new Set(); // tracks which epic groups are expanded

// ─── Initialization ───

document.addEventListener('DOMContentLoaded', () => {
  buildNav('user-stories.html');

  const headerContainer = document.getElementById('page-header');
  const header = buildPageHeader(
    'User Story Forge',
    'Write, organize, and export user stories with acceptance criteria and MoSCoW prioritization.',
    `<div>
      <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">What is a User Story?</h3>
      <p>A user story is a short, plain-language description of a feature written from the perspective of the person who will use it. It follows the format: <span class="font-medium text-slate-700 dark:text-slate-300">"As a [role], I want [action], so that [benefit]."</span> User stories are the fundamental building blocks of agile development -- they capture what needs to be built and why, without prescribing how.</p>
    </div>
    <div>
      <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">Why Use This Tool?</h3>
      <p>In real projects, user stories often end up scattered across emails, sticky notes, and documents with no consistent format. This tool enforces the standard user story structure, attaches acceptance criteria to every story, and applies MoSCoW prioritization (Must Have, Should Have, Could Have, Won't Have) so the team always knows what matters most. Stories created here flow directly into the Sprint Board for execution.</p>
    </div>
    <div>
      <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">When to Use It</h3>
      <ul class="list-disc list-inside space-y-1 ml-1">
        <li><span class="font-medium text-slate-700 dark:text-slate-300">Backlog grooming / refinement sessions</span> -- Write and refine stories before sprint planning</li>
        <li><span class="font-medium text-slate-700 dark:text-slate-300">Requirements gathering</span> -- Translate stakeholder needs into actionable stories</li>
        <li><span class="font-medium text-slate-700 dark:text-slate-300">Sprint preparation</span> -- Prioritize and estimate stories with story points before pulling them into a sprint</li>
        <li><span class="font-medium text-slate-700 dark:text-slate-300">Stakeholder communication</span> -- Export stories as CSV to share with non-technical stakeholders</li>
      </ul>
    </div>
    <div>
      <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">Key Concepts</h3>
      <ul class="list-disc list-inside space-y-1 ml-1">
        <li><span class="font-medium text-slate-700 dark:text-slate-300">Acceptance Criteria</span> -- Specific, testable conditions that must be true for a story to be considered complete. They remove ambiguity and set clear expectations for developers and testers.</li>
        <li><span class="font-medium text-slate-700 dark:text-slate-300">Story Points</span> -- A relative measure of effort and complexity (not hours). Common scales use Fibonacci numbers (1, 2, 3, 5, 8, 13). A "3" is roughly twice the effort of a "2."</li>
        <li><span class="font-medium text-slate-700 dark:text-slate-300">MoSCoW Prioritization</span> -- A method for ranking requirements: Must Have (critical), Should Have (important but not blocking), Could Have (nice to have), Won't Have (explicitly excluded from this iteration).</li>
      </ul>
    </div>`
  );
  headerContainer.appendChild(header);

  stories = migrateToolDataToProject(STORAGE_KEY, []);
  render();
  initAiStoryButton();
});

// ─── Render ───

function buildEpicMap() {
  storyEpicMap = {};
  const epics = loadProjectData('traceability', []);
  epics.forEach(epic => {
    (epic.linkedStories || []).forEach(storyId => {
      storyEpicMap[storyId] = { id: epic.id, title: epic.title };
    });
  });
}

function render() {
  buildEpicMap();
  populateEpicFilter();
  const list = document.getElementById('story-list');
  const empty = document.getElementById('empty-state');
  const filtered = getFilteredStories();

  if (stories.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="text-center py-12">
        <p class="text-sm text-slate-500 dark:text-slate-500">No stories match the current filters.</p>
      </div>
    `;
    return;
  }

  // Sort by order, then by createdAt as fallback
  const sorted = [...filtered].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Group stories by epic
  const allEpics = loadProjectData('traceability', []);
  const epicGroups = []; // { epic, stories[] }
  const epicStoryMap = new Map(); // epicId -> stories[]
  const unlinked = [];

  sorted.forEach(story => {
    const link = storyEpicMap[story.id];
    if (link) {
      if (!epicStoryMap.has(link.id)) epicStoryMap.set(link.id, []);
      epicStoryMap.get(link.id).push(story);
    } else {
      unlinked.push(story);
    }
  });

  // Build groups in epic order, only for epics that have filtered stories
  allEpics.forEach(epic => {
    const groupStories = epicStoryMap.get(epic.id);
    if (groupStories && groupStories.length > 0) {
      epicGroups.push({ epic, stories: groupStories });
    }
  });

  // If no epics exist or all stories are unlinked, render flat grid
  if (epicGroups.length === 0 && unlinked.length > 0) {
    list.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">' +
      sorted.map(story => buildStoryCard(story)).join('') +
      '</div>';
    return;
  }

  let html = '';

  epicGroups.forEach(group => {
    html += buildEpicAccordion(group.epic, group.stories);
  });

  if (unlinked.length > 0) {
    html += buildEpicAccordion(null, unlinked);
  }

  list.innerHTML = html;
}

function toggleAccordion(key) {
  if (openAccordions.has(key)) {
    openAccordions.delete(key);
  } else {
    openAccordions.add(key);
  }
  const body = document.getElementById('accordion-body-' + key);
  const icon = document.getElementById('accordion-icon-' + key);
  if (body) body.classList.toggle('hidden');
  if (icon) icon.style.transform = openAccordions.has(key) ? 'rotate(180deg)' : '';
}

function buildEpicAccordion(epic, groupStories) {
  const key = epic ? epic.id : '_unlinked';
  const isOpen = openAccordions.has(key);
  const count = groupStories.length;
  const totalPts = groupStories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);
  const doneCount = groupStories.filter(s => s.status === 'Done').length;

  const priorityColors = {
    High: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    Low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };

  let headerContent;
  if (epic) {
    const pClass = priorityColors[epic.priority] || priorityColors.Medium;
    headerContent = `
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <span class="text-xs font-mono text-slate-400 dark:text-slate-500 shrink-0">${escapeHtml(epic.id)}</span>
        <span class="text-sm font-semibold text-slate-900 dark:text-white truncate">${escapeHtml(epic.title || 'Untitled')}</span>
        <span class="inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${pClass} shrink-0">${escapeHtml(epic.priority || 'Medium')}</span>
      </div>`;
  } else {
    headerContent = `
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <span class="text-sm font-semibold text-slate-500 dark:text-slate-400">Unlinked Stories</span>
      </div>`;
  }

  const progressPct = count > 0 ? Math.round((doneCount / count) * 100) : 0;
  const progressColor = progressPct === 100 ? 'bg-emerald-500' : progressPct > 0 ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600';

  return `
    <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mb-3 overflow-hidden">
      <button onclick="toggleAccordion('${key}')" class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <svg id="accordion-icon-${key}" class="w-4 h-4 text-slate-400 shrink-0 transition-transform" style="${isOpen ? 'transform:rotate(180deg)' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        ${headerContent}
        <div class="flex items-center gap-3 shrink-0">
          <div class="hidden sm:flex items-center gap-1.5">
            <div class="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div class="${progressColor} h-full rounded-full" style="width:${progressPct}%"></div>
            </div>
            <span class="text-[10px] text-slate-400 dark:text-slate-500">${doneCount}/${count}</span>
          </div>
          <span class="text-xs text-slate-500 dark:text-slate-400 tabular-nums">${count} stor${count === 1 ? 'y' : 'ies'}</span>
          <span class="text-xs text-slate-400 dark:text-slate-500 tabular-nums">${totalPts} pts</span>
        </div>
      </button>
      <div id="accordion-body-${key}" class="${isOpen ? '' : 'hidden'} border-t border-slate-100 dark:border-slate-800">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
          ${groupStories.map(story => buildStoryCard(story)).join('')}
        </div>
      </div>
    </div>`;
}

function buildStoryCard(story) {
  const priorityClasses = {
    'Must Have': 'priority-must',
    'Should Have': 'priority-should',
    'Could Have': 'priority-could',
    "Won't Have": 'priority-wont',
  };

  const statusColors = {
    'Backlog': 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
    'To Do': 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    'In Progress': 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    'Review': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    'Done': 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  };

  const acItems = (story.acceptanceCriteria || [])
    .map(ac => `<li class="flex items-start gap-2"><svg class="w-4 h-4 mt-0.5 text-slate-700 dark:text-white shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4"/></svg><span>${escapeHtml(ac)}</span></li>`)
    .join('');

  const pClass = priorityClasses[story.priority] || 'priority-could';
  const sClass = statusColors[story.status] || statusColors['Backlog'];

  const acCount = (story.acceptanceCriteria || []).length;

  return `
    <div class="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-colors hover:border-slate-300 dark:hover:border-slate-700 flex flex-col cursor-pointer"
         onclick="viewStory('${story.id}')"
         draggable="true"
         data-story-id="${story.id}"
         ondragstart="handleDragStart(event)"
         ondragover="handleDragOver(event)"
         ondragenter="handleDragEnter(event)"
         ondragleave="handleDragLeave(event)"
         ondrop="handleDrop(event)"
         ondragend="handleDragEnd(event)">

      <!-- Header: Status + Actions -->
      <div class="flex items-center justify-between mb-3">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sClass}">${escapeHtml(story.status)}</span>
        <div class="flex items-center gap-1">
          <button onclick="event.stopPropagation(); editStory('${story.id}')" class="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Edit story">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button onclick="event.stopPropagation(); deleteStory('${story.id}')" class="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Delete story">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>

      <!-- Story sentence -->
      <div class="flex-1">
        <p class="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
          <span class="font-semibold text-slate-900 dark:text-white">As a</span> ${escapeHtml(story.role)},
          <span class="font-semibold text-slate-900 dark:text-white">I want to</span> ${escapeHtml(story.action)},
          <span class="font-semibold text-slate-900 dark:text-white">so that</span> ${escapeHtml(story.benefit)}.
        </p>
      </div>

      <!-- Acceptance Criteria (collapsed) -->
      ${acCount > 0 ? `
      <div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <p class="text-xs text-slate-400 dark:text-slate-500">${acCount} acceptance criteria</p>
      </div>` : ''}

      <!-- Footer: Badges -->
      <div class="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${pClass}">${escapeHtml(story.priority)}</span>
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">${story.storyPoints} pt${story.storyPoints === 1 ? '' : 's'}</span>
        ${storyEpicMap[story.id] ? `<a href="epics.html" onclick="event.stopPropagation()" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors" title="${escapeHtml(storyEpicMap[story.id].title)}"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>${escapeHtml(storyEpicMap[story.id].id)}</a>` : ''}
        <span class="ml-auto text-xs text-slate-400 dark:text-slate-600">${formatDate(story.createdAt)}</span>
      </div>
    </div>
  `;
}

// ─── View Story Modal ───

function viewStory(id) {
  const story = stories.find(s => s.id === id);
  if (!story) return;

  const priorityClasses = {
    'Must Have': 'priority-must',
    'Should Have': 'priority-should',
    'Could Have': 'priority-could',
    "Won't Have": 'priority-wont',
  };
  const statusColors = {
    'Backlog': 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
    'To Do': 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    'In Progress': 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    'Review': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    'Done': 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  };

  const pClass = priorityClasses[story.priority] || 'priority-could';
  const sClass = statusColors[story.status] || statusColors['Backlog'];
  const epicLink = storyEpicMap[story.id];
  const acList = (story.acceptanceCriteria || []);

  let modal = document.getElementById('view-story-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'view-story-modal';
  modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 items-center justify-center p-4';

  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[85vh] flex flex-col" onclick="event.stopPropagation()">

      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sClass}">${escapeHtml(story.status)}</span>
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${pClass}">${escapeHtml(story.priority)}</span>
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">${story.storyPoints} pt${story.storyPoints === 1 ? '' : 's'}</span>
        </div>
        <button onclick="closeModal('view-story-modal')" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">

        <!-- Story sentence -->
        <div>
          <p class="text-base text-slate-800 dark:text-slate-200 leading-relaxed">
            <span class="font-semibold text-slate-900 dark:text-white">As a</span> ${escapeHtml(story.role)},
            <span class="font-semibold text-slate-900 dark:text-white">I want to</span> ${escapeHtml(story.action)},
            <span class="font-semibold text-slate-900 dark:text-white">so that</span> ${escapeHtml(story.benefit)}.
          </p>
        </div>

        ${epicLink ? `
        <!-- Linked Epic -->
        <div>
          <h4 class="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Linked Epic</h4>
          <a href="epics.html" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
            <span class="font-mono text-xs">${escapeHtml(epicLink.id)}</span>
            <span>${escapeHtml(epicLink.title)}</span>
          </a>
        </div>` : ''}

        ${acList.length > 0 ? `
        <!-- Acceptance Criteria -->
        <div>
          <h4 class="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Acceptance Criteria</h4>
          <ul class="space-y-2">
            ${acList.map(ac => `
              <li class="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                <svg class="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4"/></svg>
                <span>${escapeHtml(ac)}</span>
              </li>`).join('')}
          </ul>
        </div>` : ''}

        <!-- Meta -->
        <div class="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
          ${story.createdAt ? '<span>Created ' + formatDate(story.createdAt) + '</span>' : ''}
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <button onclick="closeModal('view-story-modal'); deleteStory('${story.id}')" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          Delete
        </button>
        <button onclick="closeModal('view-story-modal'); editStory('${story.id}')" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 text-sm font-semibold transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          Edit
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  openModal('view-story-modal');
}

// ─── Filtering ───

function getFilteredStories() {
  const searchVal = (document.getElementById('search-input').value || '').toLowerCase().trim();
  const priorityVal = document.getElementById('filter-priority').value;
  const statusVal = document.getElementById('filter-status').value;
  const epicVal = document.getElementById('filter-epic')?.value || '';

  return stories.filter(s => {
    // Text search across role, action, and benefit
    if (searchVal) {
      const haystack = `${s.role} ${s.action} ${s.benefit}`.toLowerCase();
      if (!haystack.includes(searchVal)) return false;
    }
    if (priorityVal && s.priority !== priorityVal) return false;
    if (statusVal && s.status !== statusVal) return false;
    if (epicVal) {
      const link = storyEpicMap[s.id];
      if (epicVal === '_unlinked') {
        if (link) return false;
      } else {
        if (!link || link.id !== epicVal) return false;
      }
    }
    return true;
  });
}

function populateEpicFilter() {
  const sel = document.getElementById('filter-epic');
  if (!sel) return;
  const currentVal = sel.value;
  const epics = loadProjectData('traceability', []);

  // Keep the first two static options (Epic, Unlinked)
  while (sel.options.length > 2) sel.remove(2);

  epics.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = e.id + ' -- ' + (e.title || 'Untitled');
    sel.appendChild(opt);
  });

  // Restore selection if still valid
  if (currentVal) sel.value = currentVal;
}

function handleSearch() {
  render();
}

function handleFilter() {
  render();
}

// ─── Form Handling ───

function openStoryForm(storyToEdit) {
  editingId = storyToEdit ? storyToEdit.id : null;

  document.getElementById('modal-title').textContent = editingId ? 'Edit Story' : 'New Story';
  document.getElementById('story-id').value = editingId || '';
  document.getElementById('story-role').value = storyToEdit ? storyToEdit.role : '';
  document.getElementById('story-action').value = storyToEdit ? storyToEdit.action : '';
  document.getElementById('story-benefit').value = storyToEdit ? storyToEdit.benefit : '';
  document.getElementById('story-points').value = storyToEdit ? storyToEdit.storyPoints : '3';
  document.getElementById('story-priority').value = storyToEdit ? storyToEdit.priority : 'Could Have';
  document.getElementById('story-status').value = storyToEdit ? storyToEdit.status : 'Backlog';

  // Rebuild acceptance criteria list
  const acList = document.getElementById('ac-list');
  acList.innerHTML = '';

  if (storyToEdit && storyToEdit.acceptanceCriteria && storyToEdit.acceptanceCriteria.length > 0) {
    storyToEdit.acceptanceCriteria.forEach(ac => addAcceptanceCriterion(ac));
  } else {
    // Start with one empty criterion for new stories
    addAcceptanceCriterion('');
  }

  openModal('story-modal');

  // Focus the first field after a brief delay so the modal is visible
  setTimeout(() => document.getElementById('story-role').focus(), 100);
}

function addAcceptanceCriterion(value) {
  const acList = document.getElementById('ac-list');
  const row = document.createElement('div');
  row.className = 'flex items-center gap-2';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Given / When / Then...';
  input.value = typeof value === 'string' ? value : '';
  input.className = 'flex-1 px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 ac-input';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0';
  removeBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
  removeBtn.setAttribute('aria-label', 'Remove criterion');
  removeBtn.onclick = () => {
    row.remove();
    // Ensure at least one criterion row remains
    if (acList.querySelectorAll('.ac-input').length === 0) {
      addAcceptanceCriterion('');
    }
  };

  row.appendChild(input);
  row.appendChild(removeBtn);
  acList.appendChild(row);

  // Focus the new input if this was triggered by the add button (no value provided)
  if (typeof value !== 'string' || value === '') {
    setTimeout(() => input.focus(), 50);
  }
}

function handleSaveStory(event) {
  event.preventDefault();

  const role = document.getElementById('story-role').value.trim();
  const action = document.getElementById('story-action').value.trim();
  const benefit = document.getElementById('story-benefit').value.trim();
  const storyPoints = parseInt(document.getElementById('story-points').value, 10);
  const priority = document.getElementById('story-priority').value;
  const status = document.getElementById('story-status').value;

  // Collect non-empty acceptance criteria
  const acInputs = document.querySelectorAll('#ac-list .ac-input');
  const acceptanceCriteria = [];
  acInputs.forEach(input => {
    const val = input.value.trim();
    if (val) acceptanceCriteria.push(val);
  });

  if (editingId) {
    // Update existing story
    const idx = stories.findIndex(s => s.id === editingId);
    if (idx !== -1) {
      stories[idx] = {
        ...stories[idx],
        role,
        action,
        benefit,
        acceptanceCriteria,
        storyPoints,
        priority,
        status,
      };
    }
    showToast('Story updated', 'success');
  } else {
    // Create new story
    const maxOrder = stories.reduce((max, s) => Math.max(max, s.order ?? 0), -1);
    const story = {
      id: uid(),
      role,
      action,
      benefit,
      acceptanceCriteria,
      storyPoints,
      priority,
      status,
      createdAt: new Date().toISOString(),
      order: maxOrder + 1,
    };
    stories.push(story);
    showToast('Story created', 'success');
  }

  saveProjectData(STORAGE_KEY, stories);
  closeModal('story-modal');
  editingId = null;
  render();
}

// ─── CRUD ───

function editStory(id) {
  const story = stories.find(s => s.id === id);
  if (!story) return;
  openStoryForm(story);
}

function deleteStory(id) {
  if (!confirmAction('Delete this story? This cannot be undone.')) return;
  stories = stories.filter(s => s.id !== id);
  saveProjectData(STORAGE_KEY, stories);
  showToast('Story deleted', 'info');
  render();
}

// ─── Drag and Drop Reordering ───

function handleDragStart(event) {
  const card = event.target.closest('[data-story-id]');
  if (!card) return;
  dragSourceId = card.dataset.storyId;
  card.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
  // Required for Firefox
  event.dataTransfer.setData('text/plain', dragSourceId);
}

function handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(event) {
  event.preventDefault();
  const card = event.target.closest('[data-story-id]');
  if (card && card.dataset.storyId !== dragSourceId) {
    card.classList.add('drag-over');
  }
}

function handleDragLeave(event) {
  const card = event.target.closest('[data-story-id]');
  if (card) {
    card.classList.remove('drag-over');
  }
}

function handleDrop(event) {
  event.preventDefault();
  const targetCard = event.target.closest('[data-story-id]');
  if (!targetCard || !dragSourceId) return;

  const targetId = targetCard.dataset.storyId;
  if (targetId === dragSourceId) return;

  targetCard.classList.remove('drag-over');

  // Swap order values between source and target
  const sourceIdx = stories.findIndex(s => s.id === dragSourceId);
  const targetIdx = stories.findIndex(s => s.id === targetId);

  if (sourceIdx === -1 || targetIdx === -1) return;

  const sourceOrder = stories[sourceIdx].order ?? sourceIdx;
  const targetOrder = stories[targetIdx].order ?? targetIdx;
  stories[sourceIdx].order = targetOrder;
  stories[targetIdx].order = sourceOrder;

  saveProjectData(STORAGE_KEY, stories);
  render();
  showToast('Stories reordered', 'info');
}

function handleDragEnd(event) {
  dragSourceId = null;
  // Clean up any lingering drag classes
  document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

// ─── CSV Export ───

function handleExportCSV() {
  const filtered = getFilteredStories();
  if (filtered.length === 0) {
    showToast('No stories to export', 'error');
    return;
  }

  const headers = ['Summary', 'Description', 'Priority', 'Story Points', 'Status', 'Acceptance Criteria'];

  const rows = filtered.map(s => {
    const summary = `As a ${s.role}, I want ${s.action}, so that ${s.benefit}`;
    const description = summary;
    const ac = (s.acceptanceCriteria || []).join('; ');
    return [summary, description, s.priority, s.storyPoints, s.status, ac];
  });

  exportCSV('user-stories.csv', headers, rows);
}

// ─── AI: Generate Stories ───

function initAiStoryButton() {
  const container = document.getElementById('action-buttons');
  const newStoryBtn = document.getElementById('btn-new-story');
  if (!container || !newStoryBtn) return;

  const btn = document.createElement('button');
  btn.id = 'btn-ai-story';
  btn.className = 'flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm font-semibold whitespace-nowrap transition-colors';
  btn.innerHTML = AI_ICON + ' <span class="hidden sm:inline">Generate with </span>AI';
  btn.onclick = openAiStoryInput;
  newStoryBtn.after(btn);
}

function getEpicsForStoryAI() {
  return loadProjectData('traceability', []);
}

function formatEpicForAI(epic) {
  if (!epic) return '';
  let ctx = '';
  ctx += 'Epic: ' + (epic.title || 'Untitled') + '\n';
  ctx += 'ID: ' + epic.id + '\n';
  if (epic.description) ctx += 'Description: ' + epic.description + '\n';
  if (epic.priority) ctx += 'Priority: ' + epic.priority + '\n';
  if (epic.source) ctx += 'Source: ' + epic.source + '\n';
  if (epic.features && epic.features.length > 0) {
    ctx += '\nFeatures:\n';
    epic.features.forEach(f => { ctx += '- ' + f + '\n'; });
  }
  if (epic.testCases && epic.testCases.length > 0) {
    ctx += '\nTest Cases:\n';
    epic.testCases.forEach(tc => { ctx += '- ' + tc + '\n'; });
  }
  // Show which stories already exist for this epic
  const linkedStories = (epic.linkedStories || []).map(sid => stories.find(s => s.id === sid)).filter(Boolean);
  if (linkedStories.length > 0) {
    ctx += '\nExisting Linked Stories (do NOT duplicate):\n';
    linkedStories.forEach(s => { ctx += '- As a ' + s.role + ', I want ' + s.action + ', so that ' + s.benefit + '\n'; });
  }
  return ctx;
}

function onStoryModeChange() {
  const mode = document.querySelector('input[name="ai-story-mode"]:checked')?.value || 'full';
  const promptEl = document.getElementById('ai-story-prompt');
  const labelEl = document.getElementById('ai-story-prompt-label');
  if (!promptEl) return;

  if (mode === 'targeted') {
    promptEl.rows = 3;
    promptEl.placeholder = 'e.g., Add a story for password reset via email, or Create a story for admin bulk-delete...';
    if (labelEl) labelEl.textContent = 'Describe the story(ies) you need';
  } else {
    promptEl.rows = 2;
    promptEl.placeholder = 'e.g., Focus on authentication flows, or Generate stories for the admin panel only...';
    if (labelEl) labelEl.textContent = 'Additional focus or instructions (optional)';
  }
}

function onEpicSelectChange() {
  const sel = document.getElementById('ai-story-epic-select');
  const preview = document.getElementById('ai-story-epic-preview');
  const modeArea = document.getElementById('ai-story-mode-area');
  const promptEl = document.getElementById('ai-story-prompt');
  const labelEl = document.getElementById('ai-story-prompt-label');
  if (!sel || !preview) return;

  const epicId = sel.value;
  if (!epicId) {
    preview.classList.add('hidden');
    preview.innerHTML = '';
    if (modeArea) modeArea.classList.add('hidden');
    if (promptEl) {
      promptEl.placeholder = 'e.g., Allow users to reset their password via email...';
      promptEl.rows = 3;
    }
    if (labelEl) labelEl.textContent = 'Describe the feature';
    return;
  }

  const epics = getEpicsForStoryAI();
  const epic = epics.find(e => e.id === epicId);
  if (!epic) { preview.classList.add('hidden'); return; }

  const ls = (epic.linkedStories || []).length;

  // Show mode toggle when epic already has linked stories
  if (modeArea) {
    if (ls > 0) {
      modeArea.classList.remove('hidden');
      // Default to targeted when stories exist
      const targetedRadio = modeArea.querySelector('input[value="targeted"]');
      if (targetedRadio) targetedRadio.checked = true;
      onStoryModeChange();
    } else {
      modeArea.classList.add('hidden');
      if (promptEl) {
        promptEl.placeholder = 'e.g., Focus on authentication flows, or Generate stories for the admin panel only...';
        promptEl.rows = 2;
      }
      if (labelEl) labelEl.textContent = 'Additional focus or instructions (optional)';
    }
  }

  const fc = (epic.features || []).length;
  const tc = (epic.testCases || []).length;
  const priorityColors = {
    High: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    Low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };
  const pClass = priorityColors[epic.priority] || priorityColors.Medium;

  preview.innerHTML = `
    <div class="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4">
      <div class="flex items-center gap-2 flex-wrap mb-2">
        <span class="text-xs font-mono text-slate-400 dark:text-slate-500">${escapeHtml(epic.id)}</span>
        <span class="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold ${pClass}">${escapeHtml(epic.priority || 'Medium')}</span>
        ${epic.source ? '<span class="text-[10px] text-slate-400 dark:text-slate-500">Source: ' + escapeHtml(epic.source) + '</span>' : ''}
      </div>
      ${epic.description ? '<p class="text-xs text-slate-600 dark:text-slate-400 mb-3">' + escapeHtml(epic.description) + '</p>' : ''}
      <div class="flex items-center gap-4 text-[11px] text-slate-400 dark:text-slate-500 flex-wrap">
        ${fc > 0 ? '<span>' + fc + ' feature' + (fc > 1 ? 's' : '') + '</span>' : '<span class="text-slate-300 dark:text-slate-600">No features</span>'}
        ${tc > 0 ? '<span>' + tc + ' test case' + (tc > 1 ? 's' : '') + '</span>' : '<span class="text-slate-300 dark:text-slate-600">No test cases</span>'}
        ${ls > 0 ? '<span>' + ls + ' linked stor' + (ls > 1 ? 'ies' : 'y') + '</span>' : ''}
      </div>
      ${fc > 0 ? '<div class="mt-3 flex flex-wrap gap-1">' + epic.features.map(f => '<span class="inline-flex px-2 py-0.5 rounded-md text-[10px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">' + escapeHtml(f) + '</span>').join('') + '</div>' : ''}
    </div>`;
  preview.classList.remove('hidden');
}

function openAiStoryInput() {
  if (!ensureApiKey()) return;

  const epics = getEpicsForStoryAI();
  const hasEpics = epics.length > 0;

  // Recreate modal each time so epic list is fresh
  let modal = document.getElementById('ai-story-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'ai-story-modal';
  modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 items-center justify-center p-4';

  const epicOptions = epics.map(e => {
    const ls = (e.linkedStories || []).length;
    const label = escapeHtml(e.id + ' -- ' + (e.title || 'Untitled'));
    const suffix = ls > 0 ? ' (' + ls + ' stories)' : '';
    return '<option value="' + escapeHtml(e.id) + '">' + label + suffix + '</option>';
  }).join('');

  const noEpicsWarning = !hasEpics ? `
    <div class="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
      <p class="text-xs text-amber-700 dark:text-amber-400">No epics found. Create epics in Epic Tracker first for targeted story generation, or describe a feature manually below.</p>
    </div>` : '';

  const modeToggleHtml = hasEpics ? `
    <div id="ai-story-mode-area" class="hidden">
      <div class="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
        <label class="flex-1">
          <input type="radio" name="ai-story-mode" value="targeted" class="sr-only peer" checked onchange="onStoryModeChange()">
          <div class="px-3 py-1.5 rounded-md text-xs font-medium text-center cursor-pointer text-slate-500 dark:text-slate-400 peer-checked:bg-white dark:peer-checked:bg-slate-700 peer-checked:text-slate-900 dark:peer-checked:text-white peer-checked:shadow-sm transition-all">Add specific</div>
        </label>
        <label class="flex-1">
          <input type="radio" name="ai-story-mode" value="full" class="sr-only peer" onchange="onStoryModeChange()">
          <div class="px-3 py-1.5 rounded-md text-xs font-medium text-center cursor-pointer text-slate-500 dark:text-slate-400 peer-checked:bg-white dark:peer-checked:bg-slate-700 peer-checked:text-slate-900 dark:peer-checked:text-white peer-checked:shadow-sm transition-all">Full epic scan</div>
        </label>
      </div>
    </div>` : '';

  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[85vh] flex flex-col" onclick="event.stopPropagation()">
      <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white">AI Generate Stories</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${hasEpics ? 'Select an epic to generate targeted user stories' : 'Describe a feature to generate user stories'}</p>
      </div>
      <div class="flex-1 overflow-y-auto min-h-0">
        <div class="px-6 pt-4 space-y-3">
          ${noEpicsWarning}
          ${hasEpics ? `
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Select Epic</label>
            <select id="ai-story-epic-select" onchange="onEpicSelectChange()"
              class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400">
              <option value="">-- No epic (freeform) --</option>
              ${epicOptions}
            </select>
          </div>
          ${modeToggleHtml}
          <div id="ai-story-epic-preview" class="hidden"></div>` : ''}
        </div>
        <div class="px-6 py-4">
          <label id="ai-story-prompt-label" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">${hasEpics ? 'Additional focus or instructions (optional with epic)' : 'Describe the feature'}</label>
          <textarea id="ai-story-prompt" rows="${hasEpics ? 2 : 3}" placeholder="${hasEpics ? 'e.g., Focus on authentication flows, or Generate stories for the admin panel only...' : 'e.g., Allow users to reset their password via email...'}"
            class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-y"></textarea>
        </div>
      </div>
      <div class="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <span class="text-xs text-slate-400 dark:text-slate-500">Generates multiple stories</span>
        <div class="flex items-center gap-3">
          <button onclick="closeModal('ai-story-modal')" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
          <button id="btn-ai-story-generate" onclick="handleAiStoryGenerate()" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">${AI_ICON} Generate</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);
  openModal('ai-story-modal');
  setTimeout(() => {
    const sel = document.getElementById('ai-story-epic-select');
    if (sel) sel.focus();
    else document.getElementById('ai-story-prompt').focus();
  }, 100);
}

async function handleAiStoryGenerate() {
  const prompt = document.getElementById('ai-story-prompt').value.trim();
  const epicSelect = document.getElementById('ai-story-epic-select');
  const selectedEpicId = epicSelect ? epicSelect.value : '';
  const modeArea = document.getElementById('ai-story-mode-area');
  const modeVisible = modeArea && !modeArea.classList.contains('hidden');
  const modeEl = modeVisible ? document.querySelector('input[name="ai-story-mode"]:checked') : null;
  const isTargeted = modeEl ? modeEl.value === 'targeted' : false;

  let selectedEpic = null;
  if (selectedEpicId) {
    const epics = getEpicsForStoryAI();
    selectedEpic = epics.find(e => e.id === selectedEpicId) || null;
  }

  if (!selectedEpic && !prompt) {
    showToast('Select an epic or describe a feature', 'error');
    return;
  }

  if (isTargeted && !prompt) {
    showToast('Describe the story(ies) you want to add', 'error');
    return;
  }

  const btn = document.getElementById('btn-ai-story-generate');
  setAiButtonLoading(btn, true);

  try {
    const epicCtx = selectedEpic ? formatEpicForAI(selectedEpic) : '';

    // Gather existing stories to avoid duplicates
    const existingList = stories.length > 0
      ? '\n\nExisting Stories (do NOT duplicate these):\n' + stories.map(s => '- As a ' + s.role + ', I want ' + s.action + ', so that ' + s.benefit).join('\n')
      : '';

    let systemPrompt;

    if (isTargeted) {
      systemPrompt = `You are a senior product analyst. The user has existing stories for an epic and wants to add specific new story(ies).

Generate ONLY the story(ies) the user explicitly describes. Do NOT generate a full scan of the epic. Do NOT add stories the user did not ask for.

Use the epic context to write accurate, well-scoped stories that fit the epic, but only create what was requested.

Rules:
- Generate ONLY what the user requests -- if they ask for 1 story, return exactly 1
- Each story follows: "As a [role], I want [action], so that [benefit]"
- Each story should be independently deliverable in a single sprint
- Acceptance criteria: 2-4 testable conditions per story using Given/When/Then format
- Story points: use Fibonacci scale (1, 2, 3, 5, 8, 13) based on relative complexity
- Priority: Must Have for core functionality, Should Have for important features, Could Have for enhancements
- Do NOT duplicate existing stories listed below

Return ONLY a valid JSON array (no markdown, no code blocks):
[{"role":"string","action":"string","benefit":"string","acceptanceCriteria":["string"],"suggestedPoints":number,"priority":"Must Have|Should Have|Could Have|Won't Have"}]${existingList}`;
    } else {
      systemPrompt = `You are a senior product analyst who breaks down epics and features into well-structured user stories.

${selectedEpic ? 'Analyze the provided epic and generate user stories that fully cover its scope. Each story should map to a specific feature or capability described in the epic.' : 'Generate user stories from the provided feature description.'}

Rules:
- Each story follows: "As a [role], I want [action], so that [benefit]"
- Generate 3-8 stories depending on epic/feature complexity
- Each story should be independently deliverable in a single sprint
- Acceptance criteria: 2-4 testable conditions per story using Given/When/Then format
- Story points: use Fibonacci scale (1, 2, 3, 5, 8, 13) based on relative complexity
- Priority: Must Have for core functionality, Should Have for important features, Could Have for enhancements
- Stories should cover different user roles where applicable (end user, admin, system)
- Cover both happy path and error handling scenarios
- Do NOT duplicate existing stories listed below

Return ONLY a valid JSON array (no markdown, no code blocks):
[{"role":"string","action":"string","benefit":"string","acceptanceCriteria":["string"],"suggestedPoints":number,"priority":"Must Have|Should Have|Could Have|Won't Have"}]${existingList}`;
    }

    let userMessage;
    if (isTargeted) {
      userMessage = epicCtx + '\n\nCreate the following story(ies):\n' + prompt;
    } else if (selectedEpic && prompt) {
      // Additional instructions go into system prompt as top-priority override
      systemPrompt = '\n\nIMPORTANT -- The user has provided specific instructions. ' +
        'You MUST follow these instructions exactly, even if they contradict the default rules. ' +
        'These take top priority:\n' + prompt + '\n\n' + systemPrompt;
      userMessage = epicCtx;
    } else {
      userMessage = selectedEpic ? epicCtx : prompt;
    }

    const result = await callOpenRouterAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], null, 16000, 0.7);

    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) parsed = [parsed];
    if (parsed.length === 0) throw new Error('No stories generated');

    closeModal('ai-story-modal');
    showAiStoryReview(parsed, selectedEpicId);
  } catch (err) {
    showToast('AI error: ' + err.message, 'error');
  } finally {
    setAiButtonLoading(btn, false);
  }
}

// ─── AI: Review & Add Generated Stories ───

let pendingAiStories = [];
let pendingAiStoryEpicId = '';

function showAiStoryReview(generated, epicId) {
  pendingAiStories = generated;
  pendingAiStoryEpicId = epicId || '';

  let modal = document.getElementById('ai-story-review-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'ai-story-review-modal';
  modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 items-center justify-center p-4';

  const priorityColors = {
    'Must Have': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'Should Have': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    'Could Have': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    "Won't Have": 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  };

  const cards = generated.map((story, idx) => {
    const pClass = priorityColors[story.priority] || priorityColors['Could Have'];
    const ac = (story.acceptanceCriteria || []).length;
    const pts = story.suggestedPoints || 3;

    return `
      <label class="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900 transition-colors cursor-pointer">
        <input type="checkbox" value="${idx}" checked
          class="mt-1 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <span class="text-sm font-semibold text-slate-900 dark:text-white">As a ${escapeHtml(story.role || '...')}</span>
            <span class="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold ${pClass}">${escapeHtml(story.priority || 'Could Have')}</span>
            <span class="inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">${pts} pt${pts !== 1 ? 's' : ''}</span>
          </div>
          <p class="text-xs text-slate-700 dark:text-slate-300 mb-1">I want ${escapeHtml(story.action || '...')}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-2">so that ${escapeHtml(story.benefit || '...')}</p>
          ${ac > 0 ? '<div class="text-[11px] text-slate-400 dark:text-slate-500">' + ac + ' acceptance criteria</div>' : ''}
        </div>
      </label>`;
  }).join('');

  const epicLabel = pendingAiStoryEpicId
    ? '<span class="text-xs text-slate-400 dark:text-slate-500">Stories will be linked to ' + escapeHtml(pendingAiStoryEpicId) + '</span>'
    : '<span class="text-xs text-slate-400 dark:text-slate-500">Stories will not be linked to an epic</span>';

  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[85vh] flex flex-col" onclick="event.stopPropagation()">
      <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">Review Generated Stories</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${generated.length} stor${generated.length === 1 ? 'y' : 'ies'} generated -- select which to add</p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="toggleAiStoryReviewAll(true)" class="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline">All</button>
            <span class="text-slate-300 dark:text-slate-700">|</span>
            <button onclick="toggleAiStoryReviewAll(false)" class="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline">None</button>
          </div>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
        ${cards}
      </div>
      <div class="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
        ${epicLabel}
        <div class="flex items-center gap-3">
          <button onclick="closeModal('ai-story-review-modal')" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
          <button onclick="addSelectedAiStories()" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 text-sm font-semibold transition-colors">Add Selected</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);
  openModal('ai-story-review-modal');
}

function toggleAiStoryReviewAll(selectAll) {
  document.querySelectorAll('#ai-story-review-modal input[type="checkbox"]').forEach(cb => { cb.checked = selectAll; });
}

function addSelectedAiStories() {
  const checked = document.querySelectorAll('#ai-story-review-modal input[type="checkbox"]:checked');
  if (checked.length === 0) {
    showToast('Select at least one story', 'error');
    return;
  }

  const newStoryIds = [];
  let maxOrder = stories.reduce((max, s) => Math.max(max, s.order ?? 0), -1);
  let count = 0;

  checked.forEach(cb => {
    const idx = parseInt(cb.value, 10);
    const parsed = pendingAiStories[idx];
    if (!parsed) return;

    maxOrder++;
    const storyId = uid();
    stories.push({
      id: storyId,
      role: parsed.role || '',
      action: parsed.action || '',
      benefit: parsed.benefit || '',
      acceptanceCriteria: Array.isArray(parsed.acceptanceCriteria) ? parsed.acceptanceCriteria : [],
      storyPoints: parsed.suggestedPoints || 3,
      priority: parsed.priority || 'Could Have',
      status: 'Backlog',
      createdAt: new Date().toISOString(),
      order: maxOrder,
    });
    newStoryIds.push(storyId);
    count++;
  });

  saveProjectData(STORAGE_KEY, stories);

  // Link new stories to the epic if one was selected
  if (pendingAiStoryEpicId && newStoryIds.length > 0) {
    const allEpics = loadProjectData('traceability', []);
    const epicIdx = allEpics.findIndex(e => e.id === pendingAiStoryEpicId);
    if (epicIdx !== -1) {
      if (!Array.isArray(allEpics[epicIdx].linkedStories)) allEpics[epicIdx].linkedStories = [];
      newStoryIds.forEach(sid => {
        if (!allEpics[epicIdx].linkedStories.includes(sid)) {
          allEpics[epicIdx].linkedStories.push(sid);
        }
      });
      saveProjectData('traceability', allEpics);
    }
  }

  render();
  closeModal('ai-story-review-modal');
  pendingAiStories = [];
  const epicNote = pendingAiStoryEpicId ? ' and linked to ' + pendingAiStoryEpicId : '';
  pendingAiStoryEpicId = '';
  showToast(count + ' stor' + (count === 1 ? 'y' : 'ies') + ' added' + epicNote);
}

// ─── Utilities ───

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
