/* ── Business Documents (PRD & BRD Generator) ── */

const BIZDOCS_STORAGE_KEY = 'business-docs';

let store = null;          // { activeProjectId, projects: [...] }
let activeDocTab = 'prd';
let editingSectionKey = null;

// ─── Helpers ───

function getStore() {
  return store;
}

function getActiveProject() {
  if (!store || !store.projects.length) return null;
  return store.projects.find(p => p.id === store.activeProjectId) || null;
}

function persist() {
  saveData(BIZDOCS_STORAGE_KEY, store);
}

// ─── Migration from old single-project format ───

function migrateIfNeeded(raw) {
  if (!raw) return null;
  // Old format had projectName at the top level (no projects array)
  if (raw.projectName !== undefined && !raw.projects) {
    const id = uid();
    return {
      activeProjectId: id,
      projects: [{
        id: id,
        projectName: raw.projectName || '',
        projectDescription: raw.projectDescription || '',
        createdAt: new Date().toISOString(),
        prd: raw.prd || null,
        brd: raw.brd || null,
      }],
    };
  }
  return raw;
}

// ─── Initialization ───

function initBusinessDocs() {
  const raw = loadData(BIZDOCS_STORAGE_KEY, null);
  store = migrateIfNeeded(raw) || { activeProjectId: null, projects: [] };
  // If migrated, persist the new format
  if (raw && raw.projectName !== undefined && !raw.projects) {
    persist();
  }
  render();
}

// ─── Render (master) ───

function render() {
  renderProjectSwitcher();
  renderStats();
  renderProjectForm();
  renderDocSections('prd');
  renderDocSections('brd');
  updateTabStyles();
  toggleEmptyState();
}

// ─── Project Switcher ───

