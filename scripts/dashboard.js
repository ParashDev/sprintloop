/* ── SprintLoop Dashboard ── */

let velocityChart = null;
let priorityChart = null;
let teamChart = null;
let burndownChart = null;

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
        const sprints = normalizeSprints(loadProjectData('sprint-board', []));
        renderCharts();
        renderBurndownChart(sprints);
        renderVelocityChart(sprints);
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
  renderBurndownChart(sprints);
  renderRoadmap(sprints, epics);
  renderVelocityChart(sprints);
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
  const velocityData = getCompletedSprintVelocity(sprints);
  const avgVelocity = velocityData.length > 0
    ? Math.round(velocityData.reduce((s, d) => s + d.delivered, 0) / velocityData.length)
    : 0;
  const velocitySuffix = avgVelocity > 0 ? ' | avg velocity: ' + avgVelocity + ' pts' : '';

  if (activeSprint && activeSprint.items && activeSprint.items.length) {
    const sprintTotal = activeSprint.items.length;
    const sprintDone = activeSprint.items.filter(i => i.column === 'done').length;
    const pct = Math.round((sprintDone / sprintTotal) * 100);
    document.getElementById('kpi-sprint-pct').textContent = pct + '%';
    document.getElementById('kpi-sprint-label').textContent = activeSprint.name + ' -- ' + sprintDone + '/' + sprintTotal + ' items' + velocitySuffix;
  } else if (activeSprint) {
    document.getElementById('kpi-sprint-pct').textContent = '0%';
    document.getElementById('kpi-sprint-label').textContent = activeSprint.name + ' -- empty' + velocitySuffix;
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

// ─── Sprint Burndown ───
function renderBurndownChart(sprints) {
  const canvas = document.getElementById('burndown-chart');
  const emptyEl = document.getElementById('burndown-empty');

  const activeSprint = sprints.find(s => s.status === 'active');
  const items = activeSprint?.items || [];
  const startDate = activeSprint?.startDate;
  // If no end date, estimate from sprint config or default to 14 days
  let endDate = activeSprint?.endDate;
  if (!endDate && startDate) {
    const config = loadProjectData('sprint-config', {});
    const sprintDays = config.days || 14;
    const estimated = new Date(startDate);
    estimated.setDate(estimated.getDate() + sprintDays);
    endDate = estimated.toISOString().slice(0, 10);
  }

  if (!activeSprint || !items.length || !startDate) {
    canvas.style.display = 'none';
    emptyEl.classList.remove('hidden');
    if (burndownChart) { burndownChart.destroy(); burndownChart = null; }
    return;
  }

  canvas.style.display = 'block';
  emptyEl.classList.add('hidden');
  if (burndownChart) burndownChart.destroy();

  // Build day-by-day labels from start to end
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const totalPoints = items.reduce((s, i) => s + (i.storyPoints || 0), 0);
  const totalDays = Math.max(1, Math.round((end - start) / 86400000));

  const labels = [];
  const idealData = [];
  const actualData = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayStr = d.toISOString().slice(0, 10);
    const dayNum = Math.round((d - start) / 86400000);
    labels.push(dayStr.slice(5)); // MM-DD
    idealData.push(Math.max(0, totalPoints - (totalPoints / totalDays) * dayNum));

    if (d <= today) {
      // Count points done by this day
      const doneByDay = items
        .filter(i => i.column === 'done' && i.doneAt && i.doneAt.slice(0, 10) <= dayStr)
        .reduce((s, i) => s + (i.storyPoints || 0), 0);
      actualData.push(totalPoints - doneByDay);
    } else {
      actualData.push(null);
    }
  }

  const c = chartColors();
  const dark = isDark();
  burndownChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Ideal',
          data: idealData.map(v => Math.round(v * 10) / 10),
          borderColor: dark ? '#475569' : '#cbd5e1',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          tension: 0,
          fill: false,
        },
        {
          label: 'Actual',
          data: actualData,
          borderColor: '#3b82f6',
          borderWidth: 2,
          backgroundColor: dark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.06)',
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: dark ? '#1e293b' : '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.2,
          fill: true,
          spanGaps: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: c.legend,
            font: { size: 11 },
            usePointStyle: true,
            boxWidth: 8,
            boxHeight: 8,
            padding: 16,
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
            label: ctx => ' ' + ctx.dataset.label + ': ' + (ctx.raw !== null ? ctx.raw + ' pts' : '--')
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: c.tick, font: { size: 10 }, maxRotation: 45 },
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

