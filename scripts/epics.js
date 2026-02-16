/* ── Epic Tracker Module ── */

const STORAGE_KEY = 'traceability';

// ─── State ───
let epics = [];
let sortField = 'id';
let sortDir = 'asc';

// ─── Initialization ───
document.addEventListener('DOMContentLoaded', () => {
  buildNav('epics.html');
  const header = document.getElementById('page-header');
  header.appendChild(
    buildPageHeader(
      'Epic Tracker',
      'Break down high-level goals into linked stories, features, and test cases.',
      `<div>
        <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">What is an Epic?</h3>
        <p>An epic is a high-level business goal that is too large for a single sprint. It groups multiple user stories under one objective. This tool tracks each epic and answers: <span class="font-medium text-slate-700 dark:text-slate-300">"For every epic we committed to, can we prove it was broken down into stories, implemented, and tested?"</span></p>
      </div>
      <div>
        <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">Why Use This Tool?</h3>
        <p>Without tracking, epics get lost. Features ship without tests. Bugs get fixed but nobody verifies the original goal still holds. This tool maps each epic to its linked user stories, feature implementations, and test cases, then tracks coverage percentage. Epics link directly to stories from User Story Forge so your high-level goals stay connected to the work that delivers them. The coverage dashboard shows gaps at a glance -- any epic without linked tests is a risk.</p>
      </div>
      <div>
        <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">When to Use It</h3>
        <ul class="list-disc list-inside space-y-1 ml-1">
          <li><span class="font-medium text-slate-700 dark:text-slate-300">Sprint planning</span> -- Break down epics into stories and verify every epic has linked stories before the sprint starts</li>
          <li><span class="font-medium text-slate-700 dark:text-slate-300">QA planning</span> -- Ensure every epic has at least one test case before testing begins</li>
          <li><span class="font-medium text-slate-700 dark:text-slate-300">Release readiness</span> -- Before shipping, verify 100% test coverage of committed epics</li>
          <li><span class="font-medium text-slate-700 dark:text-slate-300">Scope validation</span> -- Confirm that what was delivered matches what was requested -- no missing features, no undocumented additions</li>
        </ul>
      </div>
      <div>
        <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">Key Concepts</h3>
        <ul class="list-disc list-inside space-y-1 ml-1">
          <li><span class="font-medium text-slate-700 dark:text-slate-300">Epics</span> -- High-level business goals that group multiple user stories. Each epic can link to many stories from User Story Forge.</li>
          <li><span class="font-medium text-slate-700 dark:text-slate-300">Linked Stories</span> -- User stories from the Story Forge that belong to this epic. An epic with no linked stories is a gap in your plan.</li>
          <li><span class="font-medium text-slate-700 dark:text-slate-300">Coverage</span> -- The ratio of epics that have both features and test cases linked. 100% does not mean zero bugs, but it means every epic was deliberately verified.</li>
        </ul>
      </div>`
    )
  );

  epics = migrateToolDataToProject(STORAGE_KEY, []);
  migrateReqToEpic();
  render();
  initAiTraceButtons();
  initLinkStoriesButton();
});

// ─── Data Migration ───
function migrateReqToEpic() {
  let migrated = false;
  epics.forEach(e => {
    if (e.id && e.id.startsWith('REQ-')) {
      e.id = e.id.replace('REQ-', 'EPIC-');
      migrated = true;
    }
    if (!Array.isArray(e.linkedStories)) {
      e.linkedStories = [];
      if (e.source && e.source.startsWith('story:')) {
        e.linkedStories.push(e.source.replace('story:', ''));
      }
      migrated = true;
    }
  });
  if (migrated) persist();
}

