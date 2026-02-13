# SprintLoop

**Free Agile Sprint Management Tool** -- a complete, browser-based toolkit for product owners, scrum masters, and agile teams to manage the full sprint lifecycle from business requirements to retrospectives.

**[Live Demo](https://sprintloop.dplooy.com/)**

---

## What is SprintLoop?

SprintLoop is a zero-cost, zero-setup agile project management suite that runs entirely in the browser. No accounts, no servers, no data leaves your machine. All project data is stored in localStorage, making it ideal for solo POs, small teams, and anyone who wants to plan and track sprints without the overhead of enterprise tools.

It covers the full software development lifecycle:

**Define** --> **Plan** --> **Execute** --> **Reflect**

---

## Tools

### Dashboard
Project health at a glance. Aggregates data from all tools into KPI cards, charts, and summary widgets.
- Story status area chart and priority doughnut
- Sprint board column distribution
- Team composition polar area chart
- Epic progress with stacked status bars
- Risk overview with severity ranking
- Recent decisions feed

### Business Docs
AI-powered PRD and BRD generator. Define your product vision, target audience, and features -- then generate structured business documents with one click.
- Dual-pane PRD/BRD editor
- OpenRouter AI integration for document generation
- Multi-project support with project switching
- Export to markdown

### User Stories
Write, organize, and manage user stories with MoSCoW prioritization.
- Story cards with priority badges and status tracking
- Epic grouping with accordion views
- Point estimation
- Bulk filtering by priority, status, and epic
- AI story generation from epic context

### Capacity Planner
Sprint capacity calculator. Add team members with roles, daily capacity, and PTO to determine how much work the team can commit to.
- Team roster with role-based capacity
- Sprint configuration (length, ceremony hours)
- Commitment level tracking with visual capacity bar
- Story import from User Stories for grooming and commitment
- Only committed stories flow to the Sprint Board

### Sprint Board
Kanban-style sprint execution board with full sprint cycle management.
- Five columns: Backlog, To Do, In Progress, Review, Done
- Sprint cycles: create, switch, complete, and archive sprints
- Drag-and-drop card movement
- Epic-grouped import modal with accordion UI
- Sprint completion summary with delivered points
- Card detail view with comments, AI suggestions, and status sync
- Mobile-optimized with swipeable columns

### RACI Matrix
Responsibility assignment matrix builder.
- Add stakeholders and deliverables/tasks
- Click-to-cycle RACI assignments (Responsible, Accountable, Consulted, Informed)
- Color-coded cells for quick scanning
- Sprint board status integration
- Export to CSV

### Epic Tracker (Traceability)
Track epics and their linked user stories for feature-level visibility.
- Epic cards with linked story counts
- Story linking/unlinking
- Traceability heatmap showing epic-to-story coverage
- AI-generated feature breakdowns and test cases
- Priority and progress tracking

### Retro & Decision Log
Run retrospectives and maintain a searchable decision history.
- Session-based retros tied to sprint cycles
- Three-column board: Went Well, Needs Improvement, Action Items
- Action item tracking with open/done status
- Decision log with context, rationale, owner, and status
- Sprint board import (done items become "Went Well", incomplete become "Needs Improvement")
- Export retro sessions to markdown

### Risk Register
Project risk management with visual heatmaps.
- Risk cards with probability, impact, category, and status
- 5x5 likelihood-impact heatmap
- Category-based filtering (Technical, Business, Resource, Schedule, External)
- Mitigation plan tracking
- Summary stat cards for quick risk overview
- AI-powered risk analysis suggestions

---

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (no framework, no build step)
- **Styling**: Tailwind CSS (CDN)
- **Charts**: Chart.js 4.x (CDN, dashboard only)
- **Fonts**: Inter (body) + Instrument Serif (headings) via Google Fonts
- **AI**: OpenRouter API integration (optional, bring your own key)
- **Storage**: Browser localStorage (all data stays on your machine)
- **Deployment**: Static files, works on any hosting (GitHub Pages, Netlify, Vercel, etc.)

---

## Project Structure

```
sprintloop/
  index.html                    # Landing page (SEO-optimized)
  pages/
    dashboard.html              # Project analytics dashboard
    business-docs.html          # PRD/BRD generator
    user-stories.html           # User story manager
    capacity-planner.html       # Sprint capacity calculator
    sprint-board.html           # Kanban sprint board
    raci-matrix.html            # RACI matrix builder
    epics.html                  # Epic/traceability tracker
    retro-log.html              # Retrospective & decision log
    risk-register.html          # Risk register & heatmap
  scripts/
    shared.js                   # Navigation, theme, storage, AI, modals
    dashboard.js                # Dashboard charts and widgets
    business-docs.js            # Business document logic
    user-stories.js             # Story management logic
    sprint-planner.js           # Capacity planning logic
    sprint-board.js             # Sprint board logic
    raci-matrix.js              # RACI matrix logic
    epics.js                    # Epic tracker logic
    retro-log.js                # Retro & decision logic
    risk-register.js            # Risk register logic
  styles/
    shared.css                  # Animations, heatmap, tooltips, scrollbar
```

---

## Getting Started

No installation, no build step, no dependencies. Just open `index.html` in your browser -- that's it.

Or visit the **[live demo](https://sprintloop.dplooy.com/)**.

---

## Features

### Multi-Project Support
Create and switch between multiple projects. Each project has its own isolated data across all tools.

### Dark / Light Theme
Toggle between dark and light mode. Preference is persisted across sessions.

### AI Integration (Optional)
Connect your OpenRouter API key to unlock AI-powered features:
- Business document generation (PRD/BRD)
- User story generation from epic context
- Risk analysis and mitigation suggestions
- Sprint item solution suggestions
- Feature and test case generation for epics

No API key required for core functionality -- AI features gracefully degrade when unconfigured.

### Offline-First
All data lives in browser localStorage. No server, no database, no network requests (except optional AI calls). Works fully offline after first page load (Tailwind CDN caches).

### Mobile Responsive
Every tool is optimized for mobile with collapsible navigation, touch-friendly controls, and responsive grid layouts.

### Data Portability
- Export retro sessions to markdown
- Export RACI matrix to CSV
- Export risk register to CSV
- Copy business documents to clipboard

---

## Browser Support

Works in all modern browsers:
- Chrome / Edge 90+
- Firefox 90+
- Safari 15+

---

## Privacy

SprintLoop stores all data in your browser's localStorage. No data is ever sent to any server. The only external network requests are:
- Tailwind CSS CDN (styling)
- Google Fonts CDN (typography)
- Chart.js CDN (dashboard charts)
- OpenRouter API (only when you explicitly use AI features with your own key)

---

## License

MIT