// ─── Sprint Roadmap ───
function renderRoadmap(sprints, epics) {
  const emptyEl = document.getElementById('roadmap-empty');
  const contentEl = document.getElementById('roadmap-content');

  // Only show sprints that have dates
  const dated = sprints.filter(s => s.startDate);
  if (!dated.length) {
    emptyEl.classList.remove('hidden');
    contentEl.classList.add('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  contentEl.classList.remove('hidden');

  // Build epic map from traceability data
  const epicMap = new Map();
  epics.forEach(e => epicMap.set(e.id, e));

  // For each sprint, find which epics have stories on the board
  const sprintEpics = dated.map(sprint => {
    const items = sprint.items || [];
    const epicIds = new Set();
    items.forEach(item => {
      if (item.storyId) {
        epics.forEach(epic => {
          if ((epic.linkedStories || []).includes(item.storyId)) {
            epicIds.add(epic.id);
          }
        });
      }
    });
    return { sprint, epicIds: [...epicIds] };
  });

  const statusColors = {
    active: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
    completed: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
    planned: 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50',
  };

  const statusBadge = {
    active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    planned: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  };

  let html = '<div class="space-y-3">';

  sprintEpics.forEach(({ sprint, epicIds }) => {
    const status = sprint.status || 'planned';
    const cardClass = statusColors[status] || statusColors.planned;
    const badgeClass = statusBadge[status] || statusBadge.planned;
    const dates = sprint.startDate + (sprint.endDate ? ' -- ' + sprint.endDate : '');
    const itemCount = (sprint.items || []).length;
    const doneCount = (sprint.items || []).filter(i => i.column === 'done').length;

    html += `
      <div class="border-l-4 ${cardClass} rounded-r-lg p-3">
        <div class="flex items-center justify-between mb-1.5">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">${escapeHtmlShared(sprint.name)}</span>
            <span class="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${badgeClass}">${status}</span>
          </div>
          <span class="text-[11px] text-slate-400">${doneCount}/${itemCount} items</span>
        </div>
        <p class="text-[11px] text-slate-400 mb-2">${dates}</p>
        ${epicIds.length ? `<div class="flex flex-wrap gap-1">${epicIds.map(id => {
          const epic = epicMap.get(id);
          const title = epic ? epic.title : id;
          return `<span class="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300" title="${escapeHtmlShared(title)}">${escapeHtmlShared(id)}</span>`;
        }).join('')}</div>` : '<p class="text-[10px] text-slate-400 italic">No epics linked</p>'}
      </div>`;
  });

  html += '</div>';
  contentEl.innerHTML = html;
}

// ─── Sprint Velocity ───
let sprintVelocityChart = null;

function getCompletedSprintVelocity(sprints) {
  return sprints
    .filter(s => s.status === 'completed' && s.items && s.items.length > 0)
    .sort((a, b) => (a.completedAt || a.createdAt || '').localeCompare(b.completedAt || b.createdAt || ''))
    .map(s => {
      const doneItems = s.items.filter(i => i.column === 'done');
      return {
        name: s.name,
        delivered: doneItems.reduce((sum, i) => sum + (i.storyPoints || 0), 0),
        committed: s.items.reduce((sum, i) => sum + (i.storyPoints || 0), 0),
        doneCount: doneItems.length,
        totalCount: s.items.length,
      };
    });
}

function renderVelocityChart(sprints) {
  const canvas = document.getElementById('sprint-velocity-chart');
  const emptyEl = document.getElementById('velocity-widget-empty');

  const data = getCompletedSprintVelocity(sprints);

  if (!data.length) {
    canvas.style.display = 'none';
    emptyEl.classList.remove('hidden');
    if (sprintVelocityChart) { sprintVelocityChart.destroy(); sprintVelocityChart = null; }
    return;
  }

  canvas.style.display = 'block';
  emptyEl.classList.add('hidden');
  if (sprintVelocityChart) sprintVelocityChart.destroy();

  const labels = data.map(d => d.name);
  const delivered = data.map(d => d.delivered);
  const committed = data.map(d => d.committed);
  const avg = delivered.reduce((s, v) => s + v, 0) / delivered.length;
  const avgLine = data.map(() => Math.round(avg * 10) / 10);

  const c = chartColors();
  const dark = isDark();

  sprintVelocityChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Committed',
          data: committed,
          backgroundColor: dark ? 'rgba(100, 116, 139, 0.3)' : 'rgba(203, 213, 225, 0.5)',
          borderColor: dark ? '#64748b' : '#cbd5e1',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.7,
          categoryPercentage: 0.8,
        },
        {
          label: 'Delivered',
          data: delivered,
          backgroundColor: dark ? 'rgba(16, 185, 129, 0.6)' : 'rgba(16, 185, 129, 0.5)',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.7,
          categoryPercentage: 0.8,
        },
        {
          label: 'Avg Velocity',
          data: avgLine,
          type: 'line',
          borderColor: dark ? '#f59e0b' : '#d97706',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
          tension: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: c.legend, boxWidth: 12, padding: 12, font: { size: 11 } },
        },
        tooltip: {
          backgroundColor: c.tooltipBg,
          titleColor: c.tooltipText,
          bodyColor: c.tooltipText,
          borderColor: c.tooltipBorder,
          borderWidth: 1,
          callbacks: {
            afterBody: function(context) {
              const idx = context[0].dataIndex;
              const d = data[idx];
              return d.doneCount + '/' + d.totalCount + ' items completed';
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: c.tick, font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: c.grid },
          ticks: { color: c.tick, font: { size: 11 } },
          title: { display: true, text: 'Story Points', color: c.tick, font: { size: 11 } },
        },
      },
    },
  });
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
