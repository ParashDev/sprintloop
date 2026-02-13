/* ── RACI Matrix Builder ── */

const STORAGE_KEY = 'raci-matrix';
const RACI_CYCLE = ['', 'R', 'A', 'C', 'I'];

let state = {
  tasks: [],
  stakeholders: [],
  assignments: {},
};

// ─── Initialization ───

function initRaci() {
  state = migrateToolDataToProject(STORAGE_KEY, {
    tasks: [],
    stakeholders: [],
    assignments: {},
  });
  // Guard against malformed stored data
  if (!Array.isArray(state.tasks)) state.tasks = [];
  if (!Array.isArray(state.stakeholders)) state.stakeholders = [];
  if (!state.assignments || typeof state.assignments !== 'object') state.assignments = {};
  render();
  initAiRaciButton();
  initImportFromSprintButton();
}

// ─── Persistence ───

function persist() {
  saveProjectData(STORAGE_KEY, state);
}

// ─── Data Operations ───

function addTask() {
  const id = uid();
  state.tasks.push({ id, name: 'New Task' });
  persist();
  render();
  // Focus the new task name for immediate editing
  setTimeout(() => {
    const el = document.querySelector(`[data-task-id="${id}"] .task-name`);
    if (el) startInlineEdit(el);
  }, 50);
}

function addStakeholder() {
  document.getElementById('person-modal-title').textContent = 'Add Person';
  document.getElementById('person-edit-id').value = '';
  document.getElementById('person-name').value = '';
  document.getElementById('person-role').value = 'Developer';
  openModal('person-modal');
  setTimeout(() => document.getElementById('person-name').focus(), 100);
}

function editStakeholder(id) {
  const sh = state.stakeholders.find(s => s.id === id);
  if (!sh) return;
  document.getElementById('person-modal-title').textContent = 'Edit Person';
  document.getElementById('person-edit-id').value = sh.id;
  document.getElementById('person-name').value = sh.name;
  document.getElementById('person-role').value = sh.role || 'Other';
  openModal('person-modal');
}

function handlePersonSubmit(e) {
  e.preventDefault();
  const editId = document.getElementById('person-edit-id').value;
  const name = document.getElementById('person-name').value.trim();
  const role = document.getElementById('person-role').value;
  if (!name) return;

  if (editId) {
    const sh = state.stakeholders.find(s => s.id === editId);
    if (sh) {
      sh.name = name;
      sh.role = role;
      showToast('Person updated');
    }
  } else {
    state.stakeholders.push({ id: uid(), name, role });
    showToast('Person added');
  }

  persist();
  render();
  closeModal('person-modal');
}

function removeTask(taskId) {
  if (!confirmAction('Remove this task and all its assignments?')) return;
  state.tasks = state.tasks.filter(t => t.id !== taskId);
  // Clean up assignments for this task
  const keysToRemove = Object.keys(state.assignments).filter(k => k.startsWith(taskId + '-'));
  keysToRemove.forEach(k => delete state.assignments[k]);
  persist();
  render();
  showToast('Task removed', 'info');
}

function removeStakeholder(stakeholderId) {
  if (!confirmAction('Remove this person and all their assignments?')) return;
  state.stakeholders = state.stakeholders.filter(s => s.id !== stakeholderId);
  // Clean up assignments for this stakeholder
  const keysToRemove = Object.keys(state.assignments).filter(k => k.endsWith('-' + stakeholderId));
  keysToRemove.forEach(k => delete state.assignments[k]);
  persist();
  render();
  showToast('Person removed', 'info');
}

function cycleCell(taskId, stakeholderId) {
  const key = taskId + '-' + stakeholderId;
  const current = state.assignments[key] || '';
  const idx = RACI_CYCLE.indexOf(current);
  const next = RACI_CYCLE[(idx + 1) % RACI_CYCLE.length];
  if (next === '') {
    delete state.assignments[key];
  } else {
    state.assignments[key] = next;
  }
  persist();
  render();
}

function updateTaskName(taskId, newName) {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    task.name = newName.trim() || 'Untitled Task';
    persist();
    render();
  }
}

function updateStakeholderName(stakeholderId, newName) {
  const sh = state.stakeholders.find(s => s.id === stakeholderId);
  if (sh) {
    sh.name = newName.trim() || 'Unnamed';
    persist();
    render();
  }
}

// ─── Inline Editing ───

function startInlineEdit(el) {
  if (el.querySelector('input')) return; // Already editing
  const currentText = el.textContent;
  const entityId = el.dataset.entityId;
  const entityType = el.dataset.entityType;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentText;
  input.className = 'w-full px-1 py-0.5 text-sm rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400';

  function commit() {
    const val = input.value.trim();
    if (entityType === 'task') {
      updateTaskName(entityId, val);
    } else {
      updateStakeholderName(entityId, val);
    }
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    }
    if (e.key === 'Escape') {
      // Restore original value and cancel
      input.value = currentText;
      input.blur();
    }
  });

  el.textContent = '';
  el.appendChild(input);
  input.focus();
  input.select();
}