// ─── ID Generation ───
function nextEpicId() {
  let max = 0;
  epics.forEach(e => {
    const match = e.id.match(/^EPIC-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  });
  const next = max + 1;
  return 'EPIC-' + String(next).padStart(3, '0');
}


function openEpicForm(editId) {
  const form = document.getElementById('epic-form');
  form.reset();

  // Clear row lists
  document.getElementById('features-list').innerHTML = '';
  document.getElementById('testcases-list').innerHTML = '';

  if (editId) {
    const epic = epics.find(e => e.id === editId);
    if (!epic) return;
    document.getElementById('modal-title').textContent = 'Edit Epic';
    document.getElementById('epic-edit-id').value = epic.id;
    document.getElementById('epic-display-id').textContent = epic.id;
    document.getElementById('epic-title').value = epic.title;
    document.getElementById('epic-description').value = epic.description || '';
    document.getElementById('epic-priority').value = epic.priority;
    document.getElementById('epic-status').value = epic.status;
    document.getElementById('epic-source').value = epic.source || '';

    // Populate feature rows
    if (epic.features && epic.features.length > 0) {
      epic.features.forEach(f => addFeatureRow(f));
    } else {
      addFeatureRow('');
    }

    // Populate test case rows
    if (epic.testCases && epic.testCases.length > 0) {
      epic.testCases.forEach(tc => addTestCaseRow(tc));
    } else {
      addTestCaseRow('');
    }

    populateLinkedStories(epic.linkedStories || []);
  } else {
    document.getElementById('modal-title').textContent = 'New Epic';
    document.getElementById('epic-edit-id').value = '';
    document.getElementById('epic-display-id').textContent = nextEpicId();
    addFeatureRow('');
    addTestCaseRow('');
    populateLinkedStories([]);
  }

  openModal('epic-modal');
}

// ─── Linked Stories Population ───
function populateLinkedStories(linkedIds) {
  const container = document.getElementById('linked-stories-list');
  const stories = loadProjectData('user-stories', []);

  if (stories.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400 dark:text-slate-500 p-2 text-center">No stories available. Create stories in User Story Forge first.</p>';
    return;
  }

  container.innerHTML = stories.map(story => {
    const checked = linkedIds.includes(story.id) ? 'checked' : '';
    const priorityColors = {
      'Must Have': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      'Should Have': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      'Could Have': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      "Won't Have": 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    };
    const pClass = priorityColors[story.priority] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

    return `
      <label class="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer">
        <input type="checkbox" name="linked-story" value="${story.id}" ${checked}
          class="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white focus:ring-slate-400">
        <div class="flex-1 min-w-0">
          <p class="text-xs text-slate-700 dark:text-slate-200 leading-snug">As a ${escapeHtml(story.role)}, I want ${escapeHtml(story.action)}</p>
          <div class="flex items-center gap-1.5 mt-1">
            <span class="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${pClass}">${escapeHtml(story.priority || 'None')}</span>
            <span class="text-[10px] text-slate-400">${story.storyPoints || 0} pts</span>
          </div>
        </div>
      </label>`;
  }).join('');
}

// ─── Row-based Input Helpers (Features & Test Cases) ───
function addFeatureRow(value) {
  const list = document.getElementById('features-list');
  _addItemRow(list, 'feature-input', 'e.g., SSO login page, password reset flow', value, 'features-list');
}

function addTestCaseRow(value) {
  const list = document.getElementById('testcases-list');
  _addItemRow(list, 'testcase-input', 'e.g., Verify login with valid credentials', value, 'testcases-list');
}

function _addItemRow(listEl, inputClass, placeholder, value, listId) {
  const row = document.createElement('div');
  row.className = 'flex items-center gap-2';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.value = typeof value === 'string' ? value : '';
  input.className = `flex-1 px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 ${inputClass}`;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0';
  removeBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
  removeBtn.onclick = () => {
    row.remove();
    if (listEl.querySelectorAll('.' + inputClass).length === 0) {
      if (inputClass === 'feature-input') addFeatureRow('');
      else addTestCaseRow('');
    }
  };

  row.appendChild(input);
  row.appendChild(removeBtn);
  listEl.appendChild(row);

  if (typeof value !== 'string' || value === '') {
    setTimeout(() => input.focus(), 50);
  }
}

// ─── Save Epic ───
function handleSaveEpic(e) {
  e.preventDefault();
  const editId = document.getElementById('epic-edit-id').value;
  const title = document.getElementById('epic-title').value.trim();
  const description = document.getElementById('epic-description').value.trim();
  const priority = document.getElementById('epic-priority').value;
  const status = document.getElementById('epic-status').value;
  const source = document.getElementById('epic-source').value.trim();

  // Collect features from row inputs
  const features = [];
  document.querySelectorAll('#features-list .feature-input').forEach(input => {
    const val = input.value.trim();
    if (val) features.push(val);
  });

  // Collect test cases from row inputs
  const testCases = [];
  document.querySelectorAll('#testcases-list .testcase-input').forEach(input => {
    const val = input.value.trim();
    if (val) testCases.push(val);
  });

  // Collect linked stories
  const linkedStories = [];
  document.querySelectorAll('#linked-stories-list input[name="linked-story"]:checked').forEach(cb => {
    linkedStories.push(cb.value);
  });

  if (editId) {
    const idx = epics.findIndex(e => e.id === editId);
    if (idx === -1) return;
    epics[idx] = {
      ...epics[idx],
      title,
      description,
      priority,
      status,
      source,
      features,
      testCases,
      linkedStories,
    };
    showToast('Epic updated');
  } else {
    const newEpic = {
      id: nextEpicId(),
      title,
      description,
      priority,
      status,
      source,
      features,
      testCases,
      linkedStories,
      createdAt: new Date().toISOString(),
    };
    epics.push(newEpic);
    showToast('Epic added');
  }

  persist();
  closeModal('epic-modal');
  render();
}

// ─── Delete Epic ───
function deleteEpic(id) {
  if (!confirmAction('Delete this epic? This cannot be undone.')) return;
  epics = epics.filter(e => e.id !== id);
  persist();
  render();
  showToast('Epic deleted');
}

// ─── Persistence ───
function persist() {
  saveProjectData(STORAGE_KEY, epics);
}

// ─── Filtering ───
function getFilteredEpics() {
  const statusVal = document.getElementById('filter-status').value;
  const priorityVal = document.getElementById('filter-priority').value;
  const coverageVal = document.getElementById('filter-coverage').value;

  return epics.filter(e => {
    if (statusVal && e.status !== statusVal) return false;
    if (priorityVal && e.priority !== priorityVal) return false;
    if (coverageVal) {
      const hasFeat = e.features && e.features.length > 0;
      const hasTest = e.testCases && e.testCases.length > 0;
      if (coverageVal === 'full' && !(hasFeat && hasTest)) return false;
      if (coverageVal === 'partial' && !((hasFeat || hasTest) && !(hasFeat && hasTest))) return false;
      if (coverageVal === 'none' && (hasFeat || hasTest)) return false;
    }
    return true;
  });
}

function handleFilter() {
  render();
}

function syncMobileFilter(type) {
  const mobileEl = document.getElementById('filter-' + type + '-mobile');
  const desktopEl = document.getElementById('filter-' + type);
  if (mobileEl && desktopEl) {
    desktopEl.value = mobileEl.value;
    handleFilter();
  }
}

// ─── Sorting ───
function handleSort(field) {
  if (sortField === field) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortField = field;
    sortDir = 'asc';
  }
  render();
}

function sortEpics(list) {
  const priorityOrder = { High: 0, Medium: 1, Low: 2 };
  const statusOrder = { 'Not Started': 0, 'In Progress': 1, 'Complete': 2, 'Blocked': 3 };

  return [...list].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'id') {
      const numA = parseInt(a.id.replace('EPIC-', ''), 10);
      const numB = parseInt(b.id.replace('EPIC-', ''), 10);
      cmp = numA - numB;
    } else if (sortField === 'title') {
      cmp = (a.title || '').localeCompare(b.title || '');
    } else if (sortField === 'priority') {
      cmp = (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99);
    } else if (sortField === 'status') {
      cmp = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });
}

