/* ── Retro & Decision Log ── */

// ─── State ───
let sessions = [];
let currentSessionId = null;
let decisions = [];

// ─── Sprint Data Helpers ───

function loadSprints() {
  const data = loadProjectData('sprint-board', []);
  if (Array.isArray(data) && data.length > 0 && data[0].name && data[0].items) {
    return data;
  }
  // Old flat format fallback
  if (Array.isArray(data) && data.length > 0) {
    return [{ id: 'legacy', name: 'Sprint 1', status: 'active', items: data }];
  }
  return [];
}

function getSprintById(sprintId) {
  return loadSprints().find(s => s.id === sprintId) || null;
}

function getSessionSprintLabel(session) {
  if (session.sprintId) {
    const sprint = getSprintById(session.sprintId);
    if (sprint) return sprint.name + ' Retro - ' + formatDate(session.date);
  }
  return 'Retro - ' + formatDate(session.date);
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  buildNav('retro-log.html');
  document.getElementById('page-header').appendChild(
    buildPageHeader('Retro & Decision Log', 'Run retrospectives and maintain a searchable decision history.',
      `<div>
        <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">What is a Retrospective?</h3>
        <p>A retrospective (or "retro") is a structured team meeting held at the end of each sprint to reflect on <span class="font-medium text-slate-700 dark:text-slate-300">what went well, what did not go well, and what the team should do differently next time</span>. It is the primary mechanism for continuous improvement in agile teams. Without retros, teams repeat the same mistakes sprint after sprint.</p>
      </div>
      <div>
        <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">Why Use This Tool?</h3>
        <p>Most teams run retros but do not record the outcomes. Two sprints later, nobody remembers what was decided. This tool captures retro sessions with timestamped entries, categorizes them into "Went Well" and "Needs Improvement," and lets you add concrete action items. It also imports results from the Sprint Board -- done stories become "Went Well" items, and incomplete stories become "Needs Improvement" items, giving you a factual starting point for discussion.</p>
      </div>
      <div>
        <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">When to Use It</h3>
        <ul class="list-disc list-inside space-y-1 ml-1">
          <li><span class="font-medium text-slate-700 dark:text-slate-300">End of sprint</span> -- Run the retrospective while the sprint is still fresh in everyone's mind</li>
          <li><span class="font-medium text-slate-700 dark:text-slate-300">After a major incident</span> -- Conduct a blameless post-mortem to prevent recurrence</li>
          <li><span class="font-medium text-slate-700 dark:text-slate-300">Team health checks</span> -- Review past retro sessions to spot recurring themes (the same issue appearing 3 sprints in a row means the action item is not working)</li>
          <li><span class="font-medium text-slate-700 dark:text-slate-300">Onboarding context</span> -- New team members can read past retros to understand team dynamics and past decisions</li>
        </ul>
      </div>
      <div>
        <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">Key Concepts</h3>
        <ul class="list-disc list-inside space-y-1 ml-1">
          <li><span class="font-medium text-slate-700 dark:text-slate-300">Went Well</span> -- Things the team should keep doing. Celebrating wins is important for morale and reinforces good practices.</li>
          <li><span class="font-medium text-slate-700 dark:text-slate-300">Needs Improvement</span> -- Pain points, blockers, or process failures. The goal is not to blame individuals but to identify systemic issues.</li>
          <li><span class="font-medium text-slate-700 dark:text-slate-300">Action Items</span> -- Concrete, assignable next steps that come out of the discussion. A retro without action items is just venting. Each action should have an owner and be reviewed at the next retro.</li>
          <li><span class="font-medium text-slate-700 dark:text-slate-300">Decision Log</span> -- A searchable record of decisions made across sprints. Decisions are extracted from comments left on story detail modals during sprint work -- technical choices, scope changes, trade-offs discussed in the moment. When someone asks "Why do we do it this way?", the decision log has the answer.</li>
        </ul>
      </div>`)
  );

  sessions = migrateToolDataToProject('retro-sessions', []);
  decisions = migrateToolDataToProject('decisions', []);

  populateSessionDropdown();
  renderDecisions();

  // Auto-select the most recent session if one exists
  if (sessions.length > 0) {
    currentSessionId = sessions[sessions.length - 1].id;
    document.getElementById('session-select').value = currentSessionId;
    const mobileSelect = document.getElementById('session-select-mobile');
    if (mobileSelect) mobileSelect.value = currentSessionId;
    renderRetroBoard();
  }

  updateRetroVisibility();
});

// ─── Tab Switching ───
function switchTab(tab) {
  const tabRetro = document.getElementById('tab-retro');
  const tabDecisions = document.getElementById('tab-decisions');
  const panelRetro = document.getElementById('panel-retro');
  const panelDecisions = document.getElementById('panel-decisions');

  const activeClasses = 'bg-slate-800 dark:bg-white dark:text-slate-900 text-white';
  const inactiveClasses = 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400';

  if (tab === 'retro') {
    tabRetro.className = `px-4 py-2 rounded-full text-sm font-semibold transition-colors ${activeClasses}`;
    tabDecisions.className = `px-4 py-2 rounded-full text-sm font-semibold transition-colors ${inactiveClasses}`;
    panelRetro.classList.remove('hidden');
    panelDecisions.classList.add('hidden');
  } else {
    tabDecisions.className = `px-4 py-2 rounded-full text-sm font-semibold transition-colors ${activeClasses}`;
    tabRetro.className = `px-4 py-2 rounded-full text-sm font-semibold transition-colors ${inactiveClasses}`;
    panelDecisions.classList.remove('hidden');
    panelRetro.classList.add('hidden');
  }
}

// ═══════════════════════════════════════
// RETRO BOARD
// ═══════════════════════════════════════

function saveSessions() {
  saveProjectData('retro-sessions', sessions);
}

function getCurrentSession() {
  return sessions.find(s => s.id === currentSessionId) || null;
}

function populateSessionDropdown() {
  const select = document.getElementById('session-select');
  const mobileSelect = document.getElementById('session-select-mobile');
  const options = '<option value="">-- Select Session --</option>' +
    sessions.map(s => `<option value="${s.id}">${escapeHtml(getSessionSprintLabel(s))}</option>`).join('');
  const mobileOptions = '<option value="">-- Session --</option>' +
    sessions.map(s => {
      const sprint = s.sprintId ? getSprintById(s.sprintId) : null;
      const label = sprint ? sprint.name + ' - ' + formatDate(s.date) : 'Retro - ' + formatDate(s.date);
      return `<option value="${s.id}">${escapeHtml(label)}</option>`;
    }).join('');

  select.innerHTML = options;
  if (mobileSelect) mobileSelect.innerHTML = mobileOptions;
}

function handleSessionChange() {
  const val = document.getElementById('session-select').value;
  currentSessionId = val || null;
  // Sync mobile select
  const mobileSelect = document.getElementById('session-select-mobile');
  if (mobileSelect) mobileSelect.value = val;
  renderRetroBoard();
  updateRetroVisibility();
}

function syncRetroMobileSession() {
  const mobileSelect = document.getElementById('session-select-mobile');
  const val = mobileSelect ? mobileSelect.value : '';
  currentSessionId = val || null;
  document.getElementById('session-select').value = val;
  renderRetroBoard();
  updateRetroVisibility();
}