// ─── Validation ───

function getValidationWarnings() {
  const warnings = [];

  state.tasks.forEach(task => {
    const taskAssignments = state.stakeholders.map(sh => state.assignments[task.id + '-' + sh.id] || '');
    const accountableCount = taskAssignments.filter(v => v === 'A').length;

    if (accountableCount === 0) {
      warnings.push({
        type: 'no-accountable',
        message: '"' + task.name + '" has no Accountable assigned',
      });
    }
    if (accountableCount > 1) {
      warnings.push({
        type: 'multiple-accountable',
        message: '"' + task.name + '" has multiple Accountables (' + accountableCount + ')',
      });
    }
  });

  state.stakeholders.forEach(sh => {
    const hasAny = state.tasks.some(task => {
      const val = state.assignments[task.id + '-' + sh.id];
      return val && val !== '';
    });
    if (!hasAny) {
      warnings.push({
        type: 'no-assignments',
        message: '"' + sh.name + '" has no assignments',
      });
    }
  });

  return warnings;
}

// ─── Stakeholder Summary ───

function getStakeholderSummary() {
  return state.stakeholders.map(sh => {
    const counts = { R: 0, A: 0, C: 0, I: 0 };
    state.tasks.forEach(task => {
      const val = state.assignments[task.id + '-' + sh.id];
      if (val && counts.hasOwnProperty(val)) {
        counts[val]++;
      }
    });
    return { name: sh.name, role: sh.role || '', ...counts, total: counts.R + counts.A + counts.C + counts.I };
  });
}

// ─── CSV Export ───

function handleExportCSV() {
  if (state.tasks.length === 0 || state.stakeholders.length === 0) {
    showToast('Add tasks and people before exporting', 'error');
    return;
  }
  const headers = ['Task', ...state.stakeholders.map(sh => sh.name)];
  const rows = state.tasks.map(task => {
    return [
      task.name,
      ...state.stakeholders.map(sh => state.assignments[task.id + '-' + sh.id] || ''),
    ];
  });
  exportCSV('raci-matrix.csv', headers, rows);
}

// ─── Rendering ───

