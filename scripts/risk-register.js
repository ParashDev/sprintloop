/* ── Risk Register & Heatmap ── */

const RISK_STORAGE_KEY = 'risk-register';

let risks = [];
let editingRiskId = null;

// ─── Constants ───

const CATEGORIES = ['Technical', 'Business', 'Resource', 'Schedule', 'External'];
const STATUSES = ['Open', 'Mitigating', 'Closed', 'Accepted'];

const CATEGORY_COLORS = {
  Technical: '#6366f1',
  Business: '#10b981',
  Resource: '#f59e0b',
  Schedule: '#06b6d4',
  External: '#f43f5e',
};

const CATEGORY_BADGE_CLASSES = {
  Technical: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  Business: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  Resource: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  Schedule: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
  External: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300',
};

const STATUS_BADGE_CLASSES = {
  Open: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  Mitigating: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
  Closed: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  Accepted: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300',
};

const PROBABILITY_LABELS = ['', 'Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];
const IMPACT_LABELS = ['', 'Negligible', 'Minor', 'Moderate', 'Major', 'Severe'];

// ─── Initialization ───

function initRiskRegister() {
  risks = migrateToolDataToProject(RISK_STORAGE_KEY, []);
  render();
}

// ─── Render (master) ───

function render() {
  renderSummaryCards();
  renderHeatmap();
  renderTable();
  updateOwnerFilter();
  toggleEmptyState();
}

// ─── Empty state toggle ───

function toggleEmptyState() {
  const emptyState = document.getElementById('empty-state');
  const heatmapSection = document.getElementById('heatmap-section');
  const tableSection = document.getElementById('risk-table-section');

  if (risks.length === 0) {
    emptyState.classList.remove('hidden');
    heatmapSection.classList.add('hidden');
    tableSection.classList.add('hidden');
  } else {
    emptyState.classList.add('hidden');
    heatmapSection.classList.remove('hidden');
    tableSection.classList.remove('hidden');
  }
}

// ─── Summary Cards ───

function renderSummaryCards() {
  const openRisks = risks.filter(r => r.status !== 'Closed');
  const high = openRisks.filter(r => r.score >= 15).length;
  const medium = openRisks.filter(r => r.score >= 8 && r.score <= 14).length;
  const low = openRisks.filter(r => r.score <= 7).length;

  document.getElementById('stat-total').textContent = openRisks.length;
  document.getElementById('stat-high').textContent = high;
  document.getElementById('stat-medium').textContent = medium;
  document.getElementById('stat-low').textContent = low;
}

// ─── Heatmap ───

function getScoreColor(score) {
  // Stronger, more saturated colors for a proper heatmap gradient
  if (score >= 15) return { light: '#fca5a5', dark: 'rgba(239,68,68,0.30)', zone: 'Critical' };
  if (score >= 10) return { light: '#fed7aa', dark: 'rgba(249,115,22,0.22)', zone: 'High' };
  if (score >= 5)  return { light: '#fef08a', dark: 'rgba(234,179,8,0.20)', zone: 'Medium' };
  return { light: '#bbf7d0', dark: 'rgba(34,197,94,0.25)', zone: 'Low' };
}

function renderHeatmap() {
  const container = document.getElementById('heatmap-container');
  if (!container) return;

  const isDark = document.documentElement.classList.contains('dark');

  // Build risks lookup keyed by "prob-impact"
  const cellMap = {};
  risks.forEach(r => {
    if (r.status === 'Closed') return;
    const key = r.probability + '-' + r.impact;
    if (!cellMap[key]) cellMap[key] = [];
    cellMap[key].push(r);
  });

  // Responsive: detect small screens
  const isSmall = window.innerWidth < 640;

  let html = '';

  // Outer wrapper: y-axis label + grid area, centered with reasonable size
  html += '<div style="display:flex; align-items:stretch; gap:0; max-width:' + (isSmall ? '100%' : '560px') + '; margin:0 auto;">';

  // Y-axis title (vertical text)
  html += '<div style="display:flex; align-items:center; justify-content:center; width:' + (isSmall ? '18px' : '24px') + '; shrink:0;">';
  html += '<span style="writing-mode:vertical-rl; transform:rotate(180deg); font-size:' + (isSmall ? '9px' : '11px') + '; font-weight:600; letter-spacing:0.1em; color:' + (isDark ? '#64748b' : '#94a3b8') + '; text-transform:uppercase;">Probability</span>';
  html += '</div>';

  // Grid area: y-labels + cells + x-labels
  html += '<div style="flex:1; min-width:0;">';

  // The 5x5 grid with y-axis labels
  for (let prob = 5; prob >= 1; prob--) {
    html += '<div style="display:flex; align-items:stretch; gap:' + (isSmall ? '3px' : '4px') + '; margin-bottom:' + (prob > 1 ? (isSmall ? '3px' : '4px') : '0') + ';">';

    // Y-axis label
    const yLabel = isSmall ? prob : prob + ' - ' + PROBABILITY_LABELS[prob];
    html += '<div style="display:flex; align-items:center; justify-content:flex-end; width:' + (isSmall ? '24px' : '100px') + '; padding-right:' + (isSmall ? '4px' : '8px') + '; flex-shrink:0;">';
    html += '<span style="font-size:' + (isSmall ? '10px' : '11px') + '; color:' + (isDark ? '#94a3b8' : '#64748b') + '; text-align:right; line-height:1.2; white-space:nowrap;">' + yLabel + '</span>';
    html += '</div>';

    // 5 cells for this probability row
    for (let impact = 1; impact <= 5; impact++) {
      const score = prob * impact;
      const color = getScoreColor(score);
      const key = prob + '-' + impact;
      const cellRisks = cellMap[key] || [];
      const cellBg = isDark ? color.dark : color.light;

      // Cell container
      html += '<div style="flex:1; aspect-ratio:1; min-width:0; background:' + cellBg + '; border-radius:' + (isSmall ? '6px' : '8px') + '; display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; cursor:default; transition:transform 0.15s ease, box-shadow 0.15s ease;" class="heatmap-cell-item">';

      if (cellRisks.length > 0) {
        // Risk dots -- larger and better spaced
        html += '<div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:' + (isSmall ? '3px' : '4px') + '; padding:' + (isSmall ? '2px' : '4px') + ';">';
        cellRisks.forEach(r => {
          const dotColor = CATEGORY_COLORS[r.category] || '#6366f1';
          const dotSize = isSmall ? '8px' : '10px';
          html += '<span class="tooltip" style="display:inline-block; width:' + dotSize + '; height:' + dotSize + '; border-radius:50%; background:' + dotColor + '; box-shadow:0 0 0 2px ' + (isDark ? 'rgba(15,23,42,0.6)' : 'rgba(255,255,255,0.8)') + '; cursor:pointer;" data-tooltip="' + escapeHtml(r.title) + '"></span>';
        });
        html += '</div>';

        // Risk count badge (bottom-right)
        if (cellRisks.length > 1) {
          html += '<span style="position:absolute; bottom:2px; right:3px; font-size:9px; font-weight:700; color:' + (isDark ? '#94a3b8' : '#64748b') + '; opacity:0.7; line-height:1;">' + cellRisks.length + '</span>';
        }
      } else {
        // Empty cell: show score number
        html += '<span style="font-size:' + (isSmall ? '11px' : '13px') + '; font-weight:600; color:' + (isDark ? '#475569' : '#cbd5e1') + '; line-height:1;">' + score + '</span>';
      }

      html += '</div>';
    }

    html += '</div>';
  }

  // X-axis labels
  html += '<div style="display:flex; gap:' + (isSmall ? '3px' : '4px') + '; margin-top:' + (isSmall ? '4px' : '6px') + ';">';
  // Spacer for y-axis label column
  html += '<div style="width:' + (isSmall ? '24px' : '100px') + '; flex-shrink:0;"></div>';
  for (let impact = 1; impact <= 5; impact++) {
    const xLabel = isSmall ? impact : IMPACT_LABELS[impact];
    html += '<div style="flex:1; min-width:0; text-align:center;">';
    html += '<span style="font-size:' + (isSmall ? '10px' : '11px') + '; color:' + (isDark ? '#94a3b8' : '#64748b') + '; line-height:1.2;">' + xLabel + '</span>';
    html += '</div>';
  }
  html += '</div>';

  // X-axis title
  html += '<p style="text-align:center; margin-top:' + (isSmall ? '2px' : '4px') + '; font-size:' + (isSmall ? '9px' : '11px') + '; font-weight:600; letter-spacing:0.1em; color:' + (isDark ? '#64748b' : '#94a3b8') + '; text-transform:uppercase;">Impact</p>';

  html += '</div>'; // end grid area
  html += '</div>'; // end outer wrapper

  container.innerHTML = html;

  // Zone legend (rendered dynamically so it respects dark mode)
  const zoneLegend = document.getElementById('heatmap-zone-legend');
  if (zoneLegend) {
    const zones = [
      { label: 'Low (1-4)', light: '#bbf7d0', dark: 'rgba(34,197,94,0.25)' },
      { label: 'Medium (5-9)', light: '#fef08a', dark: 'rgba(234,179,8,0.20)' },
      { label: 'High (10-14)', light: '#fed7aa', dark: 'rgba(249,115,22,0.22)' },
      { label: 'Critical (15-25)', light: '#fca5a5', dark: 'rgba(239,68,68,0.30)' },
    ];
    zoneLegend.innerHTML = zones.map(z =>
      '<span class="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">' +
      '<span style="display:inline-block; width:12px; height:8px; border-radius:2px; background:' + (isDark ? z.dark : z.light) + ';"></span> ' + z.label + '</span>'
    ).join('');
  }
}

// Re-render heatmap on resize for responsive label switching
let _heatmapResizeTimer = null;
window.addEventListener('resize', function() {
  clearTimeout(_heatmapResizeTimer);
  _heatmapResizeTimer = setTimeout(renderHeatmap, 200);
});

// ─── Risk Table ───

function renderTable() {
  const tbody = document.getElementById('risk-table-body');
  const filtered = getFilteredRisks();

  if (risks.length > 0 && filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-12 text-sm text-slate-500 dark:text-slate-500">No risks match the current filters.</td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(risk => {
    const scoreColor = getScoreCellClass(risk.score);
    const catBadge = CATEGORY_BADGE_CLASSES[risk.category] || '';
    const statusBadge = STATUS_BADGE_CLASSES[risk.status] || '';

    return `
      <tr class="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
        <td class="px-4 py-3">
          <p class="text-sm font-medium text-slate-900 dark:text-white">${escapeHtml(risk.title)}</p>
          ${risk.description ? `<p class="text-xs text-slate-500 dark:text-slate-500 mt-0.5 truncate max-w-[240px]">${escapeHtml(risk.description)}</p>` : ''}
        </td>
        <td class="px-4 py-3">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${catBadge}">${risk.category}</span>
        </td>
        <td class="px-4 py-3 text-center text-sm text-slate-700 dark:text-slate-300">${risk.probability}</td>
        <td class="px-4 py-3 text-center text-sm text-slate-700 dark:text-slate-300">${risk.impact}</td>
        <td class="px-4 py-3 text-center">
          <span class="inline-flex items-center justify-center w-9 h-7 rounded-md text-xs font-bold ${scoreColor}">${risk.score}</span>
        </td>
        <td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">${escapeHtml(risk.owner || '--')}</td>
        <td class="px-4 py-3">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge}">${risk.status}</span>
        </td>
        <td class="px-4 py-3 text-right">
          <div class="flex items-center justify-end gap-1">
            <button onclick="editRisk('${risk.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Edit risk">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button onclick="deleteRisk('${risk.id}')" class="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" aria-label="Delete risk">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function getScoreCellClass(score) {
  if (score >= 15) return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300';
  if (score >= 10) return 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300';
  if (score >= 5) return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300';
  return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300';
}

// ─── Filtering and Sorting ───

function getFilteredRisks() {
  const categoryVal = document.getElementById('filter-category').value;
  const statusVal = document.getElementById('filter-status').value;
  const ownerVal = document.getElementById('filter-owner').value;
  const sortVal = document.getElementById('sort-by').value;

  let filtered = risks.filter(r => {
    if (categoryVal && r.category !== categoryVal) return false;
    if (statusVal && r.status !== statusVal) return false;
    if (ownerVal && r.owner !== ownerVal) return false;
    return true;
  });

  // Sort
  filtered = [...filtered].sort((a, b) => {
    if (sortVal === 'score') return b.score - a.score;
    if (sortVal === 'category') return a.category.localeCompare(b.category);
    if (sortVal === 'status') {
      const order = { Open: 0, Mitigating: 1, Accepted: 2, Closed: 3 };
      return (order[a.status] ?? 9) - (order[b.status] ?? 9);
    }
    return 0;
  });

  return filtered;
}

function updateOwnerFilter() {
  const owners = [...new Set(risks.map(r => r.owner).filter(o => o && o.trim()))].sort();

  ['filter-owner', 'filter-owner-mobile'].forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    const currentVal = select.value;
    const defaultLabel = id.includes('mobile') ? 'Owner' : 'All Owners';

    let html = `<option value="">${defaultLabel}</option>`;
    owners.forEach(owner => {
      const selected = owner === currentVal ? ' selected' : '';
      html += `<option value="${escapeHtml(owner)}"${selected}>${escapeHtml(owner)}</option>`;
    });
    select.innerHTML = html;
  });
}

function handleFilter() {
  renderTable();
}

function syncMobileFilter(type) {
  const map = {
    category: ['filter-category-mobile', 'filter-category'],
    status: ['filter-status-mobile', 'filter-status'],
    owner: ['filter-owner-mobile', 'filter-owner'],
  };
  const [mobileId, desktopId] = map[type] || [];
  if (!mobileId || !desktopId) return;
  const mobile = document.getElementById(mobileId);
  const desktop = document.getElementById(desktopId);
  if (mobile && desktop) {
    desktop.value = mobile.value;
    handleFilter();
  }
}

// ─── Form Handling ───

function openRiskForm(riskToEdit) {
  editingRiskId = riskToEdit ? riskToEdit.id : null;

  document.getElementById('modal-title').textContent = editingRiskId ? 'Edit Risk' : 'New Risk';
  document.getElementById('risk-id').value = editingRiskId || '';
  document.getElementById('risk-title').value = riskToEdit ? riskToEdit.title : '';
  document.getElementById('risk-description').value = riskToEdit ? riskToEdit.description : '';
  document.getElementById('risk-category').value = riskToEdit ? riskToEdit.category : 'Technical';
  document.getElementById('risk-probability').value = riskToEdit ? riskToEdit.probability : '3';
  document.getElementById('risk-impact').value = riskToEdit ? riskToEdit.impact : '3';
  document.getElementById('risk-mitigation').value = riskToEdit ? riskToEdit.mitigationPlan : '';
  document.getElementById('risk-owner').value = riskToEdit ? riskToEdit.owner : '';
  document.getElementById('risk-status').value = riskToEdit ? riskToEdit.status : 'Open';

  updateScorePreview();
  openModal('risk-modal');

  setTimeout(() => document.getElementById('risk-title').focus(), 100);
}

function updateScorePreview() {
  const prob = parseInt(document.getElementById('risk-probability').value, 10) || 1;
  const impact = parseInt(document.getElementById('risk-impact').value, 10) || 1;
  const score = prob * impact;

  const preview = document.getElementById('risk-score-preview');
  const label = document.getElementById('risk-score-label');

  preview.textContent = score;

  // Color the preview badge by score level
  preview.className = 'inline-flex items-center justify-center w-12 h-10 rounded-lg text-sm font-bold border';
  if (score >= 15) {
    preview.classList.add('bg-red-100', 'dark:bg-red-900/40', 'text-red-700', 'dark:text-red-300', 'border-red-300', 'dark:border-red-800');
    label.textContent = 'High Risk';
  } else if (score >= 10) {
    preview.classList.add('bg-orange-100', 'dark:bg-orange-900/40', 'text-orange-700', 'dark:text-orange-300', 'border-orange-300', 'dark:border-orange-800');
    label.textContent = 'Medium-High Risk';
  } else if (score >= 5) {
    preview.classList.add('bg-yellow-100', 'dark:bg-yellow-900/40', 'text-yellow-700', 'dark:text-yellow-300', 'border-yellow-300', 'dark:border-yellow-800');
    label.textContent = 'Medium Risk';
  } else {
    preview.classList.add('bg-emerald-100', 'dark:bg-emerald-900/40', 'text-emerald-700', 'dark:text-emerald-300', 'border-emerald-300', 'dark:border-emerald-800');
    label.textContent = 'Low Risk';
  }
}

function handleSaveRisk(event) {
  event.preventDefault();

  const title = document.getElementById('risk-title').value.trim();
  const description = document.getElementById('risk-description').value.trim();
  const category = document.getElementById('risk-category').value;
  const probability = parseInt(document.getElementById('risk-probability').value, 10);
  const impact = parseInt(document.getElementById('risk-impact').value, 10);
  const score = probability * impact;
  const mitigationPlan = document.getElementById('risk-mitigation').value.trim();
  const owner = document.getElementById('risk-owner').value.trim();
  const status = document.getElementById('risk-status').value;

  if (!title) {
    showToast('Title is required', 'error');
    return;
  }

  if (editingRiskId) {
    // Update existing risk
    const idx = risks.findIndex(r => r.id === editingRiskId);
    if (idx !== -1) {
      const oldScore = risks[idx].score;
      const history = risks[idx].history || [];

      // Track score changes
      if (oldScore !== score) {
        history.push({
          date: new Date().toISOString(),
          oldScore: oldScore,
          newScore: score,
        });
      }

      risks[idx] = {
        ...risks[idx],
        title,
        description,
        category,
        probability,
        impact,
        score,
        mitigationPlan,
        owner,
        status,
        history,
      };
    }
    showToast('Risk updated', 'success');
  } else {
    // Create new risk
    const risk = {
      id: uid(),
      title,
      description,
      category,
      probability,
      impact,
      score,
      mitigationPlan,
      owner,
      status,
      createdAt: new Date().toISOString(),
      history: [],
    };
    risks.push(risk);
    showToast('Risk created', 'success');
  }

  saveProjectData(RISK_STORAGE_KEY, risks);
  closeModal('risk-modal');
  editingRiskId = null;
  render();
}


// ─── CRUD ───

function editRisk(id) {
  const risk = risks.find(r => r.id === id);
  if (!risk) return;
  openRiskForm(risk);
}

function deleteRisk(id) {
  if (!confirmAction('Delete this risk? This cannot be undone.')) return;
  risks = risks.filter(r => r.id !== id);
  saveProjectData(RISK_STORAGE_KEY, risks);
  showToast('Risk deleted', 'info');
  render();
}

// ─── CSV Export ───

function handleExportCSV() {
  const filtered = getFilteredRisks();
  if (filtered.length === 0) {
    showToast('No risks to export', 'error');
    return;
  }

  const headers = ['Title', 'Description', 'Category', 'Probability', 'Impact', 'Score', 'Mitigation Plan', 'Owner', 'Status'];

  const rows = filtered.map(r => [
    r.title,
    r.description,
    r.category,
    r.probability,
    r.impact,
    r.score,
    r.mitigationPlan,
    r.owner,
    r.status,
  ]);

  exportCSV('risk-register.csv', headers, rows);
}

// ─── AI: Project Docs for Risk Analysis ───

// For risk identification, more sections matter than for epics --
// assumptions, constraints, dependencies, and scope are direct risk sources
const RISK_RELEVANT_SECTIONS = [
  'product overview',
  'functional requirements',
  'non-functional requirements',
  'assumptions', 'constraints', 'assumptions & constraints', 'assumptions and constraints',
  'business requirements',
  'business objectives',
  'dependencies',
  'scope',
];

function getProjectDocsForRisks() {
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

function formatDocsForRiskAI(docs) {
  if (!docs) return '';
  let ctx = '';
  if (docs.projectName) ctx += 'Project: ' + docs.projectName + '\n';
  if (docs.projectDescription) ctx += 'Description: ' + docs.projectDescription + '\n';
  if (docs.prd) {
    const relevant = docs.prd.sections.filter(s =>
      RISK_RELEVANT_SECTIONS.some(k => s.title.toLowerCase().includes(k))
    );
    if (relevant.length > 0) {
      ctx += '\n=== PRD (Product Requirements Document) ===\n';
      relevant.forEach(s => { ctx += '\n## ' + s.title + '\n' + s.content + '\n'; });
    }
  }
  if (docs.brd) {
    const relevant = docs.brd.sections.filter(s =>
      RISK_RELEVANT_SECTIONS.some(k => s.title.toLowerCase().includes(k))
    );
    if (relevant.length > 0) {
      ctx += '\n=== BRD (Business Requirements Document) ===\n';
      relevant.forEach(s => { ctx += '\n## ' + s.title + '\n' + s.content + '\n'; });
    }
  }
  return ctx;
}

function isRiskRelevantSection(title) {
  const lower = title.toLowerCase();
  return RISK_RELEVANT_SECTIONS.some(s => lower.includes(s));
}

// ─── AI: Identify Risks ───

function openAiRiskInput() {
  if (!ensureApiKey()) return;

  const docs = getProjectDocsForRisks();
  const hasPrd = !!(docs?.prd);
  const hasBrd = !!(docs?.brd);
  const hasDocs = hasPrd || hasBrd;

  // Recreate modal each time so doc status is fresh
  let modal = document.getElementById('ai-risk-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'ai-risk-modal';
  modal.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 items-center justify-center p-4';

  const prdStatus = hasPrd
    ? '<span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span><span>PRD (' + docs.prd.sections.length + ' sections)</span>'
    : '<span class="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0"></span><span class="text-slate-400 dark:text-slate-500">PRD not generated</span>';
  const brdStatus = hasBrd
    ? '<span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span><span>BRD (' + docs.brd.sections.length + ' sections)</span>'
    : '<span class="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0"></span><span class="text-slate-400 dark:text-slate-500">BRD not generated</span>';

  // Build collapsible preview showing only sections the AI will analyze
  let previewHtml = '';
  if (hasDocs) {
    const relevantSections = [];
    if (hasPrd) docs.prd.sections.filter(s => isRiskRelevantSection(s.title)).forEach(s => relevantSections.push({ doc: 'PRD', title: s.title, content: s.content }));
    if (hasBrd) docs.brd.sections.filter(s => isRiskRelevantSection(s.title)).forEach(s => relevantSections.push({ doc: 'BRD', title: s.title, content: s.content }));

    if (relevantSections.length > 0) {
      previewHtml = `
        <div class="border-t border-slate-100 dark:border-slate-800 mt-3 pt-1">
          <button onclick="document.getElementById('ai-risk-preview-body').classList.toggle('hidden'); this.querySelector('svg').style.transform = document.getElementById('ai-risk-preview-body').classList.contains('hidden') ? '' : 'rotate(180deg)'"
            class="w-full flex items-center justify-between py-2 text-left">
            <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Sections sent to AI (${relevantSections.length})</span>
            <svg class="w-3.5 h-3.5 text-slate-400 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div id="ai-risk-preview-body" class="hidden space-y-2 pb-2 max-h-[200px] overflow-y-auto">
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
      <p class="text-xs text-amber-700 dark:text-amber-400">No PRD or BRD found for the active project. Generate documents in Business Docs first for comprehensive risk analysis, or describe the project manually below.</p>
    </div>` : '';

  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[85vh] flex flex-col" onclick="event.stopPropagation()">
      <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white">AI Risk Identification</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${hasDocs ? 'Analyzes your PRD and BRD to identify project risks' : 'Describe your project to identify potential risks'}</p>
      </div>
      <div class="flex-1 overflow-y-auto min-h-0">
        <div class="px-6 pt-4 space-y-3">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">${prdStatus}</div>
            <div class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">${brdStatus}</div>
          </div>
          ${noDocsWarning}
          ${previewHtml}
        </div>
        <div class="px-6 py-4">
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">${hasDocs ? 'Additional context or focus areas (optional)' : 'Describe your project or feature'}</label>
          <textarea id="ai-risk-prompt" rows="${hasDocs ? 2 : 4}" placeholder="${hasDocs ? 'e.g., Focus on third-party integration risks, or We are particularly concerned about data privacy compliance...' : 'e.g., Building a mobile payment system with third-party API integration...'}"
            class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-y"></textarea>
        </div>
      </div>
      <div class="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <span class="text-xs text-slate-400 dark:text-slate-500">Identifies 5-10 risks across categories</span>
        <div class="flex items-center gap-3">
          <button onclick="closeModal('ai-risk-modal')" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
          <button id="btn-ai-risk-generate" onclick="handleAiRiskGenerate()" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 dark:bg-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 text-white text-sm font-semibold transition-colors">${AI_ICON} Identify Risks</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);
  openModal('ai-risk-modal');
  setTimeout(() => document.getElementById('ai-risk-prompt').focus(), 100);
}

async function handleAiRiskGenerate() {
  const prompt = document.getElementById('ai-risk-prompt').value.trim();
  const docs = getProjectDocsForRisks();
  const hasDocs = !!(docs?.prd || docs?.brd);

  if (!hasDocs && !prompt) {
    showToast('Add PRD/BRD in Business Docs or describe the project', 'error');
    return;
  }

  const btn = document.getElementById('btn-ai-risk-generate');
  setAiButtonLoading(btn, true);

  try {
    const docsCtx = hasDocs ? formatDocsForRiskAI(docs) : '';
    const existingRisks = risks.length > 0
      ? '\n\nExisting Risks (do NOT duplicate these):\n' + risks.map(r => '- ' + r.title).join('\n')
      : '';

    const systemPrompt = `You are a senior risk analyst who identifies project risks from product and business requirements documents.

Analyze the provided requirements (PRD and/or BRD) and identify risks across all categories:
- Technical: architecture complexity, integration points, new/unproven technology, performance bottlenecks, security vulnerabilities
- Business: market changes, competitor actions, revenue impact, stakeholder alignment, regulatory/compliance
- Resource: team capacity, skill gaps, key person dependencies, budget constraints
- Schedule: timeline pressure, dependency delays, scope creep, estimation uncertainty
- External: third-party APIs/vendors, regulatory changes, market conditions, user adoption

Rules:
- Derive risks directly from the requirements -- cite which requirement or section drives each risk
- Probability (1-5): 1=Rare, 2=Unlikely, 3=Possible, 4=Likely, 5=Almost Certain
- Impact (1-5): 1=Negligible, 2=Minor, 3=Moderate, 4=Major, 5=Severe
- Each mitigation should be a concrete, actionable step (not generic advice)
- Identify 5-10 risks covering multiple categories
- Do NOT duplicate existing risks listed below

Return ONLY valid JSON (no markdown, no code blocks):
{"risks":[{"title":"string","description":"string","category":"Technical|Business|Resource|Schedule|External","probability":1-5,"impact":1-5,"mitigation":"string"}]}${existingRisks}`;

    const userMessage = hasDocs
      ? docsCtx + (prompt ? '\n\nAdditional Context:\n' + prompt : '')
      : prompt;

    const result = await callOpenRouterAPI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], null, 16000, 0.7);

    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.risks || !Array.isArray(parsed.risks) || parsed.risks.length === 0) {
      showToast('No risks identified', 'info');
      return;
    }

    closeModal('ai-risk-modal');
    showAiRiskReview(parsed.risks);
  } catch (err) {
    showToast('AI error: ' + err.message, 'error');
  } finally {
    setAiButtonLoading(btn, false);
  }
}

function showAiRiskReview(aiRisks) {
  let panel = document.getElementById('ai-risk-review');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'ai-risk-review';
    const actionBar = document.getElementById('action-bar');
    actionBar.after(panel);
  }

  window._aiRisksPending = aiRisks;

  const risksHtml = aiRisks.map(r => {
    const score = (r.probability || 3) * (r.impact || 3);
    const scoreColor = score >= 15 ? 'text-red-500' : score >= 10 ? 'text-orange-500' : score >= 5 ? 'text-yellow-500' : 'text-emerald-500';
    return `
      <div class="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <p class="text-sm font-medium text-slate-900 dark:text-white">${escapeHtml(r.title)}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${escapeHtml(r.description || '')}</p>
        <div class="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
          <span>${escapeHtml(r.category || 'Technical')}</span>
          <span>P:${r.probability || 3} I:${r.impact || 3}</span>
          <span class="font-bold ${scoreColor}">Score: ${score}</span>
        </div>
        ${r.mitigation ? '<p class="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">Mitigation: ' + escapeHtml(r.mitigation) + '</p>' : ''}
      </div>
    `;
  }).join('');

  panel.className = 'ai-results-panel mb-6';
  panel.innerHTML = `
    <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">AI Identified Risks (${aiRisks.length})</h3>
        <button onclick="document.getElementById('ai-risk-review').remove()" class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="space-y-2">${risksHtml}</div>
      <div class="flex items-center gap-3 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
        <button onclick="addAllAiRisks()" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 dark:bg-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 text-white text-sm font-semibold transition-colors">Add All to Register</button>
        <button onclick="document.getElementById('ai-risk-review').remove()" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Dismiss</button>
      </div>
    </div>
  `;
}

function addAllAiRisks() {
  const aiRisks = window._aiRisksPending;
  if (!aiRisks || aiRisks.length === 0) return;

  aiRisks.forEach(r => {
    const prob = Math.max(1, Math.min(5, r.probability || 3));
    const impact = Math.max(1, Math.min(5, r.impact || 3));
    risks.push({
      id: uid(),
      title: r.title || 'Untitled Risk',
      description: r.description || '',
      category: CATEGORIES.includes(r.category) ? r.category : 'Technical',
      probability: prob,
      impact: impact,
      score: prob * impact,
      mitigationPlan: r.mitigation || '',
      owner: '',
      status: 'Open',
      createdAt: new Date().toISOString(),
      history: [],
    });
  });

  saveProjectData(RISK_STORAGE_KEY, risks);
  render();
  showToast(aiRisks.length + ' risks added');

  const panel = document.getElementById('ai-risk-review');
  if (panel) panel.remove();
  window._aiRisksPending = null;
}

// ─── Utilities ───

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