function updateSortIcons() {
  ['id', 'title', 'priority', 'status'].forEach(field => {
    const icon = document.getElementById('sort-icon-' + field);
    if (!icon) return;
    if (field === sortField) {
      icon.textContent = sortDir === 'asc' ? '\u25B2' : '\u25BC';
    } else {
      icon.textContent = '';
    }
  });
}

// ─── Coverage Classification ───
function getCoverage(epic) {
  const hasFeat = epic.features && epic.features.length > 0;
  const hasTest = epic.testCases && epic.testCases.length > 0;
  if (hasFeat && hasTest) return 'full';
  if (hasFeat || hasTest) return 'partial';
  return 'none';
}

// ─── Stats Dashboard ───
function renderStats() {
  if (epics.length === 0) return;

  const total = epics.length;
  const noTests = epics.filter(e => !e.testCases || e.testCases.length === 0).length;
  const noFeatures = epics.filter(e => !e.features || e.features.length === 0).length;
  const blocked = epics.filter(e => e.status === 'Blocked').length;

  const el = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val;
  };

  el('stat-total', total);
  el('stat-no-tests', noTests);
  el('stat-no-features', noFeatures);
  el('stat-blocked', blocked);

  const blockedLabel = document.getElementById('stat-blocked-label');
  if (blockedLabel) {
    blockedLabel.textContent = blocked === 0 ? 'None blocked' : 'Epics blocked';
  }
}

// ─── Coverage Progress Bar ───
function renderCoverageBar() {
  if (epics.length === 0) return;

  const fullCoverage = epics.filter(e => {
    const hasFeat = e.features && e.features.length > 0;
    const hasTest = e.testCases && e.testCases.length > 0;
    return hasFeat && hasTest;
  }).length;

  const pct = Math.round((fullCoverage / epics.length) * 100);

  const bar = document.getElementById('coverage-bar');
  if (bar) {
    bar.style.width = pct + '%';
    if (pct >= 80) {
      bar.className = 'coverage-fill bg-emerald-500';
    } else if (pct >= 50) {
      bar.className = 'coverage-fill bg-amber-500';
    } else {
      bar.className = 'coverage-fill bg-red-500';
    }
  }

  const label = document.getElementById('coverage-pct-label');
  if (label) label.textContent = pct + '%';
}

// ─── Coverage Heatmap Rendering ───
function renderHeatmap() {
  const container = document.getElementById('coverage-heatmap');
  const emptyMsg = document.getElementById('heatmap-empty');

  if (epics.length === 0) {
    container.innerHTML = '';
    emptyMsg.classList.remove('hidden');
    return;
  }

  emptyMsg.classList.add('hidden');

  container.innerHTML = epics.map(epic => {
    const coverage = getCoverage(epic);
    let colorClasses = '';
    let tooltip = '';

    if (coverage === 'full') {
      colorClasses = 'bg-emerald-500 text-white';
      tooltip = 'Full coverage: features + test cases';
    } else if (coverage === 'partial') {
      colorClasses = 'bg-amber-500 text-white';
      const hasFeat = epic.features && epic.features.length > 0;
      tooltip = hasFeat ? 'Has features, missing test cases' : 'Has test cases, missing features';
    } else {
      colorClasses = 'bg-red-500 text-white';
      tooltip = 'No features or test cases linked';
    }

    return `<span class="inline-flex px-3 py-1.5 rounded-lg text-xs font-semibold ${colorClasses} cursor-default tooltip" data-tooltip="${escapeHtml(epic.title + ' -- ' + tooltip)}">${escapeHtml(epic.id)}</span>`;
  }).join('');
}

