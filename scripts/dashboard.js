/* ── SprintLoop Dashboard ── */

let velocityChart = null;
let priorityChart = null;
let teamChart = null;

// ─── Sprint Data Normalization ───
function normalizeSprints(raw) {
  if (!raw || !raw.length) return [];
  if (raw[0]?.name && raw[0]?.status) return raw;
  return [{ id: 'legacy', name: 'Sprint 1', status: 'active', items: raw }];
}

// ─── Chart Theme Helpers ───
function isDark() {
  return document.documentElement.classList.contains('dark');
}

function chartColors() {
  const dark = isDark();
  return {
    grid: dark ? '#334155' : '#e2e8f0',
    tick: dark ? '#94a3b8' : '#475569',
    legend: dark ? '#cbd5e1' : '#334155',
    tooltipBg: dark ? '#1e293b' : '#ffffff',
    tooltipText: dark ? '#f1f5f9' : '#0f172a',
    tooltipBorder: dark ? '#334155' : '#e2e8f0',
  };
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  buildNav('dashboard.html');
  document.getElementById('page-header').appendChild(
    buildPageHeader('Dashboard', 'Project health at a glance')
  );

  const pid = getActiveProjectId();
  if (!pid) {
    document.getElementById('no-project-state').classList.remove('hidden');
    document.getElementById('dashboard-content').classList.add('hidden');
    return;
  }

  document.getElementById('no-project-state').classList.add('hidden');
  document.getElementById('dashboard-content').classList.remove('hidden');
  renderDashboard();

  // Re-render charts on theme toggle
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      setTimeout(() => {
        renderCharts();
        renderTeamChart(loadProjectData('sprint-team', []));
      }, 100);
    });
  }
});

// ─── Main Render ───
function renderDashboard() {
  const stories = loadProjectData('user-stories', []);
  const sprintsRaw = loadProjectData('sprint-board', []);
  const sprints = normalizeSprints(sprintsRaw);
  const risks = loadProjectData('risk-register', []);
  const sessions = loadProjectData('retro-sessions', []);
  const decisions = loadProjectData('decisions', []);
  const epics = loadProjectData('traceability', []);

  const team = loadProjectData('sprint-team', []);

  renderKPIs(stories, sprints, risks, sessions);
  renderCharts(stories, sprints);
  renderBoardSummary(sprints);
  renderTeamChart(team);
  renderEpicProgress(epics, stories);
  renderRiskSummary(risks);
  renderDecisions(decisions);
}

// ─── KPI Cards ───
function renderKPIs(stories, sprints, risks, sessions) {
  // Stories
  const total = stories.length;
  const done = stories.filter(s => s.status === 'Done').length;
  const inProgress = stories.filter(s => s.status === 'In Progress').length;
  const toDo = total - done - inProgress;
  document.getElementById('kpi-stories-count').textContent = total;
  document.getElementById('kpi-stories-breakdown').textContent = total
    ? `${done} done, ${inProgress} active, ${toDo} backlog`
    : 'No stories yet';

  // Sprint progress
  const activeSprint = sprints.find(s => s.status === 'active');
  if (activeSprint && activeSprint.items && activeSprint.items.length) {
    const sprintTotal = activeSprint.items.length;
    const sprintDone = activeSprint.items.filter(i => i.column === 'done').length;
    const pct = Math.round((sprintDone / sprintTotal) * 100);
    document.getElementById('kpi-sprint-pct').textContent = pct + '%';
    document.getElementById('kpi-sprint-label').textContent = activeSprint.name + ' -- ' + sprintDone + '/' + sprintTotal + ' items';
  } else if (activeSprint) {
    document.getElementById('kpi-sprint-pct').textContent = '0%';
    document.getElementById('kpi-sprint-label').textContent = activeSprint.name + ' -- empty';
  } else {
    document.getElementById('kpi-sprint-pct').textContent = '--';
    document.getElementById('kpi-sprint-label').textContent = 'No active sprint';
  }

  // Open risks
  const openRisks = risks.filter(r => r.status !== 'Closed');
  const highRisks = openRisks.filter(r => (r.probability || 3) * (r.impact || 3) >= 15);
  document.getElementById('kpi-risks-count').textContent = openRisks.length;
  document.getElementById('kpi-risks-label').textContent = openRisks.length
    ? (highRisks.length ? highRisks.length + ' high severity' : 'All manageable')
    : 'No risks tracked';

  // Action items from retro sessions
  let openActions = 0;
  let totalActions = 0;
  sessions.forEach(session => {
    if (session.actionItems) {
      session.actionItems.forEach(a => {
        totalActions++;
        if (a.status === 'Open') openActions++;
      });
    }
  });
  document.getElementById('kpi-actions-count').textContent = openActions;
  document.getElementById('kpi-actions-label').textContent = totalActions
    ? openActions + ' open of ' + totalActions + ' total'
    : 'No action items yet';
}