function createNewSession() {
  const sprints = loadSprints();

  // Find sprints that already have a retro session
  const usedSprintIds = new Set(sessions.map(s => s.sprintId).filter(Boolean));

  // Build sprint picker modal if needed
  if (!document.getElementById('new-session-modal')) {
    const modal = document.createElement('div');
    modal.id = 'new-session-modal';
    modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 items-center justify-center p-4';
    modal.onclick = (e) => { if (e.target === modal) closeModal('new-session-modal'); };
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-white">New Retro Session</h3>
          <button onclick="closeModal('new-session-modal')" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="p-5 space-y-4">
          <div>
            <label for="new-session-sprint" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Link to Sprint</label>
            <select id="new-session-sprint"
              class="w-full px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-slate-400 focus:outline-none">
            </select>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" onclick="closeModal('new-session-modal')" class="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button type="button" onclick="confirmNewSession()" class="px-4 py-2 text-sm font-medium rounded-lg bg-slate-800 dark:bg-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 text-white transition-colors">Create</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  // Populate sprint dropdown
  const sprintSelect = document.getElementById('new-session-sprint');
  let opts = '<option value="">No Sprint (standalone)</option>';

  // Prioritize completed sprints, then active
  const sortedSprints = [...sprints].sort((a, b) => {
    const order = { completed: 0, active: 1, planned: 2 };
    return (order[a.status] || 3) - (order[b.status] || 3);
  });

  sortedSprints.forEach(s => {
    const already = usedSprintIds.has(s.id);
    const statusLabel = s.status === 'completed' ? 'Completed' : s.status === 'active' ? 'Active' : 'Planned';
    const label = s.name + ' (' + statusLabel + ')' + (already ? ' -- has retro' : '');
    opts += `<option value="${s.id}" ${already ? 'disabled' : ''}>${escapeHtml(label)}</option>`;
  });
  sprintSelect.innerHTML = opts;

  // Auto-select most recent completed sprint without a retro, or active sprint
  const autoSelect = sortedSprints.find(s => !usedSprintIds.has(s.id) && s.status === 'completed')
    || sortedSprints.find(s => !usedSprintIds.has(s.id) && s.status === 'active');
  if (autoSelect) sprintSelect.value = autoSelect.id;

  openModal('new-session-modal');
}

function confirmNewSession() {
  const sprintId = document.getElementById('new-session-sprint').value || null;

  const session = {
    id: uid(),
    date: todayLocal(),
    sprintId: sprintId,
    wentWell: [],
    didntGoWell: [],
    actionItems: []
  };
  sessions.push(session);
  saveSessions();

  closeModal('new-session-modal');
  populateSessionDropdown();
  currentSessionId = session.id;
  document.getElementById('session-select').value = session.id;
  const mobileSelect = document.getElementById('session-select-mobile');
  if (mobileSelect) mobileSelect.value = session.id;
  renderRetroBoard();
  updateRetroVisibility();

  const sprint = sprintId ? getSprintById(sprintId) : null;
  showToast(sprint ? sprint.name + ' retro created' : 'New retro session created');
}

function deleteCurrentSession() {
  if (!currentSessionId) return;
  if (!confirmAction('Delete this entire retro session? This cannot be undone.')) return;

  sessions = sessions.filter(s => s.id !== currentSessionId);
  currentSessionId = null;
  saveSessions();

  populateSessionDropdown();
  document.getElementById('session-select').value = '';
  const mobileSelect = document.getElementById('session-select-mobile');
  if (mobileSelect) mobileSelect.value = '';
  renderRetroBoard();
  updateRetroVisibility();
  showToast('Session deleted');
}

function updateRetroVisibility() {
  const hasSession = currentSessionId !== null;
  const hasSessions = sessions.length > 0;

  document.getElementById('retro-columns').classList.toggle('hidden', !hasSession);
  document.getElementById('retro-empty').classList.toggle('hidden', hasSessions);

  // Desktop delete button
  const btnDelete = document.getElementById('btn-delete-session');
  if (hasSession) {
    btnDelete.classList.remove('hidden');
    btnDelete.classList.add('inline-flex');
  } else {
    btnDelete.classList.add('hidden');
    btnDelete.classList.remove('inline-flex');
  }

  // Mobile delete button
  const btnDeleteMobile = document.getElementById('btn-delete-session-mobile');
  if (btnDeleteMobile) {
    if (hasSession) {
      btnDeleteMobile.classList.remove('hidden');
      btnDeleteMobile.classList.add('flex');
    } else {
      btnDeleteMobile.classList.add('hidden');
      btnDeleteMobile.classList.remove('flex');
    }
  }

  // Stats dashboard
  const statsDashboard = document.getElementById('retro-stats-dashboard');
  if (hasSession) {
    statsDashboard.classList.remove('hidden');
    renderRetroStats();
  } else {
    statsDashboard.classList.add('hidden');
  }
}

function renderRetroStats() {
  const session = getCurrentSession();
  if (!session) return;

  const well = session.wentWell.length;
  const improve = session.didntGoWell.length;
  const actions = session.actionItems.length;
  const total = well + improve + actions;
  const openActions = session.actionItems.filter(a => a.status === 'Open').length;

  const el = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val;
  };

  el('retro-stat-total', total);
  el('retro-stat-well', well);
  el('retro-stat-improve', improve);
  el('retro-stat-actions', actions);

  const label = document.getElementById('retro-stat-actions-label');
  if (label) {
    label.textContent = openActions > 0 ? openActions + ' still open' : 'Action items';
  }
}

function renderRetroBoard() {
  const session = getCurrentSession();

  // Clear all columns
  ['wentWell', 'didntGoWell', 'actionItems'].forEach(col => {
    document.getElementById(`col-${col}`).innerHTML = '';
  });

  if (!session) return;

  // Render Went Well cards
  session.wentWell.forEach(card => {
    document.getElementById('col-wentWell').appendChild(
      buildSimpleCard(card, 'wentWell', 'emerald')
    );
  });

  // Render Didn't Go Well cards
  session.didntGoWell.forEach(card => {
    document.getElementById('col-didntGoWell').appendChild(
      buildSimpleCard(card, 'didntGoWell', 'red')
    );
  });

  // Render Action Items
  session.actionItems.forEach(card => {
    document.getElementById('col-actionItems').appendChild(
      buildActionCard(card)
    );
  });

  renderRetroStats();
}

function buildSimpleCard(card, column, color) {
  const div = document.createElement('div');
  div.className = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3';

  const hasMeta = card.assignee || card.points || card.priority || card.sprintStatus;

  let footerHtml = '';
  if (hasMeta) {
    const badges = [];
    if (card.assignee) {
      badges.push(`<span class="inline-flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>${escapeHtml(card.assignee)}</span>`);
    }
    if (card.points) {
      badges.push(`<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-semibold">${card.points} pts</span>`);
    }
    if (card.priority) {
      const prioColors = {
        'Critical': 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
        'High': 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400',
        'Medium': 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400',
        'Low': 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
      };
      const prioClass = prioColors[card.priority] || 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400';
      badges.push(`<span class="inline-flex items-center px-1.5 py-0.5 rounded font-semibold ${prioClass}">${escapeHtml(card.priority)}</span>`);
    }
    if (card.sprintStatus) {
      const statusColor = card.sprintStatus === 'Done'
        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
        : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400';
      badges.push(`<span class="inline-flex items-center px-1.5 py-0.5 rounded font-semibold ${statusColor}">${escapeHtml(card.sprintStatus)}</span>`);
    }

    footerHtml = `
      <div class="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/50">
        <div class="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          ${badges.join('')}
        </div>
      </div>`;
  }

  div.innerHTML = `
    <div class="flex items-start justify-between gap-2">
      <p class="text-sm text-slate-800 dark:text-slate-200 flex-1 whitespace-pre-wrap">${escapeHtml(card.text)}</p>
      <div class="flex items-center gap-0.5 shrink-0">
        <button onclick="openRetroCardModal('${column}', '${card.id}')" class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Edit">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <button onclick="deleteRetroCard('${column}', '${card.id}')" class="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
    ${footerHtml}
  `;
  return div;
}