function renderProjectSwitcher() {
  const container = document.getElementById('project-switcher-list');
  if (!container) return;

  if (store.projects.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = store.projects.map(p => {
    const isActive = p.id === store.activeProjectId;
    const hasPrd = !!(p.prd && p.prd.sections && p.prd.sections.length);
    const hasBrd = !!(p.brd && p.brd.sections && p.brd.sections.length);

    const activeRing = isActive
      ? 'ring-2 ring-slate-900 dark:ring-white border-transparent'
      : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600';

    return `
      <button onclick="selectProject('${p.id}')" class="group relative flex flex-col items-start p-3 rounded-xl border ${activeRing} bg-white dark:bg-slate-900 min-w-[180px] max-w-[220px] shrink-0 text-left transition-all">
        ${isActive ? '<span class="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400"></span>' : ''}
        <span class="text-sm font-semibold text-slate-900 dark:text-white truncate w-full">${escapeHtml(p.projectName || 'Untitled')}</span>
        <span class="text-xs text-slate-400 dark:text-slate-500 mt-1">${hasPrd ? 'PRD' : '--'} / ${hasBrd ? 'BRD' : '--'}</span>
        <div class="flex items-center gap-1.5 mt-2">
          ${hasPrd ? '<span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>' : '<span class="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>'}
          ${hasBrd ? '<span class="w-1.5 h-1.5 rounded-full bg-violet-400"></span>' : '<span class="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>'}
        </div>
      </button>`;
  }).join('');
}

function selectProject(id) {
  store.activeProjectId = id;
  persist();
  editingSectionKey = null;
  render();
}

function createNewProject() {
  const id = uid();
  store.projects.push({
    id: id,
    projectName: '',
    projectDescription: '',
    createdAt: new Date().toISOString(),
    prd: null,
    brd: null,
  });
  store.activeProjectId = id;
  persist();
  editingSectionKey = null;
  render();
  expandProjectSection();
  // Focus the name input
  setTimeout(() => {
    const nameInput = document.getElementById('project-name');
    if (nameInput) nameInput.focus();
  }, 50);
  showToast('New project created');
}

function deleteProject() {
  const project = getActiveProject();
  if (!project) return;
  const name = project.projectName || 'Untitled';
  if (!confirmAction('Delete project "' + name + '" and all its documents and tool data (risks, stories, epics, sprint items, etc.)? This cannot be undone.')) return;

  deleteProjectToolData(project.id);
  store.projects = store.projects.filter(p => p.id !== project.id);
  // Select another project or clear
  store.activeProjectId = store.projects.length > 0 ? store.projects[0].id : null;
  persist();
  editingSectionKey = null;
  render();
  showToast('Project deleted', 'info');
}

// ─── Project Section Toggle ───

function toggleProjectSection() {
  const body = document.getElementById('project-section-body');
  const chevron = document.getElementById('project-section-chevron');
  if (!body) return;
  const isHidden = body.classList.contains('hidden');
  body.classList.toggle('hidden');
  if (chevron) chevron.style.transform = isHidden ? 'rotate(180deg)' : '';
}

function expandProjectSection() {
  const body = document.getElementById('project-section-body');
  const chevron = document.getElementById('project-section-chevron');
  if (body) body.classList.remove('hidden');
  if (chevron) chevron.style.transform = 'rotate(180deg)';
}

function collapseProjectSection() {
  const body = document.getElementById('project-section-body');
  const chevron = document.getElementById('project-section-chevron');
  if (body) body.classList.add('hidden');
  if (chevron) chevron.style.transform = '';
}

// ─── Stats Dashboard ───

function renderStats() {
  const project = getActiveProject();
  const totalProjects = store.projects.length;
  const hasPrd = !!(project && project.prd && project.prd.sections && project.prd.sections.length > 0);
  const hasBrd = !!(project && project.brd && project.brd.sections && project.brd.sections.length > 0);
  const prdCount = hasPrd ? project.prd.sections.length : 0;
  const brdCount = hasBrd ? project.brd.sections.length : 0;

  document.getElementById('stat-project').textContent = totalProjects;
  document.getElementById('stat-prd').textContent = hasPrd ? 'Generated' : 'Not set';
  document.getElementById('stat-brd').textContent = hasBrd ? 'Generated' : 'Not set';
  document.getElementById('stat-sections').textContent = prdCount + brdCount;
}

// ─── Project Form ───

function renderProjectForm() {
  const project = getActiveProject();
  const nameInput = document.getElementById('project-name');
  const descInput = document.getElementById('project-description');
  const formSection = document.getElementById('project-section');

  if (!project) {
    if (formSection) formSection.classList.add('hidden');
    return;
  }

  if (formSection) formSection.classList.remove('hidden');
  nameInput.value = project.projectName || '';
  descInput.value = project.projectDescription || '';

  // Auto-expand for projects with no name yet, collapse for saved ones
  if (!project.projectName) {
    expandProjectSection();
  } else {
    collapseProjectSection();
  }
}

function saveProjectDescription() {
  const project = getActiveProject();
  if (!project) {
    showToast('Create a project first', 'error');
    return;
  }

  const name = document.getElementById('project-name').value.trim();
  const desc = document.getElementById('project-description').value.trim();

  if (!name || !desc) {
    showToast('Enter both a project name and description', 'error');
    return;
  }

  project.projectName = name;
  project.projectDescription = desc;
  persist();
  renderStats();
  renderProjectSwitcher();
  toggleEmptyState();
  collapseProjectSection();
  showToast('Project description saved');
}

// ─── Document Section Rendering ───

function renderDocSections(docType) {
  const contentEl = document.getElementById(docType + '-content');
  const emptyEl = document.getElementById(docType + '-empty');
  const project = getActiveProject();
  const doc = project ? project[docType] : null;

  if (!doc || !doc.sections || doc.sections.length === 0) {
    contentEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');

  const generatedDate = doc.generatedAt ? formatDate(doc.generatedAt) : '';

  contentEl.innerHTML = (generatedDate ? `<p class="text-xs text-slate-400 dark:text-slate-500 mb-2">Generated ${generatedDate}</p>` : '') +
    doc.sections.map((section, idx) => {
      const sectionKey = docType + '-' + idx;
      const isEditing = editingSectionKey === sectionKey;

      return `
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <button onclick="toggleDocSection('${sectionKey}')" class="doc-section-toggle w-full flex items-center justify-between px-4 py-3 text-left group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
            <span class="text-sm font-semibold text-slate-800 dark:text-slate-200">${escapeHtml(section.title)}</span>
            <svg class="chevron-icon w-4 h-4 text-slate-400 transition-transform" id="chevron-${sectionKey}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div id="section-body-${sectionKey}" class="hidden">
            <div class="px-4 pb-4 border-t border-slate-100 dark:border-slate-800">
              ${isEditing ? renderEditableSection(docType, idx, section.content) : renderReadOnlySection(docType, idx, section.content)}
            </div>
          </div>
        </div>`;
    }).join('');
}

function renderReadOnlySection(docType, idx, content) {
  return `
    <div class="pt-3">
      <div class="prose-sm text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">${escapeHtml(content)}</div>
      <button onclick="startEditSection('${docType}', ${idx})" class="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        Edit
      </button>
    </div>`;
}

function renderEditableSection(docType, idx, content) {
  return `
    <div class="pt-3">
      <textarea id="edit-area-${docType}-${idx}" rows="8" class="w-full px-3 py-2 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-y">${escapeHtml(content)}</textarea>
      <div class="flex items-center gap-2 mt-2">
        <button onclick="saveSection('${docType}', ${idx})" class="px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-100 text-white text-xs font-medium transition-colors">Save</button>
        <button onclick="cancelEditSection()" class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
      </div>
    </div>`;
}

function toggleDocSection(sectionKey) {
  const body = document.getElementById('section-body-' + sectionKey);
  const chevron = document.getElementById('chevron-' + sectionKey);
  if (!body) return;

  const isHidden = body.classList.contains('hidden');
  body.classList.toggle('hidden');
  if (chevron) {
    chevron.style.transform = isHidden ? 'rotate(180deg)' : '';
  }
}

// ─── Inline Section Editing ───

function startEditSection(docType, idx) {
  editingSectionKey = docType + '-' + idx;
  renderDocSections(docType);

  const body = document.getElementById('section-body-' + editingSectionKey);
  const chevron = document.getElementById('chevron-' + editingSectionKey);
  if (body) {
    body.classList.remove('hidden');
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  }

  const textarea = document.getElementById('edit-area-' + docType + '-' + idx);
  if (textarea) textarea.focus();
}

function saveSection(docType, idx) {
  const textarea = document.getElementById('edit-area-' + docType + '-' + idx);
  if (!textarea) return;

  const project = getActiveProject();
  const newContent = textarea.value.trim();
  if (project && project[docType] && project[docType].sections[idx]) {
    project[docType].sections[idx].content = newContent;
    persist();
    showToast('Section updated');
  }

  editingSectionKey = null;
  renderDocSections(docType);
}

function cancelEditSection() {
  const prevKey = editingSectionKey;
  editingSectionKey = null;
  if (prevKey) {
    const docType = prevKey.split('-')[0];
    renderDocSections(docType);
  }
}

// ─── Tab Switching (Mobile) ───

function switchDocTab(tab) {
  activeDocTab = tab;
  updateTabStyles();
}

function updateTabStyles() {
  const prdTab = document.getElementById('tab-prd');
  const brdTab = document.getElementById('tab-brd');
  const prdCol = document.getElementById('prd-column');
  const brdCol = document.getElementById('brd-column');

  if (!prdTab || !brdTab) return;

  const activeClass = 'text-slate-900 dark:text-white border-slate-900 dark:border-white';
  const inactiveClass = 'text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600 dark:hover:text-slate-400';

  prdTab.className = 'flex-1 px-4 py-3 text-sm font-semibold text-center border-b-2 transition-colors ' + (activeDocTab === 'prd' ? activeClass : inactiveClass);
  brdTab.className = 'flex-1 px-4 py-3 text-sm font-semibold text-center border-b-2 transition-colors ' + (activeDocTab === 'brd' ? activeClass : inactiveClass);

  if (window.innerWidth < 640) {
    prdCol.classList.toggle('hidden', activeDocTab !== 'prd');
    brdCol.classList.toggle('hidden', activeDocTab !== 'brd');
  } else {
    prdCol.classList.remove('hidden');
    brdCol.classList.remove('hidden');
  }
}

// ─── Empty / Visibility States ───

function toggleEmptyState() {
  const emptyState = document.getElementById('empty-state');
  const projectSection = document.getElementById('project-section');
  const docsSection = document.getElementById('docs-section');
  const actionBarDesktop = document.getElementById('action-bar');
  const actionBarMobile = document.querySelector('.sm\\:hidden');
  const project = getActiveProject();

  if (!project) {
    // No project selected at all
    emptyState.classList.remove('hidden');
    projectSection.classList.add('hidden');
    docsSection.classList.add('hidden');
    if (actionBarDesktop) actionBarDesktop.classList.add('hidden');
    if (actionBarDesktop) actionBarDesktop.classList.remove('sm:flex');
    if (actionBarMobile) actionBarMobile.classList.add('hidden');
  } else {
    emptyState.classList.add('hidden');
    projectSection.classList.remove('hidden');
    docsSection.classList.remove('hidden');
    if (actionBarDesktop) actionBarDesktop.classList.remove('hidden');
    if (actionBarDesktop) actionBarDesktop.classList.add('sm:flex');
    // Mobile bar visible on small screens when project exists
    if (actionBarMobile) actionBarMobile.classList.remove('hidden');
  }
}

// ─── AI: Generate PRD ───

async function generatePRD() {
  if (!ensureApiKey()) return;

  const project = getActiveProject();
  if (!project || !project.projectDescription) {
    showToast('Save a project description first', 'error');
    return;
  }

  const btn = document.getElementById('btn-gen-prd');
  const btnMobile = document.getElementById('btn-gen-prd-mobile');
  if (btn) setAiButtonLoading(btn, true);
  if (btnMobile) setAiButtonLoading(btnMobile, true);

  try {
    const result = await callOpenRouterAPI([
      {
        role: 'system',
        content: 'You are a senior product manager. Given a project description, generate a PRD. Return ONLY valid JSON: {"sections": [{"title": "string", "content": "string"}]}. Include sections: Product Overview, Goals & Objectives, Target Users, Functional Requirements, Non-Functional Requirements, Success Metrics, Assumptions & Constraints. Write detailed, actionable content for each section. Do not wrap in markdown code blocks.'
      },
      {
        role: 'user',
        content: 'Project: ' + project.projectName + '\n\n' + project.projectDescription
      }
    ], null, 4096);

    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      showToast('Failed to parse PRD response', 'error');
      return;
    }

    project.prd = {
      generatedAt: new Date().toISOString(),
      sections: parsed.sections,
    };

    persist();
    render();
    showToast('PRD generated with ' + parsed.sections.length + ' sections');
  } catch (err) {
    showToast('AI error: ' + err.message, 'error');
  } finally {
    if (btn) setAiButtonLoading(btn, false);
    if (btnMobile) setAiButtonLoading(btnMobile, false);
  }
}

// ─── AI: Generate BRD ───

async function generateBRD() {
  if (!ensureApiKey()) return;

  const project = getActiveProject();
  if (!project || !project.projectDescription) {
    showToast('Save a project description first', 'error');
    return;
  }

  const btn = document.getElementById('btn-gen-brd');
  const btnMobile = document.getElementById('btn-gen-brd-mobile');
  if (btn) setAiButtonLoading(btn, true);
  if (btnMobile) setAiButtonLoading(btnMobile, true);

  try {
    const result = await callOpenRouterAPI([
      {
        role: 'system',
        content: 'You are a senior business analyst. Given a project description, generate a BRD. Return ONLY valid JSON: {"sections": [{"title": "string", "content": "string"}]}. Include sections: Business Problem, Business Objectives, Stakeholders, Scope, Business Requirements, Success Criteria, Dependencies. Write clear, measurable business requirements. Do not wrap in markdown code blocks.'
      },
      {
        role: 'user',
        content: 'Project: ' + project.projectName + '\n\n' + project.projectDescription
      }
    ], null, 4096);

    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      showToast('Failed to parse BRD response', 'error');
      return;
    }

    project.brd = {
      generatedAt: new Date().toISOString(),
      sections: parsed.sections,
    };

    persist();
    render();
    showToast('BRD generated with ' + parsed.sections.length + ' sections');
  } catch (err) {
    showToast('AI error: ' + err.message, 'error');
  } finally {
    if (btn) setAiButtonLoading(btn, false);
    if (btnMobile) setAiButtonLoading(btnMobile, false);
  }
}