// ─── Charts ───
function renderCharts(stories, sprints) {
  // Get data if not passed (for theme toggle re-render)
  if (!stories) stories = loadProjectData('user-stories', []);
  if (!sprints) sprints = normalizeSprints(loadProjectData('sprint-board', []));

  renderStoryStatusChart(stories);
  renderPriorityChart(stories);
}

function renderStoryStatusChart(stories) {
  const canvas = document.getElementById('velocity-chart');
  const emptyEl = document.getElementById('velocity-empty');

  if (!stories.length) {
    canvas.style.display = 'none';
    emptyEl.classList.remove('hidden');
    if (velocityChart) { velocityChart.destroy(); velocityChart = null; }
    return;
  }

  canvas.style.display = 'block';
  emptyEl.classList.add('hidden');
  if (velocityChart) velocityChart.destroy();

  const statuses = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'];
  const counts = statuses.map(s => stories.filter(st => (st.status || 'Backlog') === s).length);

  const c = chartColors();
  const dark = isDark();
  velocityChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: statuses,
      datasets: [{
        label: 'Stories',
        data: counts,
        fill: true,
        backgroundColor: dark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)',
        borderColor: '#3b82f6',
        borderWidth: 2,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: dark ? '#1e293b' : '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: c.tooltipBg,
          titleColor: c.tooltipText,
          bodyColor: c.tooltipText,
          borderColor: c.tooltipBorder,
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          callbacks: {
            label: ctx => ' ' + ctx.raw + ' stor' + (ctx.raw === 1 ? 'y' : 'ies')
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: c.tick, font: { size: 11 } },
          border: { display: false },
        },
        y: {
          beginAtZero: true,
          grid: { color: c.grid },
          ticks: { color: c.tick, font: { size: 11 }, stepSize: 1 },
          border: { display: false },
        }
      }
    }
  });
}

function renderPriorityChart(stories) {
  const canvas = document.getElementById('priority-chart');
  const emptyEl = document.getElementById('priority-empty');

  if (!stories.length) {
    canvas.style.display = 'none';
    emptyEl.classList.remove('hidden');
    if (priorityChart) { priorityChart.destroy(); priorityChart = null; }
    return;
  }

  canvas.style.display = 'block';
  emptyEl.classList.add('hidden');
  if (priorityChart) priorityChart.destroy();

  const priorities = ['Must Have', 'Should Have', 'Could Have', "Won't Have"];
  const colors = ['#ef4444', '#f97316', '#3b82f6', '#6b7280'];
  const counts = priorities.map(p => stories.filter(s => s.priority === p).length);

  // Filter out zero-count segments
  const filtered = priorities.reduce((acc, p, i) => {
    if (counts[i] > 0) {
      acc.labels.push(p);
      acc.data.push(counts[i]);
      acc.colors.push(colors[i]);
    }
    return acc;
  }, { labels: [], data: [], colors: [] });

  const c = chartColors();
  priorityChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: filtered.labels,
      datasets: [{
        data: filtered.data,
        backgroundColor: filtered.colors,
        borderWidth: 0,
        spacing: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: c.legend,
            font: { size: 12 },
            padding: 16,
            usePointStyle: true,
            boxWidth: 10,
            boxHeight: 10,
          }
        },
        tooltip: {
          backgroundColor: c.tooltipBg,
          titleColor: c.tooltipText,
          bodyColor: c.tooltipText,
          borderColor: c.tooltipBorder,
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = Math.round((ctx.raw / total) * 100);
              return ' ' + ctx.label + ': ' + ctx.raw + ' (' + pct + '%)';
            }
          }
        }
      }
    }
  });
}