function buildActionCard(card) {
  const isDone = card.status === 'Done';
  const statusBadge = isDone
    ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">Done</span>'
    : '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">Open</span>';

  const div = document.createElement('div');
  div.className = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3';

  div.innerHTML = `
    <div class="flex items-start justify-between gap-2 mb-2">
      <p class="text-sm flex-1 whitespace-pre-wrap ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}">${escapeHtml(card.text)}</p>
      <div class="flex items-center gap-0.5 shrink-0">
        <button onclick="openActionItemModal('${card.id}')" class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Edit">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <button onclick="deleteRetroCard('actionItems', '${card.id}')" class="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      ${card.owner ? `<span class="flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>${escapeHtml(card.owner)}</span>` : ''}
      ${card.dueDate ? `<span class="flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>${formatDate(card.dueDate)}</span>` : ''}
      <button onclick="toggleActionStatus('${card.id}')" class="cursor-pointer hover:opacity-80 transition-opacity">${statusBadge}</button>
    </div>
  `;
  return div;
}

// ─── Retro Card Modal (replaces prompt()) ───

function openRetroCardModal(column, cardId) {
  const session = getCurrentSession();
  if (!session) {
    showToast('Select or create a session first', 'error');
    return;
  }

  document.getElementById('retro-card-form').reset();
  document.getElementById('retro-card-column').value = column;
  document.getElementById('retro-card-id').value = cardId || '';

  if (cardId) {
    const card = session[column].find(c => c.id === cardId);
    if (!card) return;
    document.getElementById('retro-card-modal-title').textContent = 'Edit Card';
    document.getElementById('retro-card-text').value = card.text;
  } else {
    const titles = {
      wentWell: 'Add Went Well Card',
      didntGoWell: 'Add Didn\'t Go Well Card'
    };
    document.getElementById('retro-card-modal-title').textContent = titles[column] || 'Add Card';
  }

  openModal('retro-card-modal');
  setTimeout(() => document.getElementById('retro-card-text').focus(), 100);
}

function handleSaveRetroCard(event) {
  event.preventDefault();

  const column = document.getElementById('retro-card-column').value;
  const cardId = document.getElementById('retro-card-id').value;
  const text = document.getElementById('retro-card-text').value.trim();
  if (!text) return;

  const session = getCurrentSession();
  if (!session) return;

  if (cardId) {
    const card = session[column].find(c => c.id === cardId);
    if (card) card.text = text;
  } else {
    session[column].push({ id: uid(), text: text });
  }

  saveSessions();
  closeModal('retro-card-modal');
  renderRetroBoard();
}

// ─── Action Item Modal (replaces prompt()) ───

function openActionItemModal(cardId) {
  const session = getCurrentSession();
  if (!session) {
    showToast('Select or create a session first', 'error');
    return;
  }

  document.getElementById('action-item-form').reset();
  document.getElementById('action-item-id').value = cardId || '';

  // Populate owner dropdown from team members
  const team = loadProjectData('sprint-team', []);
  const ownerSelect = document.getElementById('action-item-owner');
  const currentOwner = cardId ? (session.actionItems.find(c => c.id === cardId) || {}).owner || '' : '';

  let opts = '<option value="">Unassigned</option>';
  // Management/process roles first, then others
  const mgmtRoles = ['product owner', 'po', 'project manager', 'pm', 'scrum master', 'sm', 'business analyst', 'ba', 'manager', 'lead', 'tech lead'];
  const mgmt = team.filter(m => mgmtRoles.some(r => (m.role || '').toLowerCase().includes(r)));
  const others = team.filter(m => !mgmtRoles.some(r => (m.role || '').toLowerCase().includes(r)));

  if (mgmt.length > 0) {
    mgmt.forEach(m => {
      const sel = m.name === currentOwner ? ' selected' : '';
      opts += `<option value="${escapeHtml(m.name)}"${sel}>${escapeHtml(m.name)} (${escapeHtml(m.role || 'Other')})</option>`;
    });
  }
  if (others.length > 0 && mgmt.length > 0) {
    opts += '<option disabled>───────────</option>';
  }
  if (others.length > 0) {
    others.forEach(m => {
      const sel = m.name === currentOwner ? ' selected' : '';
      opts += `<option value="${escapeHtml(m.name)}"${sel}>${escapeHtml(m.name)} (${escapeHtml(m.role || 'Other')})</option>`;
    });
  }

  // Keep legacy owner if not in team
  if (currentOwner && !team.some(m => m.name === currentOwner)) {
    opts += `<option value="${escapeHtml(currentOwner)}" selected>${escapeHtml(currentOwner)}</option>`;
  }

  ownerSelect.innerHTML = opts;

  if (cardId) {
    const card = session.actionItems.find(c => c.id === cardId);
    if (!card) return;
    document.getElementById('action-item-modal-title').textContent = 'Edit Action Item';
    document.getElementById('action-item-submit-btn').textContent = 'Save';
    document.getElementById('action-item-text').value = card.text;
    document.getElementById('action-item-owner').value = card.owner || '';
    document.getElementById('action-item-due').value = card.dueDate || '';
  } else {
    document.getElementById('action-item-modal-title').textContent = 'New Action Item';
    document.getElementById('action-item-submit-btn').textContent = 'Add Action Item';
  }

  openModal('action-item-modal');
  setTimeout(() => document.getElementById('action-item-text').focus(), 100);
}

function handleSaveActionItem(event) {
  event.preventDefault();

  const cardId = document.getElementById('action-item-id').value;
  const text = document.getElementById('action-item-text').value.trim();
  if (!text) return;

  const owner = (document.getElementById('action-item-owner').value || '').trim();
  const dueDate = (document.getElementById('action-item-due').value || '').trim();

  const session = getCurrentSession();
  if (!session) return;

  if (cardId) {
    const card = session.actionItems.find(c => c.id === cardId);
    if (card) {
      card.text = text;
      card.owner = owner;
      card.dueDate = dueDate;
    }
  } else {
    session.actionItems.push({
      id: uid(),
      text: text,
      owner: owner,
      dueDate: dueDate,
      status: 'Open'
    });
  }

  saveSessions();
  closeModal('action-item-modal');
  renderRetroBoard();
}

function deleteRetroCard(column, cardId) {
  if (!confirmAction('Delete this card?')) return;

  const session = getCurrentSession();
  if (!session) return;

  session[column] = session[column].filter(c => c.id !== cardId);
  saveSessions();
  renderRetroBoard();
}

function toggleActionStatus(cardId) {
  const session = getCurrentSession();
  if (!session) return;

  const card = session.actionItems.find(c => c.id === cardId);
  if (!card) return;

  card.status = card.status === 'Open' ? 'Done' : 'Open';
  saveSessions();
  renderRetroBoard();
}

function exportRetroMarkdown() {
  const session = getCurrentSession();
  if (!session) {
    showToast('No session selected', 'error');
    return;
  }

  const sprint = session.sprintId ? getSprintById(session.sprintId) : null;
  const title = sprint ? sprint.name + ' Retro' : 'Retro';
  let md = `# ${title} - ${formatDate(session.date)}\n\n`;

  const formatCardMd = (c) => {
    let line = `- ${c.text}`;
    const meta = [];
    if (c.assignee) meta.push(c.assignee);
    if (c.points) meta.push(c.points + ' pts');
    if (c.priority) meta.push(c.priority);
    if (c.sprintStatus) meta.push(c.sprintStatus);
    if (meta.length > 0) line += ' (' + meta.join(' | ') + ')';
    return line;
  };

  md += `## Went Well\n`;
  if (session.wentWell.length === 0) {
    md += `- (none)\n`;
  } else {
    session.wentWell.forEach(c => {
      md += formatCardMd(c) + '\n';
    });
  }
  md += `\n`;

  md += `## Didn't Go Well\n`;
  if (session.didntGoWell.length === 0) {
    md += `- (none)\n`;
  } else {
    session.didntGoWell.forEach(c => {
      md += formatCardMd(c) + '\n';
    });
  }
  md += `\n`;

  md += `## Action Items\n`;
  if (session.actionItems.length === 0) {
    md += `- (none)\n`;
  } else {
    session.actionItems.forEach(c => {
      const check = c.status === 'Done' ? 'x' : ' ';
      let line = `- [${check}] ${c.text}`;
      const meta = [];
      if (c.owner) meta.push(`Owner: ${c.owner}`);
      if (c.dueDate) meta.push(`Due: ${formatDate(c.dueDate)}`);
      if (meta.length > 0) line += ` (${meta.join(', ')})`;
      md += line + '\n';
    });
  }

  const sprintSlug = sprint ? sprint.name.toLowerCase().replace(/\s+/g, '-') + '-' : '';
  const filename = `${sprintSlug}retro-${session.date}.md`;
  exportMarkdown(filename, md);
}