function render() {
  const hasData = state.tasks.length > 0 || state.stakeholders.length > 0;
  const emptyEl = document.getElementById('empty-state');
  const actionBar = document.getElementById('action-bar');
  const gridSection = document.getElementById('raci-grid-section');
  const warningsSection = document.getElementById('validation-warnings');
  const summarySection = document.getElementById('stakeholder-summary');
  const statsEl = document.getElementById('raci-stats');
  const legendEl = document.getElementById('raci-legend');

  if (!hasData) {
    emptyEl.classList.remove('hidden');
    if (actionBar) actionBar.classList.add('hidden');
    if (gridSection) gridSection.classList.add('hidden');
    warningsSection.classList.add('hidden');
    summarySection.classList.add('hidden');
    if (statsEl) statsEl.classList.add('hidden');
    if (legendEl) legendEl.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  if (actionBar) actionBar.classList.remove('hidden');
  if (gridSection) gridSection.classList.remove('hidden');
  if (statsEl) statsEl.classList.remove('hidden');
  if (legendEl) legendEl.classList.remove('hidden');

  renderGrid();
  renderWarnings();
  renderSummary();
  renderStats();
}

function renderStats() {
  const totalAssignments = Object.keys(state.assignments).length;
  const totalCells = state.tasks.length * state.stakeholders.length;

  // Coverage: % of tasks that have at least one Accountable
  let tasksWithAccountable = 0;
  state.tasks.forEach(task => {
    const hasA = state.stakeholders.some(sh => state.assignments[task.id + '-' + sh.id] === 'A');
    if (hasA) tasksWithAccountable++;
  });
  const coverage = state.tasks.length > 0 ? Math.round((tasksWithAccountable / state.tasks.length) * 100) : 0;

  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el('stat-tasks', state.tasks.length);
  el('stat-stakeholders', state.stakeholders.length);
  el('stat-assignments', totalAssignments);
  el('stat-coverage', coverage + '%');

  const coverageLabel = document.getElementById('stat-coverage-label');
  if (coverageLabel) {
    if (coverage === 100) coverageLabel.textContent = 'All tasks covered';
    else if (coverage >= 75) coverageLabel.textContent = 'Nearly complete';
    else coverageLabel.textContent = 'Tasks with Accountable';
  }
}

function renderGrid() {
  const table = document.getElementById('raci-table');
  const cardsContainer = document.getElementById('raci-cards');

  // ── Desktop table ──
  let html = '';

  html += '<thead><tr>';
  html += '<th class="sticky left-0 z-10 bg-slate-50 dark:bg-slate-900 p-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-r border-slate-200 dark:border-slate-700 min-w-[180px]">Task / Person</th>';
  state.stakeholders.forEach(sh => {
    const roleLabel = sh.role || '';
    html += `<th data-stakeholder-id="${sh.id}" class="bg-slate-50 dark:bg-slate-900 px-2 py-3 text-center border-b border-slate-200 dark:border-slate-700 min-w-[120px]">
      <div class="flex flex-col items-center gap-0.5">
        <div class="flex items-center gap-1">
          <span class="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-slate-500 dark:hover:text-slate-300 transition-colors" onclick="editStakeholder('${sh.id}')">${escapeHtml(sh.name)}</span>
          <button onclick="removeStakeholder('${sh.id}')" class="p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0" title="Remove person" aria-label="Remove ${escapeHtml(sh.name)}">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        ${roleLabel ? `<span class="text-[10px] text-slate-400 dark:text-slate-500 font-normal">${escapeHtml(roleLabel)}</span>` : ''}
      </div>
    </th>`;
  });
  html += '</tr></thead>';

  html += '<tbody>';
  state.tasks.forEach((task, rowIdx) => {
    const rowBg = rowIdx % 2 === 0
      ? 'bg-white dark:bg-slate-950'
      : 'bg-slate-50/50 dark:bg-slate-900/50';
    html += `<tr class="${rowBg}">`;
    html += `<td data-task-id="${task.id}" class="sticky left-0 z-10 ${rowBg} p-2 border-r border-b border-slate-200 dark:border-slate-700">
      <div class="flex items-center gap-1.5">
        <span class="task-name flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer hover:text-slate-500 dark:hover:text-slate-300 transition-colors truncate" data-entity-id="${task.id}" data-entity-type="task" onclick="startInlineEdit(this)">${escapeHtml(task.name)}</span>
        <button onclick="removeTask('${task.id}')" class="p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0" title="Remove task" aria-label="Remove ${escapeHtml(task.name)}">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    </td>`;
    state.stakeholders.forEach(sh => {
      const key = task.id + '-' + sh.id;
      const val = state.assignments[key] || '';
      const cellClass = val ? 'raci-' + val : '';
      html += `<td class="p-1.5 border-b border-slate-200 dark:border-slate-700 text-center">
        <div class="raci-cell mx-auto ${cellClass}" onclick="cycleCell('${task.id}', '${sh.id}')" title="Click to cycle: R, A, C, I, empty" aria-label="${val || 'empty'} -- click to change">${val}</div>
      </td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';

  table.innerHTML = html;

  // ── Mobile cards ──
  if (!cardsContainer) return;

  if (state.tasks.length === 0 && state.stakeholders.length > 0) {
    cardsContainer.innerHTML = '<p class="text-sm text-slate-500 dark:text-slate-400 text-center py-8">Add tasks to start building your RACI matrix</p>';
    return;
  }

  cardsContainer.innerHTML = state.tasks.map(task => {
    let body = '';
    if (state.stakeholders.length === 0) {
      body = '<p class="text-xs text-slate-400 dark:text-slate-500 px-4 py-3">Add people to assign RACI roles</p>';
    } else {
      const rows = state.stakeholders.map(sh => {
        const key = task.id + '-' + sh.id;
        const val = state.assignments[key] || '';
        const badgeClass = val
          ? 'raci-' + val
          : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-2 border-dashed border-slate-200 dark:border-slate-700';
        const label = val || '-';
        return `<div class="flex items-center justify-between py-2.5">
          <div class="min-w-0 flex-1">
            <div class="text-sm text-slate-700 dark:text-slate-300">${escapeHtml(sh.name)}</div>
            ${sh.role ? `<div class="text-xs text-slate-400 dark:text-slate-500">${escapeHtml(sh.role)}</div>` : ''}
          </div>
          <div class="raci-cell shrink-0 ml-3 ${badgeClass}" onclick="cycleCell('${task.id}', '${sh.id}')" title="Tap to cycle">${label}</div>
        </div>`;
      }).join('');
      body = `<div class="px-4 divide-y divide-slate-100 dark:divide-slate-800/50">${rows}</div>`;
    }

    return `<div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div class="flex items-center gap-2 px-4 py-3 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
        <span class="task-name flex-1 text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer truncate" data-entity-id="${task.id}" data-entity-type="task" onclick="startInlineEdit(this)">${escapeHtml(task.name)}</span>
        <button onclick="removeTask('${task.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0" title="Remove task">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      ${body}
    </div>`;
  }).join('');
}

function renderWarnings() {
  const section = document.getElementById('validation-warnings');
  const list = document.getElementById('warnings-list');
  const warnings = getValidationWarnings();

  if (warnings.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  list.innerHTML = warnings.map(w => {
    const icon = w.type === 'no-assignments'
      ? '<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>'
      : '<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>';
    return `<div class="flex items-start sm:items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-amber-800 dark:text-amber-300 text-xs sm:text-sm">
      ${icon}
      <span>${escapeHtml(w.message)}</span>
    </div>`;
  }).join('');
}

function renderSummary() {
  const section = document.getElementById('stakeholder-summary');
  const table = document.getElementById('summary-table');
  const cardsContainer = document.getElementById('summary-cards');

  if (state.stakeholders.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  const summary = getStakeholderSummary();
  const maxTotal = Math.max(...summary.map(r => r.total), 1);

  // ── Desktop table ──
  let html = '<thead><tr>';
  html += '<th class="p-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">Person</th>';
  html += '<th class="p-3 text-center text-xs font-semibold border-b border-slate-200 dark:border-slate-700"><span class="inline-flex items-center justify-center w-6 h-6 rounded bg-[#3b82f6] text-white text-xs font-bold">R</span></th>';
  html += '<th class="p-3 text-center text-xs font-semibold border-b border-slate-200 dark:border-slate-700"><span class="inline-flex items-center justify-center w-6 h-6 rounded bg-[#ef4444] text-white text-xs font-bold">A</span></th>';
  html += '<th class="p-3 text-center text-xs font-semibold border-b border-slate-200 dark:border-slate-700"><span class="inline-flex items-center justify-center w-6 h-6 rounded bg-[#eab308] text-[#1a1a2e] text-xs font-bold">C</span></th>';
  html += '<th class="p-3 text-center text-xs font-semibold border-b border-slate-200 dark:border-slate-700"><span class="inline-flex items-center justify-center w-6 h-6 rounded bg-[#6b7280] text-white text-xs font-bold">I</span></th>';
  html += '<th class="p-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">Total</th>';
  html += '</tr></thead>';

  html += '<tbody>';
  summary.forEach((row, idx) => {
    const rowBg = idx % 2 === 0
      ? 'bg-white dark:bg-slate-950'
      : 'bg-slate-50/50 dark:bg-slate-900/50';
    const barPct = Math.round((row.total / maxTotal) * 100);
    html += `<tr class="${rowBg}">`;
    html += `<td class="p-3 border-b border-slate-200 dark:border-slate-700">
        <div class="text-sm font-medium text-slate-800 dark:text-slate-200">${escapeHtml(row.name)}</div>
        ${row.role ? `<div class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row.role)}</div>` : ''}
      </td>`;
    html += `<td class="p-3 text-center text-sm font-semibold border-b border-slate-200 dark:border-slate-700 ${row.R > 0 ? 'text-blue-500' : 'text-slate-400 dark:text-slate-600'}">${row.R}</td>`;
    html += `<td class="p-3 text-center text-sm font-semibold border-b border-slate-200 dark:border-slate-700 ${row.A > 0 ? 'text-red-500' : 'text-slate-400 dark:text-slate-600'}">${row.A}</td>`;
    html += `<td class="p-3 text-center text-sm font-semibold border-b border-slate-200 dark:border-slate-700 ${row.C > 0 ? 'text-yellow-500' : 'text-slate-400 dark:text-slate-600'}">${row.C}</td>`;
    html += `<td class="p-3 text-center text-sm font-semibold border-b border-slate-200 dark:border-slate-700 ${row.I > 0 ? 'text-gray-500' : 'text-slate-400 dark:text-slate-600'}">${row.I}</td>`;
    html += `<td class="p-3 border-b border-slate-200 dark:border-slate-700">
      <div class="flex items-center gap-2">
        <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden h-1.5">
          <div class="h-full rounded-full bg-slate-500 dark:bg-slate-400" style="width: ${barPct}%"></div>
        </div>
        <span class="text-sm font-bold text-slate-700 dark:text-slate-300 w-6 text-right">${row.total}</span>
      </div>
    </td>`;
    html += '</tr>';
  });
  html += '</tbody>';
  table.innerHTML = html;

  // ── Mobile cards ──
  if (!cardsContainer) return;

  cardsContainer.innerHTML = summary.map(row => {
    const barPct = Math.round((row.total / maxTotal) * 100);

    function badge(letter, count, bgActive, badgeText, countActive) {
      const active = count > 0;
      const bg = active ? bgActive : 'bg-slate-200 dark:bg-slate-700';
      const text = active ? badgeText : 'text-slate-400 dark:text-slate-500';
      const numColor = active ? countActive : 'text-slate-300 dark:text-slate-600';
      return `<span class="inline-flex items-center gap-1.5">
        <span class="w-6 h-6 rounded flex items-center justify-center ${bg} ${text} text-xs font-bold">${letter}</span>
        <span class="text-sm font-semibold ${numColor}">${count}</span>
      </span>`;
    }

    return `<div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">${escapeHtml(row.name)}</div>
          ${row.role ? `<div class="text-xs text-slate-500 dark:text-slate-400">${escapeHtml(row.role)}</div>` : ''}
        </div>
        <span class="text-lg font-bold text-slate-700 dark:text-slate-300 shrink-0 ml-3">${row.total}</span>
      </div>
      <div class="flex items-center gap-3 mb-3">
        ${badge('R', row.R, 'bg-[#3b82f6]', 'text-white', 'text-blue-600 dark:text-blue-400')}
        ${badge('A', row.A, 'bg-[#ef4444]', 'text-white', 'text-red-600 dark:text-red-400')}
        ${badge('C', row.C, 'bg-[#eab308]', 'text-[#1a1a2e]', 'text-yellow-600 dark:text-yellow-400')}
        ${badge('I', row.I, 'bg-[#6b7280]', 'text-white', 'text-slate-600 dark:text-slate-300')}
      </div>
      <div class="bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden h-1.5">
        <div class="h-full rounded-full bg-slate-500 dark:bg-slate-400 transition-all" style="width: ${barPct}%"></div>
      </div>
    </div>`;
  }).join('');
}

// ─── AI: Suggest Assignments ───

function initAiRaciButton() {
  const actionBar = document.getElementById('action-bar');
  if (!actionBar) return;

  const spacer = actionBar.querySelector('.flex-1');
  if (!spacer) return;

  const btn = document.createElement('button');
  btn.id = 'btn-ai-raci';
  btn.className = 'inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm font-medium transition-colors';
  btn.innerHTML = AI_ICON + ' <span class="hidden sm:inline">AI </span>Suggest';
  btn.onclick = handleAiRaciSuggest;
  spacer.before(btn);
}

async function handleAiRaciSuggest() {
  if (!ensureApiKey()) return;

  if (state.tasks.length === 0 || state.stakeholders.length === 0) {
    showToast('Add tasks and people first', 'error');
    return;
  }

  const btn = document.getElementById('btn-ai-raci');
  setAiButtonLoading(btn, true);

  try {
    const projectCtx = getProjectContextForAI();
    const taskNames = state.tasks.map(t => t.name);
    const peopleDescriptions = state.stakeholders.map(s => {
      const role = s.role ? ' (' + s.role + ')' : '';
      return s.name + role;
    });

    const result = await callOpenRouterAPI([
      {
        role: 'system',
        content: `You are a project management assistant. Read each task carefully and assign RACI roles based on what the task actually involves and each team member's role.

Role-to-RACI mapping:
- Developer: R on coding, implementation, feature-building tasks. C on testing tasks (they explain how it works). I on process/planning tasks.
- QA Engineer: R on testing, validation, quality assurance tasks. C on coding tasks (they verify testability). I on design/planning tasks.
- Designer: R on UI/UX, design, visual, and frontend layout tasks. C on frontend coding tasks. I on backend/infra tasks.
- DevOps: R on deployment, infrastructure, CI/CD, monitoring tasks. C on architecture decisions. I on feature tasks.
- Tech Lead: A on technical tasks (owns the outcome). C on most tasks (provides technical guidance). R on architecture/technical design tasks.
- Project Manager: A on process, delivery, and cross-team tasks. I on most technical tasks.
- Product Owner: A on feature and business-value tasks (owns the "what"). I on technical implementation details.
- Business Analyst: R on requirements, analysis, documentation tasks. C on feature tasks (clarifies requirements). I on purely technical tasks.
- Stakeholder: I on most tasks (notified of outcomes). Occasionally C when business input is needed.

RACI rules:
- R (Responsible): The person who DOES the work. Must match the task type to the person's role.
- A (Accountable): ONE per task. The person who OWNS the outcome and signs off. Usually PO, PM, or Tech Lead.
- C (Consulted): People whose input is needed BEFORE or DURING the work. Cross-functional roles that provide relevant expertise.
- I (Informed): People notified AFTER completion. Not directly involved but need to know.

CRITICAL rules:
- Analyze each task's content to determine what kind of work it is (coding, testing, design, deployment, etc.) then assign roles accordingly.
- Each task should have only ONE person as R. Do NOT assign R to multiple people on the same task. One person does the work, not two.
- When multiple people share the same role (e.g. 2 Developers), SPLIT tasks between them. Dev1 gets R on task 1, Dev2 gets R on task 2, Dev1 gets R on task 3, etc. Distribute evenly so workload is balanced. The other developer on that task can be C (consulted for code review) or left empty.
- If a person's role has NO relevance to ANY of the tasks, leave them completely empty. Do NOT force-assign roles just to fill cells. A Stakeholder with no business-relevant tasks can be empty. A Designer on a backend-only project can be empty.
- Only assign C or I when it genuinely makes sense for that role on that specific task.
- IMPORTANT: If sprint assignment data is provided below, the assigned person MUST be R for that task. Do not override sprint assignments. Build the rest of the RACI around those fixed R assignments.

Return ONLY valid JSON: {"assignments": {"T1-S1": "R", "T1-S2": "A"}}. Use T + task number and S + person number. Only include cells that have a value. Do not wrap in markdown code blocks.` + projectCtx
      },
      {
        role: 'user',
        content: (() => {
          let msg = 'Tasks:\n' + taskNames.map((t, i) => 'T' + (i + 1) + ': ' + t).join('\n') +
            '\n\nTeam Members:\n' + peopleDescriptions.map((s, i) => 'S' + (i + 1) + ': ' + s).join('\n');

          // Include sprint board assignments so AI respects them
          const { items: boardItems } = getActiveSprintItems();
          if (boardItems.length > 0) {
            const assignments = [];
            state.tasks.forEach((task, tIdx) => {
              const boardItem = boardItems.find(b => {
                const name = 'As a ' + b.role + ', I want ' + b.action;
                return name.toLowerCase() === task.name.toLowerCase();
              });
              if (boardItem && boardItem.assignee) {
                const sIdx = state.stakeholders.findIndex(s => s.name.toLowerCase() === boardItem.assignee.toLowerCase());
                if (sIdx !== -1) {
                  assignments.push('T' + (tIdx + 1) + ' is assigned to S' + (sIdx + 1) + ' (' + boardItem.assignee + ') on the Sprint Board -- must be R');
                }
              }
            });
            if (assignments.length > 0) {
              msg += '\n\nSprint Board Assignments (these people are already assigned and MUST be R):\n' + assignments.join('\n');
            }
          }

          return msg;
        })()
      }
    ]);

    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    applyAiRaciSuggestions(parsed.assignments || {});
  } catch (err) {
    showToast('AI error: ' + err.message, 'error');
  } finally {
    setAiButtonLoading(btn, false);
  }
}

function applyAiRaciSuggestions(suggestions) {
  const newAssignments = {};

  // Map T#-S# keys to actual task/stakeholder IDs
  for (const [key, val] of Object.entries(suggestions)) {
    if (!val || !['R', 'A', 'C', 'I'].includes(val.toUpperCase())) continue;

    const match = key.match(/T(\d+)\s*-\s*S(\d+)/i);
    if (!match) continue;

    const taskIdx = parseInt(match[1], 10) - 1;
    const shIdx = parseInt(match[2], 10) - 1;

    if (taskIdx < 0 || taskIdx >= state.tasks.length) continue;
    if (shIdx < 0 || shIdx >= state.stakeholders.length) continue;

    const taskId = state.tasks[taskIdx].id;
    const shId = state.stakeholders[shIdx].id;
    newAssignments[taskId + '-' + shId] = val.toUpperCase();
  }

  if (Object.keys(newAssignments).length === 0) {
    showToast('Could not map AI suggestions to your matrix', 'error');
    return;
  }

  const count = Object.keys(newAssignments).length;
  if (!confirmAction('Apply ' + count + ' AI-suggested assignments? This will overwrite existing assignments.')) {
    return;
  }

  state.assignments = newAssignments;
  persist();
  render();
  showToast(count + ' assignments applied');
}

// ─── Import from Sprint Board ───

function initImportFromSprintButton() {
  const actionBar = document.getElementById('action-bar');
  if (!actionBar) return;

  const spacer = actionBar.querySelector('.flex-1');
  if (!spacer) return;

  const btnSprint = document.createElement('button');
  btnSprint.id = 'btn-import-sprint-raci';
  btnSprint.className = 'inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors';
  btnSprint.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg> <span class="hidden sm:inline">Import from </span>Sprint';
  btnSprint.onclick = importFromSprintBoard;
  spacer.before(btnSprint);

  const btnMembers = document.createElement('button');
  btnMembers.id = 'btn-import-members-raci';
  btnMembers.className = 'inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors';
  btnMembers.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg> <span class="hidden sm:inline">Import </span>Members';
  btnMembers.onclick = importMembersFromCapacity;
  spacer.before(btnMembers);
}

function getActiveSprintItems() {
  const data = loadProjectData('sprint-board', []);
  // New sprint-scoped format: array of sprint objects
  if (Array.isArray(data) && data.length > 0 && data[0].name && data[0].items) {
    const active = data.find(s => s.status === 'active') || data[0];
    return { items: active.items || [], sprintName: active.name };
  }
  // Old flat format fallback
  if (Array.isArray(data)) {
    return { items: data, sprintName: 'Sprint' };
  }
  return { items: [], sprintName: 'Sprint' };
}

function importFromSprintBoard() {
  const { items: boardItems, sprintName } = getActiveSprintItems();
  if (boardItems.length === 0) {
    showToast('No stories on Sprint Board', 'error');
    return;
  }

  const existingNames = new Set(state.tasks.map(t => t.name.toLowerCase()));

  // Inject modal if first use
  if (!document.getElementById('raci-import-modal')) {
    const modal = document.createElement('div');
    modal.id = 'raci-import-modal';
    modal.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-black/50 backdrop-blur-sm';
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold text-slate-800 dark:text-slate-100">Import from Sprint Board</h3>
          <button onclick="closeRaciImportModal()" class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="p-4 border-b border-slate-200 dark:border-slate-700 flex gap-2">
          <button onclick="raciImportSelectAll(true)" class="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Select All</button>
          <button onclick="raciImportSelectAll(false)" class="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Deselect All</button>
        </div>
        <div id="raci-import-list" class="flex-1 overflow-y-auto p-4 space-y-2"></div>
        <div class="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button onclick="closeRaciImportModal()" class="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
          <button onclick="handleRaciImport()" class="px-4 py-2 text-sm rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300 font-medium transition-colors">Import Selected</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  // Populate the list
  const list = document.getElementById('raci-import-list');
  const columnLabels = { 'backlog': 'Backlog', 'todo': 'To Do', 'in-progress': 'In Progress', 'review': 'Review', 'done': 'Done' };
  const columnColors = {
    'backlog': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    'todo': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    'in-progress': 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    'review': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    'done': 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  };

  list.innerHTML = boardItems.map(item => {
    const name = 'As a ' + item.role + ', I want ' + item.action;
    const alreadyImported = existingNames.has(name.toLowerCase());
    const colLabel = columnLabels[item.column] || item.column;
    const colColor = columnColors[item.column] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';

    return `<label class="flex items-center gap-3 p-3 rounded-lg border ${alreadyImported ? 'border-slate-200 dark:border-slate-800 opacity-50' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'} cursor-pointer transition-colors">
      <input type="checkbox" value="${item.id}" ${alreadyImported ? 'disabled checked' : 'checked'} class="raci-import-cb rounded border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 focus:ring-slate-500">
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">${escapeHtml(name)}</div>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-xs px-1.5 py-0.5 rounded ${colColor}">${colLabel}</span>
          ${alreadyImported ? '<span class="text-xs text-slate-400 dark:text-slate-500">Already imported</span>' : ''}
        </div>
      </div>
    </label>`;
  }).join('');

  const modal = document.getElementById('raci-import-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('overflow-hidden');
}

function closeRaciImportModal() {
  const modal = document.getElementById('raci-import-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  document.body.classList.remove('overflow-hidden');
}

function raciImportSelectAll(checked) {
  document.querySelectorAll('.raci-import-cb:not(:disabled)').forEach(cb => { cb.checked = checked; });
}

function handleRaciImport() {
  const { items: boardItems } = getActiveSprintItems();
  const selected = Array.from(document.querySelectorAll('.raci-import-cb:checked:not(:disabled)')).map(cb => cb.value);

  if (selected.length === 0) {
    showToast('No stories selected', 'error');
    return;
  }

  let imported = 0;
  const existingNames = new Set(state.tasks.map(t => t.name.toLowerCase()));

  // Build a name-to-stakeholder lookup for auto-assigning R
  const stakeholderByName = new Map();
  state.stakeholders.forEach(sh => {
    stakeholderByName.set(sh.name.toLowerCase(), sh.id);
  });

  let autoAssigned = 0;

  selected.forEach(itemId => {
    const item = boardItems.find(b => b.id === itemId);
    if (!item) return;

    const name = 'As a ' + item.role + ', I want ' + item.action;
    if (existingNames.has(name.toLowerCase())) return;

    const taskId = uid();
    state.tasks.push({ id: taskId, name: name });
    existingNames.add(name.toLowerCase());
    imported++;

    // Auto-assign R if the sprint board story has an assignee that matches a stakeholder
    if (item.assignee) {
      const shId = stakeholderByName.get(item.assignee.toLowerCase());
      if (shId) {
        state.assignments[taskId + '-' + shId] = 'R';
        autoAssigned++;
      }
    }
  });

  closeRaciImportModal();

  if (imported === 0) {
    showToast('All selected stories already exist as tasks');
    return;
  }

  persist();
  render();
  const msg = imported + ' stor' + (imported === 1 ? 'y' : 'ies') + ' imported' +
    (autoAssigned > 0 ? ', ' + autoAssigned + ' auto-assigned as R' : '');
  showToast(msg);
}

// ─── Import Members from Capacity Planner ───

function importMembersFromCapacity() {
  const team = loadProjectData('sprint-team', []);
  if (team.length === 0) {
    showToast('No team members in Capacity Planner', 'error');
    return;
  }

  const existingNames = new Set(state.stakeholders.map(s => s.name.toLowerCase()));

  // Inject modal if first use
  if (!document.getElementById('raci-member-import-modal')) {
    const modal = document.createElement('div');
    modal.id = 'raci-member-import-modal';
    modal.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-black/50 backdrop-blur-sm';
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h3 class="text-lg font-semibold text-slate-800 dark:text-slate-100">Import Team Members</h3>
          <button onclick="closeMemberImportModal()" class="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="p-4 border-b border-slate-200 dark:border-slate-700 flex gap-2">
          <button onclick="memberImportSelectAll(true)" class="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Select All</button>
          <button onclick="memberImportSelectAll(false)" class="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Deselect All</button>
        </div>
        <div id="raci-member-import-list" class="flex-1 overflow-y-auto p-4 space-y-2"></div>
        <div class="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button onclick="closeMemberImportModal()" class="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
          <button onclick="handleMemberImport()" class="px-4 py-2 text-sm rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300 font-medium transition-colors">Import Selected</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  // Populate list
  const list = document.getElementById('raci-member-import-list');
  list.innerHTML = team.map(member => {
    const alreadyExists = existingNames.has(member.name.toLowerCase());
    return `<label class="flex items-center gap-3 p-3 rounded-lg border ${alreadyExists ? 'border-slate-200 dark:border-slate-800 opacity-50' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'} cursor-pointer transition-colors">
      <input type="checkbox" value="${member.id}" ${alreadyExists ? 'disabled checked' : 'checked'} class="member-import-cb rounded border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 focus:ring-slate-500">
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-slate-800 dark:text-slate-200">${escapeHtml(member.name)}</div>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">${escapeHtml(member.role || 'Other')}</span>
          ${alreadyExists ? '<span class="text-xs text-slate-400 dark:text-slate-500">Already added</span>' : ''}
        </div>
      </div>
    </label>`;
  }).join('');

  const modal = document.getElementById('raci-member-import-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('overflow-hidden');
}

function closeMemberImportModal() {
  const modal = document.getElementById('raci-member-import-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  document.body.classList.remove('overflow-hidden');
}

function memberImportSelectAll(checked) {
  document.querySelectorAll('.member-import-cb:not(:disabled)').forEach(cb => { cb.checked = checked; });
}

function handleMemberImport() {
  const team = loadProjectData('sprint-team', []);
  const selected = Array.from(document.querySelectorAll('.member-import-cb:checked:not(:disabled)')).map(cb => cb.value);

  if (selected.length === 0) {
    showToast('No members selected', 'error');
    return;
  }

  const existingNames = new Set(state.stakeholders.map(s => s.name.toLowerCase()));
  let imported = 0;

  selected.forEach(memberId => {
    const member = team.find(m => m.id === memberId);
    if (!member) return;
    if (existingNames.has(member.name.toLowerCase())) return;

    state.stakeholders.push({
      id: uid(),
      name: member.name,
      role: member.role || 'Other',
    });
    existingNames.add(member.name.toLowerCase());
    imported++;
  });

  closeMemberImportModal();

  if (imported === 0) {
    showToast('All selected members already exist');
    return;
  }

  // Auto-assign R based on sprint board assignments
  let autoAssigned = 0;
  const { items: boardItems } = getActiveSprintItems();
  if (boardItems.length > 0 && state.tasks.length > 0) {
    // Build name-to-stakeholder lookup (fresh, includes newly imported)
    const shByName = new Map();
    state.stakeholders.forEach(sh => shByName.set(sh.name.toLowerCase(), sh.id));

    state.tasks.forEach(task => {
      // Find matching board item by story name
      const boardItem = boardItems.find(b => {
        const name = 'As a ' + b.role + ', I want ' + b.action;
        return name.toLowerCase() === task.name.toLowerCase();
      });
      if (!boardItem || !boardItem.assignee) return;

      const shId = shByName.get(boardItem.assignee.toLowerCase());
      if (!shId) return;

      // Only assign if cell is empty
      const key = task.id + '-' + shId;
      if (!state.assignments[key]) {
        state.assignments[key] = 'R';
        autoAssigned++;
      }
    });
  }

  persist();
  render();
  const msg = imported + ' member' + (imported === 1 ? '' : 's') + ' imported' +
    (autoAssigned > 0 ? ', ' + autoAssigned + ' auto-assigned as R from sprint' : '');
  showToast(msg);
}

// ─── Utility ───

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