// ─── Sprint Board Summary ───
function renderBoardSummary(sprints) {
  const emptyEl = document.getElementById('board-summary-empty');
  const barsEl = document.getElementById('board-summary-bars');

  const activeSprint = sprints.find(s => s.status === 'active');
  const items = activeSprint?.items || [];

  if (!items.length) {
    emptyEl.classList.remove('hidden');
    barsEl.innerHTML = '';
    return;
  }
  emptyEl.classList.add('hidden');

  const columns = [
    { id: 'backlog', label: 'Backlog', color: 'bg-slate-400' },
    { id: 'todo', label: 'To Do', color: 'bg-blue-400' },
    { id: 'in-progress', label: 'In Progress', color: 'bg-amber-400' },
    { id: 'review', label: 'Review', color: 'bg-purple-400' },
    { id: 'done', label: 'Done', color: 'bg-emerald-400' },
  ];

  const total = items.length;
  let html = '';

  columns.forEach(col => {
    const count = items.filter(i => i.column === col.id).length;
    const pct = Math.round((count / total) * 100);
    html += `
      <div class="flex items-center gap-3">
        <span class="text-xs text-slate-500 dark:text-slate-400 w-24 text-right shrink-0">${col.label}</span>
        <div class="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-5 overflow-hidden">
          <div class="${col.color} h-full rounded-full transition-all duration-500" style="width:${pct}%"></div>
        </div>
        <span class="text-xs font-medium text-slate-600 dark:text-slate-300 w-10 text-right">${count}</span>
      </div>`;
  });

  barsEl.innerHTML = html;
}

// ─── Team Distribution ───
function renderTeamChart(team) {
  const canvas = document.getElementById('team-chart');
  const emptyEl = document.getElementById('team-empty');

  if (!team.length) {
    canvas.style.display = 'none';
    emptyEl.classList.remove('hidden');
    if (teamChart) { teamChart.destroy(); teamChart = null; }
    return;
  }

  canvas.style.display = 'block';
  emptyEl.classList.add('hidden');
  if (teamChart) teamChart.destroy();

  // Group by role
  const roleCounts = {};
  team.forEach(m => {
    const role = m.role || 'Unassigned';
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  });

  const labels = Object.keys(roleCounts);
  const data = Object.values(roleCounts);
  const palette = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
  const colors = labels.map((_, i) => palette[i % palette.length]);

  const c = chartColors();
  const bgColors = colors.map(col => col + '99');
  teamChart = new Chart(canvas, {
    type: 'polarArea',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: bgColors,
        borderColor: colors,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: c.legend,
            font: { size: 11 },
            padding: 10,
            usePointStyle: true,
            boxWidth: 8,
            boxHeight: 8,
          }
        },
        tooltip: {
          backgroundColor: c.tooltipBg,
          titleColor: c.tooltipText,
          bodyColor: c.tooltipText,
          borderColor: c.tooltipBorder,
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = Math.round((ctx.raw / total) * 100);
              return ' ' + ctx.label + ': ' + ctx.raw + ' (' + pct + '%)';
            }
          }
        }
      },
      scales: {
        r: {
          grid: { color: c.grid },
          ticks: { display: false, stepSize: 1 },
          beginAtZero: true,
        }
      }
    }
  });
}