// ═══════════════════════════════════════
// DECISION LOG
// ═══════════════════════════════════════

function saveDecisions() {
  saveProjectData('decisions', decisions);
}

function renderDecisionStats() {
  if (decisions.length === 0) {
    document.getElementById('decision-stats-dashboard').classList.add('hidden');
    return;
  }

  document.getElementById('decision-stats-dashboard').classList.remove('hidden');

  const total = decisions.length;
  const active = decisions.filter(d => d.status === 'Active').length;
  const superseded = decisions.filter(d => d.status === 'Superseded').length;
  const reversed = decisions.filter(d => d.status === 'Reversed').length;

  const el = (id, val) => {
    const e = document.getElementById(id);
    if (e) e.textContent = val;
  };

  el('decision-stat-total', total);
  el('decision-stat-active', active);
  el('decision-stat-superseded', superseded);
  el('decision-stat-reversed', reversed);
}

function toggleStatusRemarks() {
  const status = document.getElementById('decision-status').value;
  const section = document.getElementById('status-remarks-section');
  const textarea = document.getElementById('decision-remarks');
  if (status === 'Superseded' || status === 'Reversed') {
    section.classList.remove('hidden');
    textarea.required = true;
  } else {
    section.classList.add('hidden');
    textarea.required = false;
    textarea.value = '';
  }
}

function openDecisionForm(id) {
  const modal = document.getElementById('decision-modal');
  const title = document.getElementById('decision-modal-title');
  const form = document.getElementById('decision-form');

  form.reset();
  document.getElementById('decision-id').value = '';

  const currentOwner = id ? (decisions.find(dec => dec.id === id) || {}).owner || '' : '';
  const currentSprint = id ? (decisions.find(dec => dec.id === id) || {}).sprintId || '' : '';

  // Populate sprint picker
  const sprintSelect = document.getElementById('decision-sprint');
  const sprints = loadSprints();
  let sprintOpts = '<option value="">No sprint</option>';
  sprints.forEach(s => {
    const statusLabel = s.status === 'completed' ? 'Completed' : s.status === 'active' ? 'Active' : 'Planned';
    const sel = s.id === currentSprint ? ' selected' : '';
    sprintOpts += `<option value="${s.id}"${sel}>${escapeHtml(s.name)} (${statusLabel})</option>`;
  });
  sprintSelect.innerHTML = sprintOpts;

  // Populate owner dropdown from team
  const team = loadProjectData('sprint-team', []);
  const ownerSelect = document.getElementById('decision-owner');
  let ownerOpts = '<option value="">Select owner</option>';
  team.forEach(m => {
    const sel = m.name === currentOwner ? ' selected' : '';
    ownerOpts += `<option value="${escapeHtml(m.name)}"${sel}>${escapeHtml(m.name)} (${escapeHtml(m.role || 'Other')})</option>`;
  });
  // Keep legacy owner if not in team
  if (currentOwner && !team.some(m => m.name === currentOwner)) {
    ownerOpts += `<option value="${escapeHtml(currentOwner)}" selected>${escapeHtml(currentOwner)}</option>`;
  }
  ownerSelect.innerHTML = ownerOpts;

  if (id) {
    const d = decisions.find(dec => dec.id === id);
    if (!d) return;

    title.textContent = 'Edit Decision';
    document.getElementById('decision-id').value = d.id;
    document.getElementById('decision-date').value = d.date;
    document.getElementById('decision-context').value = d.context;
    document.getElementById('decision-decision').value = d.decision;
    document.getElementById('decision-rationale').value = d.rationale;
    document.getElementById('decision-owner').value = d.owner;
    document.getElementById('decision-sprint').value = d.sprintId || '';
    document.getElementById('decision-status').value = d.status;
    document.getElementById('decision-remarks').value = d.remarks || '';
    toggleStatusRemarks();
  } else {
    title.textContent = 'New Decision';
    document.getElementById('decision-date').value = todayLocal();
    document.getElementById('decision-remarks').value = '';
    toggleStatusRemarks();
  }

  openModal('decision-modal');
}

function handleSaveDecision(event) {
  event.preventDefault();

  const id = document.getElementById('decision-id').value;
  const status = document.getElementById('decision-status').value;
  const data = {
    date: document.getElementById('decision-date').value,
    sprintId: document.getElementById('decision-sprint').value || null,
    context: document.getElementById('decision-context').value.trim(),
    decision: document.getElementById('decision-decision').value.trim(),
    rationale: document.getElementById('decision-rationale').value.trim(),
    owner: (document.getElementById('decision-owner').value || '').trim(),
    status: status,
    remarks: (status === 'Superseded' || status === 'Reversed') ? document.getElementById('decision-remarks').value.trim() : ''
  };

  if (id) {
    const idx = decisions.findIndex(d => d.id === id);
    if (idx !== -1) {
      decisions[idx] = { ...decisions[idx], ...data };
    }
    showToast('Decision updated');
  } else {
    decisions.push({
      id: uid(),
      ...data,
      createdAt: new Date().toISOString()
    });
    showToast('Decision added');
  }

  saveDecisions();
  closeModal('decision-modal');
  renderDecisions();
}

function deleteDecision(id) {
  if (!confirmAction('Delete this decision? This cannot be undone.')) return;

  decisions = decisions.filter(d => d.id !== id);
  saveDecisions();
  renderDecisions();
  showToast('Decision deleted');
}

// ─── Decision Detail Modal ───

function openDecisionDetail(id) {
  const d = decisions.find(dec => dec.id === id);
  if (!d) return;

  const sprint = d.sprintId ? getSprintById(d.sprintId) : null;
  const sprintBadge = sprint ? ` <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">${escapeHtml(sprint.name)}</span>` : '';
  document.getElementById('detail-date').textContent = formatDate(d.date);
  document.getElementById('detail-status').innerHTML = buildStatusBadge(d.status) + sprintBadge;
  document.getElementById('detail-decision').textContent = d.decision;
  document.getElementById('detail-owner').textContent = 'Owner: ' + (d.owner || 'Unassigned');
  document.getElementById('detail-context').textContent = d.context;
  document.getElementById('detail-rationale').textContent = d.rationale;

  const remarksSection = document.getElementById('detail-remarks-section');
  if (d.remarks && (d.status === 'Superseded' || d.status === 'Reversed')) {
    document.getElementById('detail-remarks').textContent = d.remarks;
    remarksSection.classList.remove('hidden');
  } else {
    remarksSection.classList.add('hidden');
  }

  document.getElementById('detail-edit-btn').onclick = () => {
    closeModal('decision-detail-modal');
    openDecisionForm(id);
  };

  openModal('decision-detail-modal');
}

// ─── Filters + Render ───