// ─── Export ───

function exportPRD() {
  const project = getActiveProject();
  if (!project || !project.prd || !project.prd.sections) {
    showToast('No PRD to export', 'error');
    return;
  }
  const md = buildDocMarkdown('Product Requirements Document', project.prd, project);
  exportMarkdown('PRD-' + sanitizeFilename(project.projectName) + '.md', md);
}

function exportBRD() {
  const project = getActiveProject();
  if (!project || !project.brd || !project.brd.sections) {
    showToast('No BRD to export', 'error');
    return;
  }
  const md = buildDocMarkdown('Business Requirements Document', project.brd, project);
  exportMarkdown('BRD-' + sanitizeFilename(project.projectName) + '.md', md);
}

function buildDocMarkdown(title, doc, project) {
  let md = '# ' + title + '\n\n';
  md += '**Project:** ' + (project.projectName || 'Untitled') + '\n';
  if (doc.generatedAt) {
    md += '**Generated:** ' + formatDate(doc.generatedAt) + '\n';
  }
  md += '\n---\n\n';

  doc.sections.forEach(section => {
    md += '## ' + section.title + '\n\n';
    md += section.content + '\n\n';
  });

  return md;
}

function sanitizeFilename(name) {
  return (name || 'untitled').replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').substring(0, 50);
}

function openExportMenu() {
  openModal('export-modal');
}

// ─── Responsive Tab Handling ───

window.addEventListener('resize', updateTabStyles);

// ─── Utilities (local) ───

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