// ─── Epic Progress ───
function renderEpicProgress(epics, stories) {
  const emptyEl = document.getElementById('epic-progress-empty');
  const listEl = document.getElementById('epic-progress-list');

  if (!epics.length) {
    emptyEl.classList.remove('hidden');
    listEl.innerHTML = '';
    return;
  }
  emptyEl.classList.add('hidden');

  const storyMap = new Map();
  stories.forEach(s => storyMap.set(s.id, s));

  const statusDefs = [
    { key: 'Backlog', color: 'bg-slate-400' },
    { key: 'To Do', color: 'bg-blue-400' },
    { key: 'In Progress', color: 'bg-amber-400' },
    { key: 'Review', color: 'bg-purple-400' },
    { key: 'Done', color: 'bg-emerald-500' },
  ];

  // Compute per-epic stats
  const epicStats = epics.map(epic => {
    const linkedIds = epic.linkedStories || [];
    const linked = linkedIds.map(id => storyMap.get(id)).filter(Boolean);
    const total = linked.length;
    const counts = {};
    statusDefs.forEach(s => { counts[s.key] = 0; });
    linked.forEach(s => {
      const st = s.status || 'Backlog';
      if (counts[st] !== undefined) counts[st]++;
      else counts['Backlog']++;
    });
    const done = counts['Done'];
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { epic, total, done, pct, counts };
  });

  // Summary stats
  const totalEpics = epicStats.length;
  const completedEpics = epicStats.filter(e => e.total > 0 && e.pct === 100).length;
  const inProgressEpics = epicStats.filter(e => e.pct > 0 && e.pct < 100).length;
  const notStarted = totalEpics - completedEpics - inProgressEpics;

  let html = '';

  // Summary row
  html += `<div class="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
    <div class="text-center">
      <div class="text-lg font-bold text-slate-800 dark:text-slate-100">${totalEpics}</div>
      <div class="text-[10px] uppercase tracking-wider text-slate-400">Total</div>
    </div>
    <div class="text-center">
      <div class="text-lg font-bold text-amber-500">${inProgressEpics}</div>
      <div class="text-[10px] uppercase tracking-wider text-slate-400">In Progress</div>
    </div>
    <div class="text-center">
      <div class="text-lg font-bold text-emerald-500">${completedEpics}</div>
      <div class="text-[10px] uppercase tracking-wider text-slate-400">Complete</div>
    </div>
  </div>`;

  // Sort: epics with stories first, then by least complete, then by most stories
  const sorted = [...epicStats].sort((a, b) => {
    const aHas = a.total > 0 ? 1 : 0;
    const bHas = b.total > 0 ? 1 : 0;
    if (bHas !== aHas) return bHas - aHas;
    if (a.total > 0 && b.total > 0) return a.pct - b.pct || b.total - a.total;
    return 0;
  });
  const SHOW_LIMIT = 5;
  const visible = sorted.slice(0, SHOW_LIMIT);
  const hasMore = sorted.length > SHOW_LIMIT;

  // Epic bars
  html += '<div id="epic-bars-container" class="space-y-3">';
  sorted.forEach((item, idx) => {
    const hidden = idx >= SHOW_LIMIT ? ' hidden epic-overflow' : '';
    let barSegments = '';
    if (item.total > 0) {
      statusDefs.forEach(s => {
        const pct = (item.counts[s.key] / item.total) * 100;
        if (pct > 0) {
          barSegments += `<div class="${s.color} h-full transition-all duration-500" style="width:${pct}%" title="${s.key}: ${item.counts[s.key]}"></div>`;
        }
      });
    }

    html += `
      <div class="${hidden}">
        <div class="flex items-center justify-between mb-1.5">
          <div class="flex items-center min-w-0 mr-2">
            <span class="text-xs font-mono text-slate-400 dark:text-slate-500 shrink-0 mr-1.5">${escapeHtmlShared(item.epic.id)}</span>
            <span class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">${escapeHtmlShared(item.epic.title || item.epic.id)}</span>
          </div>
          <span class="text-xs text-slate-400 shrink-0">${item.done}/${item.total} done</span>
        </div>
        <div class="flex rounded-full h-2.5 overflow-hidden bg-slate-100 dark:bg-slate-800">${barSegments}</div>
      </div>`;
  });
  html += '</div>';

  // Show more / less toggle
  if (hasMore) {
    html += `<button id="epic-toggle-btn" onclick="toggleEpicList()" class="w-full mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors text-center">Show all ${totalEpics} epics</button>`;
  }

  // Legend
  html += '<div class="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">';
  statusDefs.forEach(s => {
    html += `<div class="flex items-center gap-1"><span class="w-2 h-2 rounded-full ${s.color}"></span><span class="text-[10px] text-slate-400">${s.key}</span></div>`;
  });
  html += '</div>';

  listEl.innerHTML = html;
}