function getFilteredDecisions() {
  const searchVal = (document.getElementById('decision-search').value || '').toLowerCase();
  const ownerFilter = document.getElementById('filter-owner').value;
  const statusFilter = document.getElementById('filter-status').value;

  return decisions
    .filter(d => {
      if (searchVal) {
        const haystack = `${d.context} ${d.decision} ${d.rationale}`.toLowerCase();
        if (!haystack.includes(searchVal)) return false;
      }
      if (ownerFilter && d.owner !== ownerFilter) return false;
      if (statusFilter && d.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function populateOwnerFilter() {
  const select = document.getElementById('filter-owner');
  const mobileSelect = document.getElementById('filter-owner-mobile');
  const currentVal = select.value;

  const owners = [...new Set(decisions.map(d => d.owner).filter(Boolean))].sort();

  select.innerHTML = '<option value="">All Owners</option>';
  owners.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    select.appendChild(opt);
  });

  if (owners.includes(currentVal)) {
    select.value = currentVal;
  }

  // Sync mobile owner filter
  if (mobileSelect) {
    const mobileVal = mobileSelect.value;
    mobileSelect.innerHTML = '<option value="">Owner</option>';
    owners.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o;
      mobileSelect.appendChild(opt);
    });
    if (owners.includes(mobileVal)) {
      mobileSelect.value = mobileVal;
    }
  }
}

function syncDecisionMobileFilter() {
  // Sync mobile filter values to desktop
  const mobileSearch = document.getElementById('decision-search-mobile');
  const mobileStatus = document.getElementById('filter-status-mobile');
  const mobileOwner = document.getElementById('filter-owner-mobile');

  if (mobileSearch) document.getElementById('decision-search').value = mobileSearch.value;
  if (mobileStatus) document.getElementById('filter-status').value = mobileStatus.value;
  if (mobileOwner) document.getElementById('filter-owner').value = mobileOwner.value;

  renderDecisions();
}