// ─── Epic Cards ───
function renderTable() {
  const cardsContainer = document.getElementById('epic-cards');
  const filtered = sortEpics(getFilteredEpics());

  // Update count badge
  const countBadge = document.getElementById('epic-count-badge');
  if (countBadge) countBadge.textContent = filtered.length;

  // Empty filter state
  if (filtered.length === 0 && epics.length > 0) {
    if (cardsContainer) cardsContainer.innerHTML = `<p class="col-span-full text-sm text-slate-500 dark:text-slate-500 text-center py-8">No epics match the current filters.</p>`;
    return;
  }

  if (!cardsContainer) return;

  cardsContainer.innerHTML = filtered.map(epic => {
    const priorityBadge = getPriorityBadge(epic.priority);
    const statusBadge = getStatusBadge(epic.status);
    const storyCount = (epic.linkedStories || []).length;
    const featureCount = (epic.features || []).length;
    const testCount = (epic.testCases || []).length;

    return `
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors" onclick="openEpicDetail('${epic.id}')">
        <div class="flex items-center gap-2 mb-2 flex-wrap">
          <span class="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">${escapeHtml(epic.id)}</span>
          ${priorityBadge}
          ${statusBadge}
          ${storyCount > 0 ? `<span class="text-xs text-slate-400 dark:text-slate-500">${storyCount} stories linked</span>` : ''}
        </div>
        <h3 class="text-sm font-semibold text-slate-900 dark:text-white mb-1">${escapeHtml(epic.title)}</h3>
        ${epic.description ? `<p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">${escapeHtml(epic.description)}</p>` : ''}
        ${epic.source ? `<p class="text-xs text-slate-400 dark:text-slate-500 mb-2">Source: ${escapeHtml(epic.source)}</p>` : ''}
        ${featureCount > 0 ? `<p class="text-xs text-slate-400 dark:text-slate-500 mb-1">${featureCount} features</p>` : ''}
        ${testCount > 0 ? `<p class="text-xs text-slate-400 dark:text-slate-500 mb-2">${testCount} test cases</p>` : ''}
        <div class="flex items-center gap-1 pt-2 border-t border-slate-100 dark:border-slate-800" onclick="event.stopPropagation()">
          <button data-ai-test-btn="${epic.id}" onclick="handleAiGenTestCases('${epic.id}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors" title="AI Generate Features & Tests">
            ${AI_ICON} AI Fill
          </button>
          <div class="flex-1"></div>
          <button onclick="openEpicForm('${epic.id}')" class="p-2 rounded-lg text-slate-400 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Edit">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button onclick="deleteEpic('${epic.id}')" class="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Delete">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

// ─── Detail Modal ───
function openEpicDetail(epicId) {
  const epic = epics.find(e => e.id === epicId);
  if (!epic) return;

  document.getElementById('detail-id').textContent = epic.id;
  document.getElementById('detail-priority').innerHTML = getPriorityBadge(epic.priority);
  document.getElementById('detail-status').innerHTML = getStatusBadge(epic.status);
  document.getElementById('detail-title').textContent = epic.title;
  document.getElementById('detail-description').textContent = epic.description || 'No description.';

  // Source
  const srcSection = document.getElementById('detail-source-section');
  if (epic.source) {
    srcSection.classList.remove('hidden');
    document.getElementById('detail-source').textContent = epic.source;
  } else {
    srcSection.classList.add('hidden');
  }

  // Linked Stories
  const storiesSection = document.getElementById('detail-stories-section');
  const storiesEl = document.getElementById('detail-stories');
  const linkedIds = epic.linkedStories || [];
  if (linkedIds.length > 0) {
    const allStories = loadProjectData('user-stories', []);
    storiesSection.classList.remove('hidden');
    storiesEl.innerHTML = linkedIds.map(sid => {
      const s = allStories.find(st => st.id === sid);
      if (!s) return `<p class="text-xs text-slate-400">${escapeHtml(sid)} (not found)</p>`;
      return `<div class="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
        <svg class="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
        <p class="text-xs text-slate-700 dark:text-slate-300 leading-snug">As a ${escapeHtml(s.role)}, I want ${escapeHtml(s.action)}</p>
      </div>`;
    }).join('');
  } else {
    storiesSection.classList.add('hidden');
  }

  // Features
  const featSection = document.getElementById('detail-features-section');
  const featEl = document.getElementById('detail-features');
  if (epic.features && epic.features.length > 0) {
    featSection.classList.remove('hidden');
    featEl.innerHTML = epic.features.map(f =>
      `<li class="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"><span class="text-slate-400 shrink-0">--</span>${escapeHtml(f)}</li>`
    ).join('');
  } else {
    featSection.classList.add('hidden');
  }

  // Test Cases
  const testSection = document.getElementById('detail-tests-section');
  const testEl = document.getElementById('detail-tests');
  if (epic.testCases && epic.testCases.length > 0) {
    testSection.classList.remove('hidden');
    testEl.innerHTML = epic.testCases.map(tc =>
      `<li class="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"><span class="text-slate-400 shrink-0">--</span>${escapeHtml(tc)}</li>`
    ).join('');
  } else {
    testSection.classList.add('hidden');
  }

  // Edit button
  document.getElementById('detail-edit-btn').onclick = () => {
    closeModal('epic-detail-modal');
    openEpicForm(epicId);
  };

  openModal('epic-detail-modal');
}

// ─── Badge Helpers ───
function getPriorityBadge(priority) {
  const styles = {
    High: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    Low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };
  return `<span class="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${styles[priority] || ''}">${escapeHtml(priority)}</span>`;
}

function getStatusBadge(status) {
  const styles = {
    'Not Started': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'Complete': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'Blocked': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };
  return `<span class="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${styles[status] || ''}">${escapeHtml(status)}</span>`;
}


// ─── CSV Export ───
function handleExportCSV() {
  if (epics.length === 0) {
    showToast('No epics to export', 'info');
    return;
  }

  const headers = ['ID', 'Title', 'Description', 'Priority', 'Source', 'Features', 'Test Cases', 'Linked Stories', 'Status', 'Created'];
  const rows = epics.map(e => [
    e.id,
    e.title,
    e.description || '',
    e.priority,
    e.source || '',
    (e.features || []).join('; '),
    (e.testCases || []).join('; '),
    (e.linkedStories || []).length + ' stories',
    e.status,
    e.createdAt ? formatDate(e.createdAt) : '',
  ]);

  exportCSV('epics.csv', headers, rows);
}

// ─── Visibility Toggles ───
function updateVisibility() {
  const hasEpics = epics.length > 0;
  const emptyState = document.getElementById('empty-state');
  const statsDashboard = document.getElementById('stats-dashboard');
  const coverageBarSection = document.getElementById('coverage-bar-section');
  const heatmapSection = document.getElementById('heatmap-section');
  const epicSection = document.getElementById('epics-section');

  if (hasEpics) {
    emptyState.classList.add('hidden');
    if (statsDashboard) statsDashboard.classList.remove('hidden');
    if (coverageBarSection) coverageBarSection.classList.remove('hidden');
    if (heatmapSection) heatmapSection.classList.remove('hidden');
    if (epicSection) epicSection.classList.remove('hidden');
  } else {
    emptyState.classList.remove('hidden');
    if (statsDashboard) statsDashboard.classList.add('hidden');
    if (coverageBarSection) coverageBarSection.classList.add('hidden');
    if (heatmapSection) heatmapSection.classList.add('hidden');
    if (epicSection) epicSection.classList.add('hidden');
  }
}

// ─── Link Stories (Create Epic from Stories) ───

function initLinkStoriesButton() {
  const addEpicBtn = document.getElementById('btn-add-epic');
  if (!addEpicBtn) return;

  const btn = document.createElement('button');
  btn.id = 'btn-link-stories';
  btn.className = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors';
  btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg> Link Stories';
  btn.onclick = openLinkStoriesModal;
  addEpicBtn.after(btn);
}

function openLinkStoriesModal() {
  const stories = loadProjectData('user-stories', []);
  if (stories.length === 0) {
    showToast('No stories found -- create stories in User Story Forge first', 'error');
    return;
  }

  let modal = document.getElementById('link-stories-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'link-stories-modal';
    modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Create Epic from Stories</h2>
          <button onclick="closeModal('link-stories-modal')" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          <div>
            <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Epic Title</label>
            <input type="text" id="link-epic-title" placeholder="e.g., User Authentication" required
              class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400">
          </div>
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Select Stories</label>
              <div class="flex items-center gap-2">
                <button onclick="toggleLinkStoryAll(true)" class="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline">All</button>
                <span class="text-slate-300 dark:text-slate-700">|</span>
                <button onclick="toggleLinkStoryAll(false)" class="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline">None</button>
              </div>
            </div>
            <div id="link-stories-checklist" class="space-y-1"></div>
          </div>
        </div>
        <div class="flex items-center justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <button onclick="closeModal('link-stories-modal')" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Cancel</button>
          <button onclick="handleLinkStoriesCreate()" class="px-4 py-2 rounded-lg bg-slate-800 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 text-sm font-semibold transition-colors">Create Epic</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('link-epic-title').value = '';
  const listEl = document.getElementById('link-stories-checklist');
  listEl.innerHTML = stories.map(story => {
    return `
      <label class="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
        <input type="checkbox" value="${story.id}"
          class="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white focus:ring-slate-400">
        <div class="flex-1 min-w-0">
          <p class="text-sm text-slate-800 dark:text-slate-200 leading-snug">
            As a ${escapeHtml(story.role)}, I want ${escapeHtml(story.action)}
          </p>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-xs text-slate-500">${story.storyPoints || 0} pts</span>
            <span class="text-xs text-slate-400">${escapeHtml(story.priority)}</span>
            <span class="text-xs text-slate-400">${escapeHtml(story.status || 'Backlog')}</span>
          </div>
        </div>
      </label>
    `;
  }).join('');

  openModal('link-stories-modal');
}

function toggleLinkStoryAll(selectAll) {
  document.querySelectorAll('#link-stories-checklist input[type="checkbox"]').forEach(cb => cb.checked = selectAll);
}

function handleLinkStoriesCreate() {
  const title = document.getElementById('link-epic-title').value.trim();
  if (!title) {
    showToast('Enter an epic title', 'error');
    return;
  }

  const checkboxes = document.querySelectorAll('#link-stories-checklist input[type="checkbox"]:checked');
  if (checkboxes.length === 0) {
    showToast('Select at least one story', 'error');
    return;
  }

  const stories = loadProjectData('user-stories', []);
  const selectedIds = [];
  checkboxes.forEach(cb => selectedIds.push(cb.value));

  // Build description from linked stories
  const linkedDescriptions = [];
  stories.forEach(s => {
    if (selectedIds.includes(s.id)) {
      linkedDescriptions.push('- As a ' + s.role + ', I want ' + s.action);
    }
  });

  epics.push({
    id: nextEpicId(),
    title: title,
    description: 'Linked stories:\n' + linkedDescriptions.join('\n'),
    priority: 'Medium',
    status: 'Not Started',
    source: 'Linked from User Stories',
    features: [],
    testCases: [],
    linkedStories: selectedIds,
    createdAt: new Date().toISOString(),
  });

  persist();
  render();
  closeModal('link-stories-modal');
  showToast(selectedIds.length + ' stor' + (selectedIds.length === 1 ? 'y' : 'ies') + ' linked to new epic');
}

// ─── AI: Generate Epic & Test Cases ───

function initAiTraceButtons() {
  const addEpicBtn = document.getElementById('btn-add-epic');
  if (!addEpicBtn) return;

  const btn = document.createElement('button');
  btn.id = 'btn-ai-gen-epic';
  btn.className = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm font-semibold transition-colors';
  btn.innerHTML = AI_ICON + ' AI Generate Epics';
  btn.onclick = openAiEpicInput;
  // Ensure AI button is after link button
  const linkBtn = document.getElementById('btn-link-stories');
  if (linkBtn) linkBtn.after(btn);
  else addEpicBtn.after(btn);
}

// ─── AI: Project Docs Extraction ───

function getProjectDocsForEpics() {
  try {
    const raw = localStorage.getItem('po-toolkit-business-docs');
    if (!raw) return null;
    const store = JSON.parse(raw);
    const project = store.projects?.find(p => p.id === store.activeProjectId);
    if (!project) return null;
    return {
      projectName: project.projectName || '',
      projectDescription: project.projectDescription || '',
      prd: project.prd?.sections?.length ? project.prd : null,
      brd: project.brd?.sections?.length ? project.brd : null,
    };
  } catch { return null; }
}

// Only pull sections that actually drive epic creation
const EPIC_RELEVANT_SECTIONS = [
  'product overview',
  'goals & objectives', 'goals and objectives',
  'functional requirements',
  'non-functional requirements',
  'business objectives',
  'business requirements',
];

function isEpicRelevantSection(title) {
  const lower = title.toLowerCase();
  return EPIC_RELEVANT_SECTIONS.some(s => lower.includes(s));
}

function formatDocsForAI(docs) {
  if (!docs) return '';
  let ctx = '';
  if (docs.projectName) ctx += 'Project: ' + docs.projectName + '\n';
  if (docs.projectDescription) ctx += 'Description: ' + docs.projectDescription + '\n';
  if (docs.prd) {
    const relevant = docs.prd.sections.filter(s => isEpicRelevantSection(s.title));
    if (relevant.length > 0) {
      ctx += '\n=== PRD (Product Requirements Document) ===\n';
      relevant.forEach(s => { ctx += '\n## ' + s.title + '\n' + s.content + '\n'; });
    }
  }
  if (docs.brd) {
    const relevant = docs.brd.sections.filter(s => isEpicRelevantSection(s.title));
    if (relevant.length > 0) {
      ctx += '\n=== BRD (Business Requirements Document) ===\n';
      relevant.forEach(s => { ctx += '\n## ' + s.title + '\n' + s.content + '\n'; });
    }
  }
  return ctx;
}

// ─── AI: Generate Epics Modal ───

function onEpicModeChange() {
  const mode = document.querySelector('input[name="ai-epic-mode"]:checked')?.value || 'full';
  const promptEl = document.getElementById('ai-epic-prompt');
  const labelEl = document.getElementById('ai-epic-prompt-label');
  const previewEl = document.getElementById('ai-epic-docs-preview');
  if (!promptEl) return;

  if (mode === 'targeted') {
    promptEl.rows = 3;
    promptEl.placeholder = 'e.g., Create an epic for the notification system, or Add an epic covering payment processing...';
    if (labelEl) labelEl.textContent = 'Describe the epic(s) you need';
    if (previewEl) previewEl.classList.add('hidden');
  } else {
    promptEl.rows = 2;
    promptEl.placeholder = 'e.g., Focus on security-related requirements, or Split frontend and backend concerns into separate epics...';
    if (labelEl) labelEl.textContent = 'Additional focus or instructions (optional)';
    if (previewEl) previewEl.classList.remove('hidden');
  }
}

function openAiEpicInput() {
  if (!ensureApiKey()) return;

  const docs = getProjectDocsForEpics();
  const hasPrd = !!(docs?.prd);
  const hasBrd = !!(docs?.brd);
  const hasDocs = hasPrd || hasBrd;
  const hasExisting = epics.length > 0;

  // Recreate modal each time so doc status is fresh
  let modal = document.getElementById('ai-epic-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'ai-epic-modal';
  modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 items-center justify-center p-4';

  const prdStatus = hasPrd
    ? '<span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span><span>PRD (' + docs.prd.sections.length + ' sections)</span>'
    : '<span class="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0"></span><span class="text-slate-400 dark:text-slate-500">PRD not generated</span>';
  const brdStatus = hasBrd
    ? '<span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span><span>BRD (' + docs.brd.sections.length + ' sections)</span>'
    : '<span class="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0"></span><span class="text-slate-400 dark:text-slate-500">BRD not generated</span>';

  // Build collapsible preview showing only sections the AI will receive
  let previewHtml = '';
  if (hasDocs) {
    const relevantSections = [];
    if (hasPrd) docs.prd.sections.filter(s => isEpicRelevantSection(s.title)).forEach(s => relevantSections.push({ doc: 'PRD', title: s.title, content: s.content }));
    if (hasBrd) docs.brd.sections.filter(s => isEpicRelevantSection(s.title)).forEach(s => relevantSections.push({ doc: 'BRD', title: s.title, content: s.content }));

    if (relevantSections.length > 0) {
      previewHtml = `
        <div id="ai-epic-docs-preview" class="border-t border-slate-100 dark:border-slate-800 mt-3 pt-1">
          <button onclick="document.getElementById('ai-epic-preview-body').classList.toggle('hidden'); this.querySelector('svg').style.transform = document.getElementById('ai-epic-preview-body').classList.contains('hidden') ? '' : 'rotate(180deg)'"
            class="w-full flex items-center justify-between py-2 text-left">
            <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Sections sent to AI (${relevantSections.length})</span>
            <svg class="w-3.5 h-3.5 text-slate-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div id="ai-epic-preview-body" class="hidden space-y-2 pb-2 max-h-[200px] overflow-y-auto">
            ${relevantSections.map(s => `
              <div class="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-[10px] font-medium uppercase tracking-wider ${s.doc === 'PRD' ? 'text-indigo-500' : 'text-violet-500'}">${s.doc}</span>
                  <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">${escapeHtml(s.title)}</span>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-3">${escapeHtml(s.content.substring(0, 300))}</p>
              </div>`).join('')}
          </div>
        </div>`;
    }
  }

  const noDocsWarning = !hasDocs ? `
    <div class="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
      <p class="text-xs text-amber-700 dark:text-amber-400">No PRD or BRD found for the active project. Generate documents in Business Docs first for the best results, or describe the requirements manually below.</p>
    </div>` : '';

  // Mode toggle only shown when epics already exist and docs are available
  const modeToggle = (hasExisting && hasDocs) ? `
    <div class="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
      <label class="flex-1">
        <input type="radio" name="ai-epic-mode" value="targeted" class="sr-only peer" checked onchange="onEpicModeChange()">
        <div class="px-3 py-1.5 rounded-md text-xs font-medium text-center cursor-pointer text-slate-500 dark:text-slate-400 peer-checked:bg-white dark:peer-checked:bg-slate-700 peer-checked:text-slate-900 dark:peer-checked:text-white peer-checked:shadow-sm transition-all">Add specific</div>
      </label>
      <label class="flex-1">
        <input type="radio" name="ai-epic-mode" value="full" class="sr-only peer" onchange="onEpicModeChange()">
        <div class="px-3 py-1.5 rounded-md text-xs font-medium text-center cursor-pointer text-slate-500 dark:text-slate-400 peer-checked:bg-white dark:peer-checked:bg-slate-700 peer-checked:text-slate-900 dark:peer-checked:text-white peer-checked:shadow-sm transition-all">Full doc scan</div>
      </label>
    </div>` : '';

  // Default mode: targeted if epics exist, full otherwise
  const defaultTargeted = hasExisting && hasDocs;
  const promptLabel = defaultTargeted ? 'Describe the epic(s) you need' : (hasDocs ? 'Additional focus or instructions (optional)' : 'Describe the requirements');
  const promptRows = defaultTargeted ? 3 : (hasDocs ? 2 : 4);
  const promptPlaceholder = defaultTargeted
    ? 'e.g., Create an epic for the notification system, or Add an epic covering payment processing...'
    : (hasDocs ? 'e.g., Focus on security-related requirements, or Split frontend and backend concerns into separate epics...' : 'e.g., We are building an e-commerce platform with user authentication, product catalog, shopping cart, checkout, and order management...');

  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[85vh] flex flex-col" onclick="event.stopPropagation()">
      <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white">AI Generate Epics</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${hasDocs ? 'Analyzes your PRD and BRD to create structured epics' : 'Describe requirements to generate structured epics'}</p>
      </div>
      <div class="flex-1 overflow-y-auto min-h-0">
        <div class="px-6 pt-4 space-y-3">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">${prdStatus}</div>
            <div class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">${brdStatus}</div>
          </div>
          ${modeToggle}
          ${noDocsWarning}
          ${defaultTargeted ? '' : previewHtml}
        </div>
        <div class="px-6 py-4">
          <label id="ai-epic-prompt-label" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">${promptLabel}</label>
          <textarea id="ai-epic-prompt" rows="${promptRows}" placeholder="${promptPlaceholder}"
            class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-y"></textarea>
          ${hasExisting ? '<p class="text-[11px] text-slate-400 dark:text-slate-500 mt-1">' + epics.length + ' existing epic' + (epics.length === 1 ? '' : 's') + ' will not be duplicated</p>' : ''}
        </div>
      </div>
      <div class="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <span class="text-xs text-slate-400 dark:text-slate-500">${defaultTargeted ? 'Generates only what you describe' : 'Generates multiple epics'}</span>
        <div class="flex items-center gap-3">
          <button onclick="closeModal('ai-epic-modal')" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
          <button id="btn-ai-epic-generate" onclick="handleAiEpicGenerate()" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">${AI_ICON} Generate</button>
        </div>
      </div>
    </div>`;

  // Insert preview HTML for non-default-targeted after mode toggle area
  if (defaultTargeted && previewHtml) {
    const docsArea = modal.querySelector('.space-y-3');
    if (docsArea) docsArea.insertAdjacentHTML('beforeend', previewHtml);
    // Start hidden in targeted mode
    const previewEl = modal.querySelector('#ai-epic-docs-preview');
    if (previewEl) previewEl.classList.add('hidden');
  }

  document.body.appendChild(modal);
  openModal('ai-epic-modal');
  setTimeout(() => document.getElementById('ai-epic-prompt').focus(), 100);
}

// ─── AI: Generate Epics Handler ───

async function handleAiEpicGenerate() {
  const prompt = document.getElementById('ai-epic-prompt').value.trim();
  const docs = getProjectDocsForEpics();
  const hasDocs = !!(docs?.prd || docs?.brd);
  const modeEl = document.querySelector('input[name="ai-epic-mode"]:checked');
  const isTargeted = modeEl ? modeEl.value === 'targeted' : false;

  if (!hasDocs && !prompt) {
    showToast('Add PRD/BRD in Business Docs or describe requirements', 'error');
    return;
  }

  if (isTargeted && !prompt) {
    showToast('Describe the epic(s) you want to add', 'error');
    return;
  }

  const btn = document.getElementById('btn-ai-epic-generate');
  setAiButtonLoading(btn, true);

  try {
    const docsCtx = hasDocs ? formatDocsForAI(docs) : '';
    const existingList = epics.length > 0
      ? '\n\nExisting Epics (do NOT duplicate these):\n' + epics.map(e => '- ' + e.title + (e.description ? ': ' + e.description.substring(0, 80) : '')).join('\n')
      : '';

    let systemPrompt;

    if (isTargeted) {
      systemPrompt = `You are a senior product analyst. The user has an existing set of epics and wants to add specific new epic(s).

Generate ONLY the epic(s) the user explicitly describes. Do NOT generate a comprehensive scan of the documents. Do NOT add epics the user did not ask for.

${hasDocs ? 'Use the provided PRD/BRD context to fill in accurate details (description, features, test cases) for the requested epic(s), but only create what was asked.' : ''}

Rules:
- Generate ONLY what the user requests -- if they ask for 1 epic, return exactly 1
- Each epic represents a distinct, high-level business capability or goal
- Priority: core/must-have = High, important = Medium, nice-to-have = Low
- Source: reference the document section the epic derives from if applicable
- Generate 2-5 features per epic (short names, under 6 words each)
- Generate 2-4 test cases per epic (short descriptions, under 12 words each)
- Description should state the business goal and scope clearly
- Do NOT duplicate existing epics listed below

Return ONLY a valid JSON array (no markdown, no code blocks):
[{"title":"string","description":"string","priority":"High|Medium|Low","source":"string","features":["string"],"testCases":["string"]}]${existingList}`;
    } else {
      systemPrompt = `You are a senior product analyst who breaks down product requirements into actionable epics.

Analyze the provided requirements documents (PRD and/or BRD) and generate a comprehensive set of epics that cover all major functional areas, non-functional requirements, and business objectives.

Rules:
- Each epic represents a distinct, high-level business capability or goal
- Functional Requirements: one epic per major feature area
- Non-Functional Requirements: group related NFRs (performance, security, accessibility) into dedicated epics
- Business Requirements: create epics for business-critical objectives that may span features
- Priority: core/must-have = High, important = Medium, nice-to-have = Low
- Source: reference the document section the epic derives from (e.g., "PRD: Functional Requirements", "BRD: Business Objectives")
- Generate 2-5 features per epic (short names, under 6 words each)
- Generate 2-4 test cases per epic (short descriptions, under 12 words each)
- Description should state the business goal and scope clearly
- Do NOT duplicate existing epics listed below

Return ONLY a valid JSON array (no markdown, no code blocks):
[{"title":"string","description":"string","priority":"High|Medium|Low","source":"string","features":["string"],"testCases":["string"]}]${existingList}`;
    }

    let userMessage;
    if (isTargeted) {
      userMessage = (hasDocs ? docsCtx + '\n\n' : '') + 'Create the following epic(s):\n' + prompt;
    } else if (hasDocs && prompt) {
      // Additional instructions go into system prompt as top-priority override
      systemPrompt = '\n\nIMPORTANT -- The user has provided specific instructions. ' +
        'You MUST follow these instructions exactly, even if they contradict the default rules. ' +
        'These take top priority:\n' + prompt + '\n\n' + systemPrompt;
      userMessage = docsCtx;
    } else {
      userMessage = hasDocs ? docsCtx : prompt;
    }

    const result = await callOpenRouterAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], null, 16000, 0.7);

    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) parsed = [parsed];
    if (parsed.length === 0) throw new Error('No epics generated');

    closeModal('ai-epic-modal');
    showAiEpicReview(parsed);
  } catch (err) {
    showToast('AI error: ' + err.message, 'error');
  } finally {
    setAiButtonLoading(btn, false);
  }
}

// ─── AI: Review & Add Generated Epics ───

let pendingAiEpics = [];

function showAiEpicReview(generated) {
  pendingAiEpics = generated;

  let modal = document.getElementById('ai-epic-review-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'ai-epic-review-modal';
  modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 items-center justify-center p-4';

  const priorityColors = {
    High: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    Low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  };

  const cards = generated.map((epic, idx) => {
    const pClass = priorityColors[epic.priority] || priorityColors.Medium;
    const fc = (epic.features || []).length;
    const tc = (epic.testCases || []).length;

    return `
      <label class="flex items-start gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900 transition-colors cursor-pointer">
        <input type="checkbox" value="${idx}" checked
          class="mt-1 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <span class="text-sm font-semibold text-slate-900 dark:text-white">${escapeHtml(epic.title || 'Untitled')}</span>
            <span class="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold ${pClass}">${escapeHtml(epic.priority || 'Medium')}</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-2">${escapeHtml(epic.description || '')}</p>
          <div class="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500 flex-wrap">
            ${epic.source ? '<span>Source: ' + escapeHtml(epic.source) + '</span>' : ''}
            ${fc > 0 ? '<span>' + fc + ' features</span>' : ''}
            ${tc > 0 ? '<span>' + tc + ' test cases</span>' : ''}
          </div>
          ${fc > 0 ? '<div class="mt-2 flex flex-wrap gap-1">' + (epic.features || []).map(f => '<span class="inline-flex px-2 py-0.5 rounded-md text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">' + escapeHtml(f) + '</span>').join('') + '</div>' : ''}
        </div>
      </label>`;
  }).join('');

  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[85vh] flex flex-col" onclick="event.stopPropagation()">
      <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">Review Generated Epics</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${generated.length} epic${generated.length === 1 ? '' : 's'} generated -- select which to add</p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="toggleAiEpicReviewAll(true)" class="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline">All</button>
            <span class="text-slate-300 dark:text-slate-700">|</span>
            <button onclick="toggleAiEpicReviewAll(false)" class="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline">None</button>
          </div>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
        ${cards}
      </div>
      <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <button onclick="closeModal('ai-epic-review-modal')" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
        <button onclick="addSelectedAiEpics()" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 text-sm font-semibold transition-colors">Add Selected</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
  openModal('ai-epic-review-modal');
}

function toggleAiEpicReviewAll(selectAll) {
  document.querySelectorAll('#ai-epic-review-modal input[type="checkbox"]').forEach(cb => { cb.checked = selectAll; });
}

function addSelectedAiEpics() {
  const checked = document.querySelectorAll('#ai-epic-review-modal input[type="checkbox"]:checked');
  if (checked.length === 0) {
    showToast('Select at least one epic', 'error');
    return;
  }

  let count = 0;
  checked.forEach(cb => {
    const idx = parseInt(cb.value, 10);
    const parsed = pendingAiEpics[idx];
    if (!parsed) return;

    epics.push({
      id: nextEpicId(),
      title: parsed.title || '',
      description: parsed.description || '',
      priority: parsed.priority || 'Medium',
      status: 'Not Started',
      source: parsed.source || 'AI Generated',
      features: Array.isArray(parsed.features) ? parsed.features : [],
      testCases: Array.isArray(parsed.testCases) ? parsed.testCases : [],
      linkedStories: [],
      createdAt: new Date().toISOString(),
    });
    count++;
  });

  persist();
  render();
  closeModal('ai-epic-review-modal');
  pendingAiEpics = [];
  showToast(count + ' epic' + (count === 1 ? '' : 's') + ' added');
}

async function handleAiGenTestCases(epicId) {
  if (!ensureApiKey()) return;

  const epic = epics.find(e => e.id === epicId);
  if (!epic) return;

  const btn = document.querySelector('[data-ai-test-btn="' + epicId + '"]');
  if (btn) setAiButtonLoading(btn, true);

  try {
    const projectCtx = getProjectContextForAI();
    const result = await callOpenRouterAPI([
      {
        role: 'system',
        content: `You are a software analyst. Given an epic, generate both feature names and test cases. Return ONLY valid JSON: {"features": ["short feature name"], "testCases": ["short test case description"]}. Keep each feature name under 6 words. Keep each test case under 10 words. Generate 2-4 features and 3-5 test cases. Do not wrap in markdown code blocks.${projectCtx ? '\n\nProject Context:\n' + projectCtx : ''}`
      },
      {
        role: 'user',
        content: 'Epic: ' + epic.title + '\nDescription: ' + (epic.description || 'No description provided')
      }
    ]);

    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const idx = epics.findIndex(e => e.id === epicId);
    if (idx !== -1) {
      let count = 0;

      if (Array.isArray(parsed.features)) {
        const existingFeats = epics[idx].features || [];
        parsed.features.forEach(f => {
          if (typeof f === 'string' && !existingFeats.includes(f)) { existingFeats.push(f); count++; }
        });
        epics[idx].features = existingFeats;
      }

      if (Array.isArray(parsed.testCases)) {
        const existingTests = epics[idx].testCases || [];
        parsed.testCases.forEach(tc => {
          if (typeof tc === 'string' && !existingTests.includes(tc)) { existingTests.push(tc); count++; }
        });
        epics[idx].testCases = existingTests;
      }

      persist();
      render();
      showToast(count + ' features & test cases generated');
    }
  } catch (err) {
    showToast('AI error: ' + err.message, 'error');
  } finally {
    if (btn) setAiButtonLoading(btn, false);
  }
}

// ─── HTML Escaping ───
function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ─── Master Render ───
function render() {
  renderStats();
  renderCoverageBar();
  renderHeatmap();
  renderTable();
  updateSortIcons();
  updateVisibility();
}