function toggleEpicList() {
  const overflows = document.querySelectorAll('.epic-overflow');
  const btn = document.getElementById('epic-toggle-btn');
  const expanded = !overflows[0]?.classList.contains('hidden');
  overflows.forEach(el => el.classList.toggle('hidden', expanded));
  btn.textContent = expanded ? 'Show all ' + (overflows.length + 5) + ' epics' : 'Show less';
}

// ─── Risk Summary (by status) ───
function renderRiskSummary(risks) {
  const emptyEl = document.getElementById('risk-summary-empty');
  const contentEl = document.getElementById('risk-summary-content');

  if (!risks.length) {
    emptyEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  contentEl.classList.remove('hidden');

  const statuses = [
    { key: 'Open', color: 'bg-blue-500', label: 'Open' },
    { key: 'Mitigating', color: 'bg-amber-500', label: 'Mitigating' },
    { key: 'Accepted', color: 'bg-slate-500', label: 'Accepted' },
    { key: 'Closed', color: 'bg-emerald-500', label: 'Closed' },
  ];

  const total = risks.length;
  let html = '';

  // Stacked status bar
  html += '<div class="flex rounded-full h-3 overflow-hidden mb-4">';
  statuses.forEach(s => {
    const count = risks.filter(r => r.status === s.key).length;
    const pct = (count / total) * 100;
    if (pct > 0) html += `<div class="${s.color} transition-all duration-500" style="width:${pct}%" title="${s.label}: ${count}"></div>`;
  });
  html += '</div>';

  // Legend + counts
  html += '<div class="grid grid-cols-2 gap-2">';
  statuses.forEach(s => {
    const count = risks.filter(r => r.status === s.key).length;
    html += `
      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full ${s.color} shrink-0"></span>
        <span class="text-xs text-slate-500 dark:text-slate-400">${s.label}</span>
        <span class="text-xs font-semibold text-slate-700 dark:text-slate-200 ml-auto">${count}</span>
      </div>`;
  });
  html += '</div>';

  // Top risks by severity
  const openRisks = risks.filter(r => r.status !== 'Closed')
    .map(r => ({ ...r, score: (r.probability || 3) * (r.impact || 3) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (openRisks.length) {
    html += '<div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">';
    html += '<p class="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Highest Severity</p>';
    openRisks.forEach(r => {
      const scoreColor = r.score >= 15 ? 'text-red-500' : r.score >= 8 ? 'text-amber-500' : 'text-emerald-500';
      html += `
        <div class="flex items-center gap-2 py-1.5">
          <span class="text-xs font-bold ${scoreColor} w-6 text-center">${r.score}</span>
          <span class="text-xs text-slate-600 dark:text-slate-300 truncate flex-1">${escapeHtmlShared(r.title || 'Untitled')}</span>
        </div>`;
    });
    html += '</div>';
  }

  contentEl.innerHTML = html;
}

// ─── Recent Decisions ───
function renderDecisions(decisions) {
  if (!decisions) decisions = loadProjectData('decisions', []);

  const emptyEl = document.getElementById('decisions-empty');
  const listEl = document.getElementById('decisions-list');

  if (!decisions.length) {
    emptyEl.classList.remove('hidden');
    listEl.innerHTML = '';
    return;
  }
  emptyEl.classList.add('hidden');

  // Sort by date descending, take last 5
  const sorted = [...decisions].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const recent = sorted.slice(0, 5);

  const statusColors = {
    'Active': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'Superseded': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'Reversed': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  let html = '';
  recent.forEach(d => {
    const badge = statusColors[d.status] || statusColors['Active'];
    const dateStr = d.date || '';
    html += `
      <div class="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
        <div class="flex-1 min-w-0">
          <p class="text-sm text-slate-700 dark:text-slate-200 truncate">${escapeHtmlShared(d.decision || d.context || 'Untitled')}</p>
          <p class="text-xs text-slate-400 mt-0.5">${dateStr}</p>
        </div>
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${badge} shrink-0">${d.status || 'Active'}</span>
      </div>`;
  });

  listEl.innerHTML = html;
}