function renderDecisions() {
  populateOwnerFilter();
  renderDecisionStats();

  const filtered = getFilteredDecisions();
  const container = document.getElementById('decision-cards');
  const emptyState = document.getElementById('decision-empty');

  if (decisions.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12">
        <p class="text-sm text-slate-500 dark:text-slate-400">No decisions match your filters.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(d => {
    const statusBadge = buildStatusBadge(d.status);
    const contextPreview = d.context.length > 100 ? d.context.substring(0, 100) + '...' : d.context;
    const sprint = d.sprintId ? getSprintById(d.sprintId) : null;
    const sprintBadge = sprint ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">${escapeHtml(sprint.name)}</span>` : '';

    return `
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors" onclick="openDecisionDetail('${d.id}')">
        <div class="flex items-center gap-2 mb-2 flex-wrap">
          <span class="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">${formatDate(d.date)}</span>
          ${statusBadge}
          ${sprintBadge}
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2 mb-1">${escapeHtml(contextPreview)}</p>
        <h3 class="text-sm font-semibold text-slate-900 dark:text-white mb-2 line-clamp-2">${escapeHtml(d.decision)}</h3>
        ${d.owner ? `<p class="text-xs text-slate-400 dark:text-slate-500 mb-2"><svg class="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>${escapeHtml(d.owner)}</p>` : ''}
        ${d.remarks && (d.status === 'Superseded' || d.status === 'Reversed') ? `<p class="text-xs text-yellow-600 dark:text-yellow-400 mb-2 italic">Has status remarks</p>` : ''}
        <div class="flex items-center gap-1 pt-2 border-t border-slate-100 dark:border-slate-800" onclick="event.stopPropagation()">
          <div class="flex-1"></div>
          <button onclick="openDecisionForm('${d.id}')" class="p-2 rounded-lg text-slate-400 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Edit">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button onclick="deleteDecision('${d.id}')" class="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Delete">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

function buildStatusBadge(status) {
  const styles = {
    Active: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400',
    Superseded: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400',
    Reversed: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
  };
  const cls = styles[status] || styles.Active;
  return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}">${status}</span>`;
}

// ─── AI: Import Decisions from Sprint Board AI Comments ───

function handleAiImportDecisions() {
  if (!ensureApiKey()) return;

  const sprints = loadSprints();
  if (sprints.length === 0) {
    showToast('No sprints found', 'error');
    return;
  }

  // Build modal if first use
  if (!document.getElementById('ai-decisions-modal')) {
    const modal = document.createElement('div');
    modal.id = 'ai-decisions-modal';
    modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 items-center justify-center p-4';
    modal.onclick = (e) => { if (e.target === modal) closeModal('ai-decisions-modal'); };
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[85vh] flex flex-col" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">AI Extract Decisions</h2>
          </div>
          <button onclick="closeModal('ai-decisions-modal')" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label for="ai-decisions-sprint" class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Import from sprint</label>
            <select id="ai-decisions-sprint" onchange="updateAiDecisionsPreview()"
              class="w-full px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-slate-400 focus:outline-none">
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Stories with discussions</label>
            <div id="ai-decisions-context" class="space-y-2 max-h-52 overflow-y-auto"></div>
          </div>
          <div>
            <label for="ai-decisions-extra" class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Additional instructions <span class="font-normal normal-case text-slate-400">(optional)</span></label>
            <textarea id="ai-decisions-extra" rows="3" placeholder="e.g., Focus on architecture decisions, ignore minor styling choices..."
              class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-y"></textarea>
          </div>
        </div>
        <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <button onclick="closeModal('ai-decisions-modal')" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
          <button id="btn-ai-decisions-submit" onclick="submitAiImportDecisions()" class="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
            Extract Decisions
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  // Populate sprint dropdown -- no "all sprints", must pick one
  const sprintSelect = document.getElementById('ai-decisions-sprint');
  let opts = '<option value="" disabled>Select a sprint</option>';
  sprints.forEach(s => {
    const statusLabel = s.status === 'completed' ? 'Completed' : s.status === 'active' ? 'Active' : 'Planned';
    const commentedCount = (s.items || []).filter(i => (i.comments || []).length > 0).length;
    opts += `<option value="${s.id}">${escapeHtml(s.name)} (${statusLabel}) -- ${commentedCount} with comments</option>`;
  });
  sprintSelect.innerHTML = opts;

  // Auto-select active sprint, or first sprint
  const activeSprint = sprints.find(s => s.status === 'active') || sprints[0];
  if (activeSprint) sprintSelect.value = activeSprint.id;

  document.getElementById('ai-decisions-extra').value = '';
  updateAiDecisionsPreview();
  openModal('ai-decisions-modal');
}

function updateAiDecisionsPreview() {
  const sprintVal = document.getElementById('ai-decisions-sprint').value;
  const sprints = loadSprints();

  const previewEl = document.getElementById('ai-decisions-context');
  if (!sprintVal) {
    previewEl.innerHTML = '<p class="text-sm text-slate-400 dark:text-slate-500 italic py-3 text-center">Select a sprint</p>';
    return;
  }

  const sprint = sprints.find(s => s.id === sprintVal);
  const items = sprint ? sprint.items || [] : [];
  const storiesWithComments = items.filter(i => (i.comments || []).length > 0);

  if (storiesWithComments.length === 0) {
    previewEl.innerHTML = '<p class="text-sm text-slate-400 dark:text-slate-500 italic py-3 text-center">No stories with comments in ' + escapeHtml(sprint ? sprint.name : 'this sprint') + '</p>';
    return;
  }

  const totalComments = storiesWithComments.reduce((sum, i) => sum + (i.comments || []).length, 0);

  let html = `<div class="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800/50 mb-2">
    <span class="text-xs font-medium text-slate-600 dark:text-slate-300">${storiesWithComments.length} stories will be analyzed</span>
    <span class="text-xs text-slate-400 dark:text-slate-500">${totalComments} comments total</span>
  </div>`;

  html += storiesWithComments.map(item => {
    const count = (item.comments || []).length;
    const colLabels = { 'done': 'Done', 'in-progress': 'In Progress', 'review': 'Review', 'todo': 'To Do' };
    const colColors = { 'done': 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400', 'in-progress': 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400', 'review': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400', 'todo': 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400' };
    const colClass = colColors[item.column] || 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400';
    return `<div class="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
      <div class="flex-1 min-w-0">
        <p class="text-sm text-slate-700 dark:text-slate-300 truncate">${escapeHtml(item.action)}</p>
      </div>
      <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${colClass} shrink-0">${colLabels[item.column] || item.column}</span>
      <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
        ${count}
      </span>
    </div>`;
  }).join('');

  previewEl.innerHTML = html;
}

async function submitAiImportDecisions() {
  const sprintVal = document.getElementById('ai-decisions-sprint').value;
  const extraInstructions = document.getElementById('ai-decisions-extra').value.trim();
  const sprints = loadSprints();

  if (!sprintVal) {
    showToast('Select a sprint first', 'error');
    return;
  }

  const selectedSprintId = sprintVal;
  const sprint = sprints.find(s => s.id === sprintVal);
  const items = sprint ? sprint.items || [] : [];
  const storiesWithComments = items.filter(item => (item.comments || []).length > 0);

  if (storiesWithComments.length === 0) {
    showToast('No stories with comments in ' + (sprint ? sprint.name : 'selected sprint'), 'error');
    return;
  }

  const btn = document.getElementById('btn-ai-decisions-submit');
  setAiButtonLoading(btn, true);

  try {
    const projectCtx = getProjectContextForAI();
    // Build assignee map so we can auto-set owner on imported decisions
    const storyAssignees = {};
    const storyData = storiesWithComments.map((item, idx) => {
      storyAssignees[idx] = item.assignee || '';
      const storyText = 'As a ' + item.role + ', I want ' + item.action + (item.benefit ? ', so that ' + item.benefit : '');
      const allComments = (item.comments || []).map(c => (c.type === 'ai' ? '[AI] ' : '') + c.text);
      const meta = [];
      if (item.assignee) meta.push('Assignee: ' + item.assignee);
      if (item.column) meta.push('Status: ' + item.column);
      if (item.priority) meta.push(item.priority);
      if (item.storyPoints) meta.push(item.storyPoints + ' pts');
      return {
        story: storyText + (meta.length > 0 ? ' [' + meta.join(', ') + ']' : ''),
        comments: allComments.join('\n   ')
      };
    });

    let userContent = 'Extract decisions from these sprint stories and their discussion comments:\n\n' +
      storyData.map((s, i) => (i + 1) + '. Story: ' + s.story + '\n   Comments:\n   ' + s.comments).join('\n\n');

    if (extraInstructions) {
      userContent += '\n\nAdditional instructions:\n' + extraInstructions;
    }

    const result = await callOpenRouterAPI([
      {
        role: 'system',
        content: `You are a product owner extracting decisions from sprint story comments. Each story has comments from team discussions or AI technical recommendations made during the sprint.

Your job:
- For EVERY story provided, extract at least one decision. Do not skip any story.
- A "decision" is a specific technical or process choice: what technology/approach/pattern was chosen and WHY.
- Extract decisions FROM THE COMMENTS, not from the story title. The story is the context, the comments contain the actual decisions.
- If comments contain AI technical recommendations, extract the key choices recommended (e.g., "Use JWT over session cookies for stateless auth" not "Implement authentication").
- Be specific. BAD: "Use localStorage for data." GOOD: "Store project data in localStorage with per-project namespaced keys to avoid collisions, chosen over IndexedDB for simplicity."
- The "rationale" field must explain WHY this approach was chosen based on what the comments say.

Return ONLY a valid JSON array. One object per story minimum: [{"decision": "specific choice made", "context": "what problem/story prompted this", "rationale": "why this approach was chosen per the discussion"}]. Do not wrap in markdown code blocks.` + projectCtx
      },
      {
        role: 'user',
        content: userContent
      }
    ]);

    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsedItems = JSON.parse(cleaned);

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      showToast('AI could not extract decisions', 'error');
      return;
    }

    parsedItems.forEach((item, idx) => {
      // Use the story assignee as owner since they made/owned the decision
      const owner = storyAssignees[idx] || '';
      decisions.push({
        id: uid(),
        date: todayLocal(),
        sprintId: selectedSprintId,
        context: String(item.context || '').trim(),
        decision: String(item.decision || '').trim(),
        rationale: String(item.rationale || '').trim(),
        owner: owner,
        status: 'Active',
        createdAt: new Date().toISOString()
      });
    });

    saveDecisions();
    closeModal('ai-decisions-modal');
    renderDecisions();
    showToast(parsedItems.length + ' decisions extracted from sprint AI responses');
  } catch (err) {
    showToast('AI error: ' + err.message, 'error');
  } finally {
    setAiButtonLoading(btn, false);
  }
}

function exportDecisionCSV() {
  if (decisions.length === 0) {
    showToast('No decisions to export', 'error');
    return;
  }

  const filtered = getFilteredDecisions();
  const headers = ['Date', 'Sprint', 'Context', 'Decision', 'Rationale', 'Owner', 'Status', 'Remarks'];
  const rows = filtered.map(d => {
    const sprint = d.sprintId ? getSprintById(d.sprintId) : null;
    return [
      d.date,
      sprint ? sprint.name : '',
      d.context,
      d.decision,
      d.rationale,
      d.owner,
      d.status,
      d.remarks || ''
    ];
  });

  exportCSV('decision-log.csv', headers, rows);
}

function exportDecisionMarkdown() {
  if (decisions.length === 0) {
    showToast('No decisions to export', 'error');
    return;
  }

  const filtered = getFilteredDecisions();
  let md = `# Decision Log\n\nExported: ${formatDate(new Date().toISOString())}\n\n---\n\n`;

  filtered.forEach((d, i) => {
    const sprint = d.sprintId ? getSprintById(d.sprintId) : null;
    md += `## ${i + 1}. ${d.decision}\n\n`;
    md += `**Date:** ${formatDate(d.date)}  \n`;
    if (sprint) md += `**Sprint:** ${sprint.name}  \n`;
    md += `**Owner:** ${d.owner || 'Unassigned'}  \n`;
    md += `**Status:** ${d.status}\n\n`;
    md += `### Context\n${d.context}\n\n`;
    md += `### Rationale\n${d.rationale}\n\n`;
    if (d.remarks && (d.status === 'Superseded' || d.status === 'Reversed')) {
      md += `### Status Remarks\n${d.remarks}\n\n`;
    }
    md += `---\n\n`;
  });

  exportMarkdown('decision-log.md', md);
}

// ─── AI: Generate Action Items ───

function handleAiGenerateActions() {
  if (!ensureApiKey()) return;

  const session = getCurrentSession();
  if (!session) {
    showToast('Select or create a session first', 'error');
    return;
  }

  if (session.wentWell.length === 0 && session.didntGoWell.length === 0) {
    showToast('Add some retro items first', 'error');
    return;
  }

  const formatCardContext = (c) => {
    let line = '- ' + c.text;
    const meta = [];
    if (c.assignee) meta.push('Assignee: ' + c.assignee);
    if (c.points) meta.push(c.points + ' pts');
    if (c.priority) meta.push(c.priority + ' priority');
    if (c.sprintStatus) meta.push(c.sprintStatus);
    if (meta.length > 0) line += ' [' + meta.join(', ') + ']';
    return line;
  };

  const wentWellText = session.wentWell.map(formatCardContext).join('\n') || '(none)';
  const didntGoWellText = session.didntGoWell.map(formatCardContext).join('\n') || '(none)';
  const existingActions = session.actionItems.length > 0
    ? session.actionItems.map(a => '- ' + a.text + (a.status === 'Done' ? ' [Done]' : ' [Open]')).join('\n')
    : '(none yet)';

  const contextPreview =
    'Went Well:\n' + wentWellText + '\n\n' +
    'Didn\'t Go Well:\n' + didntGoWellText + '\n\n' +
    'Existing Action Items:\n' + existingActions;

  // Build modal if first use
  if (!document.getElementById('ai-actions-modal')) {
    const modal = document.createElement('div');
    modal.id = 'ai-actions-modal';
    modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 items-center justify-center p-4';
    modal.onclick = (e) => { if (e.target === modal) closeModal('ai-actions-modal'); };
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[85vh] flex flex-col" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">AI Generate Actions</h2>
          </div>
          <button onclick="closeModal('ai-actions-modal')" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Context being sent</label>
            <pre id="ai-actions-context" class="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg p-3 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto"></pre>
          </div>
          <div>
            <label for="ai-actions-extra" class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Additional instructions <span class="font-normal normal-case text-slate-400">(optional)</span></label>
            <textarea id="ai-actions-extra" rows="3" placeholder="e.g., Focus on process improvements, suggest actions for testing gaps, prioritize quick wins..."
              class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-y"></textarea>
          </div>
        </div>
        <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <button onclick="closeModal('ai-actions-modal')" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
          <button id="btn-ai-actions-submit" onclick="submitAiGenerateActions()" class="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
            Generate Actions
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }

  document.getElementById('ai-actions-context').textContent = contextPreview;
  document.getElementById('ai-actions-extra').value = '';
  openModal('ai-actions-modal');
  setTimeout(() => document.getElementById('ai-actions-extra').focus(), 100);
}

async function submitAiGenerateActions() {
  const session = getCurrentSession();
  if (!session) return;

  const extraInstructions = document.getElementById('ai-actions-extra').value.trim();
  const btn = document.getElementById('btn-ai-actions-submit');
  setAiButtonLoading(btn, true);

  try {
    const projectCtx = getProjectContextForAI();
    const formatCard = (c) => {
      let line = '- ' + c.text;
      const meta = [];
      if (c.assignee) meta.push('Assignee: ' + c.assignee);
      if (c.points) meta.push(c.points + ' pts');
      if (c.priority) meta.push(c.priority + ' priority');
      if (c.sprintStatus) meta.push(c.sprintStatus);
      if (meta.length > 0) line += ' [' + meta.join(', ') + ']';
      return line;
    };
    const wentWellText = session.wentWell.map(formatCard).join('\n') || '(none)';
    const didntGoWellText = session.didntGoWell.map(formatCard).join('\n') || '(none)';
    const existingActions = session.actionItems.length > 0
      ? session.actionItems.map(a => '- ' + a.text + (a.status === 'Done' ? ' [Done]' : ' [Open]')).join('\n')
      : '(none yet)';

    // Include team members for owner suggestions
    const team = loadProjectData('sprint-team', []);
    const teamText = team.length > 0
      ? team.map(m => '- ' + m.name + ' (' + (m.role || 'Other') + ')').join('\n')
      : '';

    let userContent = 'Went Well:\n' + wentWellText +
      '\n\nDidn\'t Go Well:\n' + didntGoWellText +
      '\n\nExisting Action Items:\n' + existingActions;

    if (teamText) {
      userContent += '\n\nTeam Members:\n' + teamText;
    }

    if (extraInstructions) {
      userContent += '\n\nAdditional instructions:\n' + extraInstructions;
    }

    const result = await callOpenRouterAPI([
      {
        role: 'system',
        content: `You are a senior agile coach analyzing a sprint retrospective. Your job is to generate actionable improvement items following industry-standard retrospective analysis.

Analysis approach:
1. PATTERN RECOGNITION: Look for recurring themes across "Went Well" and "Didn't Go Well" items. Recurring pain points need systemic fixes, not band-aids.
2. ROOT CAUSE ANALYSIS: For each "Didn't Go Well" item, think about the root cause (process, tooling, communication, skill gap, scope creep?) not just the symptom. Use the metadata -- if a High priority story got stuck, that's more urgent than a Low one. If the same assignee has multiple incomplete items, that signals a capacity or blocking issue.
3. REINFORCE POSITIVES: If something went well, generate an action to formalize or scale it (e.g., "Team collaboration was great" -> action to document the practice).
4. SMART CRITERIA: Each action must be Specific (what exactly), Measurable (how to verify), Achievable (within team control), and Time-bound (can be done in 1-2 sprints).
5. AVOID DUPLICATES: Check existing action items. Do NOT generate actions that overlap with what already exists.
6. OWNER SUGGESTIONS: If team members are provided, suggest the most appropriate owner based on their role and the action type. Use assignee info from cards to identify who was involved.
7. USE STORY METADATA: Items may include [Assignee, Story Points, Priority, Sprint Status] in brackets. Factor this into your analysis -- high-point incomplete stories are bigger risks, patterns in assignees reveal workload issues, priority mismatches (high priority stuck, low priority done) reveal planning gaps.

Return ONLY valid JSON array of objects: [{"text": "action description", "suggestedOwner": "name or empty string"}]. Generate 3-5 items. Do not wrap in markdown code blocks.` + projectCtx
      },
      {
        role: 'user',
        content: userContent
      }
    ]);

    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const items = JSON.parse(cleaned);

    if (!Array.isArray(items) || items.length === 0) {
      showToast('AI returned no action items', 'error');
      return;
    }

    items.forEach(item => {
      const text = typeof item === 'string' ? item : (item.text || '');
      const owner = typeof item === 'object' ? (item.suggestedOwner || '') : '';
      if (!text.trim()) return;
      session.actionItems.push({
        id: uid(),
        text: text.trim(),
        owner: owner.trim(),
        dueDate: '',
        status: 'Open'
      });
    });

    saveSessions();
    closeModal('ai-actions-modal');
    renderRetroBoard();
    showToast(items.length + ' action items generated');
  } catch (err) {
    showToast('AI error: ' + err.message, 'error');
  } finally {
    setAiButtonLoading(btn, false);
  }
}

// ─── AI: Summarize Retro ───

async function handleAiRetroSummarize() {
  if (!ensureApiKey()) return;

  const session = getCurrentSession();
  if (!session) {
    showToast('Select a retro session first', 'error');
    return;
  }

  if (session.wentWell.length === 0 && session.didntGoWell.length === 0) {
    showToast('Add some retro items first', 'error');
    return;
  }

  // Disable both desktop and mobile AI buttons
  const btn = document.getElementById('btn-ai-retro-summary');
  const btnMobile = document.getElementById('btn-ai-retro-summary-mobile');
  if (btn) setAiButtonLoading(btn, true);
  if (btnMobile) setAiButtonLoading(btnMobile, true);

  try {
    const projectCtx = getProjectContextForAI();
    const wentWellText = session.wentWell.map(c => '- ' + c.text).join('\n') || '(none)';
    const didntGoWellText = session.didntGoWell.map(c => '- ' + c.text).join('\n') || '(none)';
    const actionItemsText = session.actionItems.map(c =>
      '- ' + c.text + (c.owner ? ' (Owner: ' + c.owner + ')' : '')
    ).join('\n') || '(none)';

    const result = await callOpenRouterAPI([
      {
        role: 'system',
        content: 'You are an agile coach summarizing a retrospective. Analyze the items and provide: 1) Key themes (2-3 bullet points), 2) Patterns you notice, 3) Suggested action items (specific, actionable). Keep it concise and practical. Use plain text, no markdown headers.' + projectCtx
      },
      {
        role: 'user',
        content: 'Went Well:\n' + wentWellText + '\n\nDidn\'t Go Well:\n' + didntGoWellText + '\n\nExisting Action Items:\n' + actionItemsText
      }
    ]);

    showAiRetroResults(result);
  } catch (err) {
    showToast('AI error: ' + err.message, 'error');
  } finally {
    if (btn) setAiButtonLoading(btn, false);
    if (btnMobile) setAiButtonLoading(btnMobile, false);
  }
}

function showAiRetroResults(text) {
  let panel = document.getElementById('ai-retro-results');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'ai-retro-results';
    const retroColumns = document.getElementById('retro-columns');
    retroColumns.after(panel);
  }

  panel.className = 'ai-results-panel mt-6';
  panel.innerHTML = `
    <div class="rounded-xl border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-900/10 p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">AI Retro Summary</h3>
        <button onclick="document.getElementById('ai-retro-results').remove()" class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">${escapeHtml(text)}</div>
    </div>
  `;
}

// ─── Import Sprint Results ───

function getSessionSprintItems() {
  const session = getCurrentSession();
  if (!session) return [];

  // If session is linked to a sprint, use that sprint's items
  if (session.sprintId) {
    const sprint = getSprintById(session.sprintId);
    if (sprint) return sprint.items || [];
  }

  // Fallback: use active sprint's items
  const sprints = loadSprints();
  const active = sprints.find(s => s.status === 'active');
  return active ? active.items || [] : [];
}

function importSprintResults() {
  const session = getCurrentSession();
  if (!session) {
    showToast('Select or create a session first', 'error');
    return;
  }

  const boardItems = getSessionSprintItems();
  if (boardItems.length === 0) {
    const sprint = session.sprintId ? getSprintById(session.sprintId) : null;
    showToast(sprint ? 'No stories in ' + sprint.name : 'No stories on Sprint Board', 'error');
    return;
  }

  const done = boardItems.filter(i => i.column === 'done');
  const stuck = boardItems.filter(i => ['in-progress', 'review'].includes(i.column));
  const todo = boardItems.filter(i => i.column === 'todo');

  if (done.length === 0 && stuck.length === 0 && todo.length === 0) {
    showToast('No stories to import', 'error');
    return;
  }

  let modal = document.getElementById('retro-import-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'retro-import-modal';
    modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div class="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <h2 id="retro-import-title" class="text-lg font-bold text-slate-900 dark:text-white">Import Sprint Results</h2>
          <button onclick="closeModal('retro-import-modal')" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <p class="px-5 pt-3 text-xs text-slate-500 dark:text-slate-400">Select stories to include. Done stories go to "Went Well", others go to "Didn't Go Well".</p>
        <div class="flex items-center gap-2 px-5 pt-2">
          <button onclick="toggleRetroImportAll(true)" class="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline">Select All</button>
          <span class="text-slate-300 dark:text-slate-700">|</span>
          <button onclick="toggleRetroImportAll(false)" class="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline">Deselect All</button>
        </div>
        <div id="retro-import-list" class="flex-1 overflow-y-auto p-5 space-y-1"></div>
        <div class="flex items-center justify-end gap-3 p-5 border-t border-slate-200 dark:border-slate-800">
          <button onclick="closeModal('retro-import-modal')" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Cancel</button>
          <button onclick="handleRetroImport()" class="px-4 py-2 rounded-lg bg-slate-800 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 text-sm font-semibold transition-colors">Import Selected</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // Update modal title with sprint name
  const titleEl = document.getElementById('retro-import-title');
  if (titleEl) {
    const sprint = session.sprintId ? getSprintById(session.sprintId) : null;
    titleEl.textContent = sprint ? 'Import from ' + sprint.name : 'Import Sprint Results';
  }

  // Build set of already-imported story sourceIds
  const importedIds = new Set();
  session.wentWell.forEach(c => { if (c.sourceId) importedIds.add(c.sourceId); });
  session.didntGoWell.forEach(c => { if (c.sourceId) importedIds.add(c.sourceId); });

  const columnLabels = { 'done': 'Done', 'in-progress': 'In Progress', 'review': 'Review', 'todo': 'To Do', 'backlog': 'Backlog' };
  const columnColors = { 'done': 'text-emerald-600 dark:text-emerald-400', 'in-progress': 'text-amber-600 dark:text-amber-400', 'review': 'text-blue-600 dark:text-blue-400', 'todo': 'text-slate-600 dark:text-slate-400' };

  const relevant = [...done, ...stuck, ...todo];
  const availableCount = relevant.filter(i => !importedIds.has(i.id)).length;
  const listEl = document.getElementById('retro-import-list');
  listEl.innerHTML = relevant.map(item => {
    const colClass = columnColors[item.column] || 'text-slate-500';
    const alreadyImported = importedIds.has(item.id);
    return `
      <label class="flex items-start gap-3 p-3 rounded-lg transition-colors ${alreadyImported ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer'}">
        <input type="checkbox" value="${item.id}" ${alreadyImported ? 'disabled' : 'checked'}
          class="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white focus:ring-slate-400">
        <div class="flex-1 min-w-0">
          <p class="text-sm ${alreadyImported ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'} leading-snug">
            As a ${escapeHtml(item.role)}, I want ${escapeHtml(item.action)}
          </p>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-xs font-medium ${colClass}">${columnLabels[item.column] || item.column}</span>
            <span class="text-xs text-slate-500">${item.storyPoints || 0} pts</span>
            ${alreadyImported ? '<span class="text-xs text-slate-400 dark:text-slate-500 italic">Already imported</span>' : ''}
          </div>
        </div>
      </label>
    `;
  }).join('');

  if (availableCount === 0) {
    listEl.innerHTML += `<p class="text-center text-sm text-slate-400 dark:text-slate-500 py-4">All stories have been imported.</p>`;
  }

  openModal('retro-import-modal');
}

function toggleRetroImportAll(selectAll) {
  const checkboxes = document.querySelectorAll('#retro-import-list input[type="checkbox"]:not(:disabled)');
  checkboxes.forEach(cb => cb.checked = selectAll);
}

function handleRetroImport() {
  const checkboxes = document.querySelectorAll('#retro-import-list input[type="checkbox"]:checked');
  if (checkboxes.length === 0) {
    showToast('Select at least one story', 'error');
    return;
  }

  const boardItems = getSessionSprintItems();
  const selectedIds = new Set();
  checkboxes.forEach(cb => selectedIds.add(cb.value));

  const selected = boardItems.filter(i => selectedIds.has(i.id));
  const doneItems = selected.filter(i => i.column === 'done');
  const incompleteItems = selected.filter(i => i.column !== 'done');

  const wellCards = doneItems.map(i => ({
    id: uid(),
    sourceId: i.id,
    text: 'Completed: As a ' + i.role + ', I want ' + i.action + (i.benefit ? ', so that ' + i.benefit : ''),
    assignee: i.assignee || '',
    points: i.storyPoints || 0,
    priority: i.priority || '',
    sprintStatus: 'Done'
  }));
  const improveCards = incompleteItems.map(i => {
    const colLabel = i.column === 'todo' ? 'Still in To Do' : 'Stuck in ' + i.column.replace('-', ' ');
    return {
      id: uid(),
      sourceId: i.id,
      text: 'Not completed: As a ' + i.role + ', I want ' + i.action + (i.benefit ? ', so that ' + i.benefit : ''),
      assignee: i.assignee || '',
      points: i.storyPoints || 0,
      priority: i.priority || '',
      sprintStatus: colLabel
    };
  });

  const session = getCurrentSession();
  if (!session) return;

  session.wentWell.push(...wellCards);
  session.didntGoWell.push(...improveCards);

  saveSessions();
  renderRetroBoard();
  updateRetroVisibility();
  closeModal('retro-import-modal');
  showToast('Imported: ' + doneItems.length + ' done, ' + incompleteItems.length + ' incomplete');
}

// ─── Utilities ───
function todayLocal() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
