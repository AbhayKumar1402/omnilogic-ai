/* ═══════════════════════════════════════════════════════════
   OmniLogic Chrome Extension — Popup Logic
   ═══════════════════════════════════════════════════════════ */

const BACKEND = 'https://omnilogic-backend.onrender.com';

// ── State ──────────────────────────────────────────────────
let selectedMode   = 'auto';
let detectedMode   = 'executive';
let currentTab     = null;
let isLoading      = false;
let lastSummary    = '';
let extractedWords = 0;

// ── DOM refs ───────────────────────────────────────────────
const statusPill    = document.getElementById('statusPill');
const statusDot     = document.getElementById('statusDot');
const statusText    = document.getElementById('statusText');
const pageTitle     = document.getElementById('pageTitle');
const summarizeBtn  = document.getElementById('summarizeBtn');
const btnText       = document.getElementById('btnText');
const progressWrap  = document.getElementById('progressWrap');
const progressBar   = document.getElementById('progressBar');
const progressLabel = document.getElementById('progressLabel');
const statsRow      = document.getElementById('statsRow');
const outputPanel   = document.getElementById('outputPanel');
const outputBody    = document.getElementById('outputBody');
const outputFooter  = document.getElementById('outputFooter');
const errorPanel    = document.getElementById('errorPanel');
const errorTitle    = document.getElementById('errorTitle');
const errorMsg      = document.getElementById('errorMsg');
const copyBtn       = document.getElementById('copyBtn');
const openAppBtn    = document.getElementById('openAppBtn');
const retryBtn      = document.getElementById('retryBtn');
const modeTag       = document.getElementById('modeTag');
const modelTag      = document.getElementById('modelTag');

// ── Helpers ────────────────────────────────────────────────
function setProgress(pct, label) {
  progressBar.style.width  = `${pct}%`;
  progressLabel.textContent = label;
}

function showProgress(label = 'Working…') {
  progressWrap.style.display = 'flex';
  progressWrap.classList.add('fade-in');
  setProgress(10, label);
}

function hideProgress() {
  progressWrap.style.display = 'none';
}

function showError(title, msg) {
  errorTitle.textContent = title;
  errorMsg.textContent   = msg;
  errorPanel.style.display = 'flex';
  errorPanel.classList.add('fade-in');
  outputPanel.style.display = 'none';
  statsRow.style.display    = 'none';
  hideProgress();
  setLoading(false);
}

function hideError() {
  errorPanel.style.display = 'none';
}

function setLoading(state) {
  isLoading = state;
  summarizeBtn.disabled = state;
  if (state) {
    summarizeBtn.classList.add('btn-loading');
    btnText.textContent = 'Summarizing…';
  } else {
    summarizeBtn.classList.remove('btn-loading');
    btnText.textContent = 'Summarize This Page';
  }
}

function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

function formatMode(mode) {
  const labels = {
    auto:                '✨ Auto-Detect',
    executive:           'Executive Overview',
    technical:           'Technical & Engineering',
    architecture:        'Systems Architecture',
    chain_of_density:    'Dense (Chain-of-Density)',
    actionable:          'Action Items & Directives',
    finance_product:     'Finance & Product Reviews',
    narrative_history:   'Narrative & History',
    meetings_dialogue:   'Meetings & Dialogue',
    scientific_academic: 'Scientific & Academic',
    legal_governance:    'Legal, Policy & Governance'
  };
  return labels[mode] || mode;
}

/**
 * Automatically recognizes the topic category (across all 10 OmniLogic streams)
 * from the active webpage's text, title, and URL.
 */
function autoDetectTopicCategory(text = '', title = '', url = '') {
  const combined = `${title} ${url} ${(text || '').substring(0, 12000)}`.toLowerCase();
  const u = (url || '').toLowerCase();

  // Fast URL domain rules
  if (u.includes('arxiv.org') || u.includes('ncbi.nlm') || u.includes('scholar.google') || u.includes('ieee.org') || u.includes('sciencedirect')) {
    return 'scientific_academic';
  }
  if (u.includes('readthedocs.io') || u.includes('github.com') || u.includes('gitlab.com') || u.includes('stackoverflow.com') || u.includes('developer.mozilla.org')) {
    return 'technical';
  }

  const lexicons = {
    legal_governance: [
      'constitution', 'article ', 'amendment', 'statute', 'supreme court', 'parliament',
      'jurisdiction', 'fundamental rights', 'clause', 'ordinance', 'legislation', 'statutory',
      'governance', 'directive principles', 'schedule', 'act, 19', 'act, 20'
    ],
    scientific_academic: [
      'research paper', 'dissertation', 'thesis', 'literature review', 'conference',
      'journal', 'ieee', 'acm', 'abstract', 'methodology', 'hypothesis', 'et al', 'arxiv',
      'empirical', 'theorem', 'experiment', 'transduction', 'neural network', 'citation',
      'peer-reviewed', 'preprint', 'clinical trial', 'statistical significance', 'university'
    ],
    finance_product: [
      'factsheet', 'mutual fund', 'index fund', 'expense ratio', 'gross margin',
      'free cash flow', 'portfolio', 'dividend', 'sharpe ratio', 'market cap',
      'valuation', 'ebitda', 'quarterly revenue', 'fiscal year', 'stock market'
    ],
    architecture: [
      'monolithic', 'microservices', 'distributed system', 'system topology', 'sharding',
      'vector index', 'hnsw', 'ivfflat', 'load balancer', 'high availability', 'consensus',
      'data flow', 'message queue', 'kafka', 'event-driven', 'scalability', 'database schema'
    ],
    technical: [
      'fastapi', 'uvicorn', 'python', 'javascript', 'typescript', 'docker', 'kubernetes',
      'sqlalchemy', 'endpoint', 'memory leak', 'garbage collection', 'compiler',
      'post-mortem', 'outage', 'oauth', 'repository', 'tutorial', 'documentation', 'source code'
    ],
    narrative_history: [
      'emperor', 'empire', 'dynasty', 'reign', 'century', 'kingdom', 'ancient',
      'republic', 'senate', 'historical', 'biography', 'chronicle', 'treaty', 'civilization',
      'world war', 'invasion', 'monarch', 'revolution'
    ],
    meetings_dialogue: [
      'standup', 'transcript', 'attendees', 'moderator', 'speaker', 'agenda',
      'minutes of meeting', 'blocker', 'sprint', 'q&a', 'interview', 'discussion'
    ],
    actionable: [
      'action items', 'checklist', 'step 1', 'step 2', 'next steps', 'how to',
      'playbook', 'todo', 'deliverables', 'standard operating procedure', 'guidelines'
    ],
    chain_of_density: [
      'wikipedia', 'encyclopedia', 'metabolism', 'digestion', 'physiology',
      'comprehensive overview', 'thermogenesis'
    ]
  };

  let bestCat = u.includes('wikipedia.org') ? 'chain_of_density' : 'executive';
  let bestScore = 0;

  for (const [cat, words] of Object.entries(lexicons)) {
    let score = 0;
    for (const w of words) {
      if (combined.includes(w)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat;
    }
  }

  return bestCat;
}

function updateDetectedCategoryUI(cat, isManual = false) {
  detectedMode = cat;
  const labelEl = document.getElementById('detectedCategoryLabel');
  const badgeEl = document.getElementById('autoDetectBadge');
  if (labelEl) {
    labelEl.textContent = formatMode(cat);
  }
  if (badgeEl) {
    badgeEl.textContent = isManual ? '⚙️ Manual Override' : '✨ Auto-Recognized';
  }
}

const STRICT_CATEGORY_HEADERS = {
  scientific_academic: [
    'Research Objective & Academic Scope',
    'Methodology & Structural Framework',
    'Empirical Findings & Quantitative Specs',
    'Scholarly Conclusions & Guidelines'
  ],
  technical: [
    'Technical Overview & System Scope',
    'Core Mechanisms & Implementation',
    'Configuration & Operational Pipeline',
    'Performance Metrics & Verification'
  ],
  architecture: [
    'System Topology & Architectural Pattern',
    'Component Boundaries & Data Flow',
    'Scalability & Trade-off Analysis',
    'Operational Resilience & Deployment'
  ],
  legal_governance: [
    'Statutory & Constitutional Scope',
    'Structural Provisions & Mandates',
    'Foundational Rights & Obligations',
    'Enforcement & Amendment Mechanisms'
  ],
  finance_product: [
    'Financial & Market Overview',
    'Core Performance & Valuation Metrics',
    'Portfolio Composition & Strengths',
    'Strategic Verdict & Fiscal Outlook'
  ],
  narrative_history: [
    'Historical Context & Origins',
    'Chronological Milestones & Events',
    'Governance, Reforms & Cultural Shifts',
    'Historical Impact & Enduring Legacy'
  ],
  meetings_dialogue: [
    'Meeting Context & Core Agenda',
    'Key Decisions & Consensus Reached',
    'Open Questions, Risks & Blockers',
    'Assigned Action Items & Next Steps'
  ],
  actionable: [
    'Primary Objective & Action Scope',
    'Step-by-Step Execution Directives',
    'Key Rules & Operational Standards',
    'Immediate Deliverables & Checklist'
  ],
  chain_of_density: [
    'Core Subject & Foundational Definition',
    'High-Density Quantitative & Causal Facts',
    'Structural Taxonomy & Classifications',
    'Empirical Synthesis & Systemic Impact'
  ],
  executive: [
    'Executive Summary & Core Thesis',
    'Key Quantitative Highlights & Facts',
    'Foundational Pillars & Structure',
    'Strategic Takeaways & Recommendations'
  ]
};

/**
 * Guarantees that every bullet point heading in the summary strictly matches the active category
 * (eliminating any cross-category leakage such as Financial headings on Academic pages)
 * and cleans up glued search-snippet breadcrumb prefixes.
 */
function enforceStrictCategoryHeadings(rawSummary, mode) {
  if (!rawSummary) return '';
  const headers = STRICT_CATEGORY_HEADERS[mode] || STRICT_CATEGORY_HEADERS.executive;
  const allowedLower = new Set(headers.map(h => h.toLowerCase()));

  let bulletIdx = 0;
  const lines = rawSummary.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';

    // Match any bullet or bold-headed line: "• **Heading**: text" or "**Heading**: text" or "- Heading: text"
    const m = trimmed.match(/^(?:[•\-*]\s*)?\*\*([^*]+)\*\*:\s*(.*)$/);
    if (m) {
      const existingHeading = m[1].trim();
      let body = m[2].trim();
      // Strip glued breadcrumb prefix like "CARE Group of InstitutionsExact length..." -> "Exact length..."
      body = body.replace(/^[A-Z][A-Za-z0-9 &.,'-]{2,40}?([A-Z][a-z]{3,}\b)/, '$1');

      const targetHeading = allowedLower.has(existingHeading.toLowerCase())
        ? existingHeading
        : headers[Math.min(bulletIdx, headers.length - 1)];
      bulletIdx++;
      return `• **${targetHeading}**: ${body}`;
    }
    return trimmed;
  }).filter(Boolean);

  return lines.join('\n');
}

/** Render markdown-style bullets & bold from summary text */
function renderSummary(text, mode = detectedMode) {
  const strictText = enforceStrictCategoryHeadings(text, mode);
  // Bold **text**
  let html = strictText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Bullet lines starting with - or •
  const lines = html.split('\n');
  let inList = false;
  let out = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-•]\s/.test(trimmed)) {
      if (!inList) { out += '<ul>'; inList = true; }
      out += `<li>${trimmed.replace(/^[-•]\s/, '')}</li>`;
    } else {
      if (inList) { out += '</ul>'; inList = false; }
      if (trimmed) out += `<p>${trimmed}</p>`;
    }
  }
  if (inList) out += '</ul>';
  return out;
}

// ── Backend health check ───────────────────────────────────
let activeBackend = BACKEND;

async function checkBackend() {
  for (const host of ['https://omnilogic-backend.onrender.com', 'http://127.0.0.1:8000', 'http://localhost:8000']) {
    try {
      const r = await fetch(`${host}/api/v1/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(15000)
      });
      if (r.ok) {
        activeBackend = host;
        const data = await r.json();
        statusPill.className = 'status-pill online';
        statusText.textContent = 'Online';
        modelTag.textContent = data.model || 'omnilogic-v1.4';
        return true;
      }
    } catch (_) {}
  }
  statusPill.className = 'status-pill offline';
  statusText.textContent = 'Offline (Local Mode)';
  return false;
}

// ── Get active tab ─────────────────────────────────────────
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// ── Inject content script & extract text ─────────────────
async function extractPageContent(tab) {
  // Try messaging the already-injected content script first
  try {
    return await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: 'extractContent' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Content script failed'));
        }
      });
    });
  } catch (_) {}

  // Fallback: inject on demand via scripting API
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content_script.js']
  });

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, { action: 'extractContent' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error('Could not extract page content. Try refreshing the page.'));
        } else if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Extraction failed'));
        }
      });
    }, 300);
  });
}

// ── Call summarizer API ────────────────────────────────────
async function callSummarizer(text, mode, meta) {
  for (const host of [activeBackend, 'https://omnilogic-backend.onrender.com', 'http://127.0.0.1:8000', 'http://localhost:8000']) {
    try {
      const response = await fetch(`${host}/api/v1/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          mode,
          context: {
            title: meta?.title || '',
            url:   meta?.url   || '',
            source: 'chrome_extension'
          }
        }),
        signal: AbortSignal.timeout(35000)
      });

      if (response.ok) {
        activeBackend = host;
        statusPill.className = 'status-pill online';
        statusText.textContent = 'Online';
        return await response.json();
      }
    } catch (_) {}
  }

  // Client-side local fallback if backend server is stopped — strictly bound to category headers
  const headers = STRICT_CATEGORY_HEADERS[mode] || STRICT_CATEGORY_HEADERS.executive;
  const sentences = text
    .replace(/([a-z]{3,})([A-Z][a-z]{3,})/g, '$1. $2')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 35 && s.length < 340);
  const top = sentences.slice(0, 4);
  const fallbackSummary = top
    .map((s, i) => `• **${headers[i] || headers[headers.length - 1]}**: ${s}`)
    .join('\n');
  return {
    mode,
    summary: fallbackSummary || text.substring(0, 400),
    model: 'omnilogic-local-v1'
  };
}

// ── Client-Side & Backend PDF Extractor ────────────────────
function isPdfUrl(url = '') {
  const clean = url.toLowerCase().split('?')[0].split('#')[0];
  return clean.endsWith('.pdf') || url.toLowerCase().includes('.pdf');
}

async function decompressFlate(uint8Slice) {
  for (const fmt of ['deflate', 'deflate-raw']) {
    try {
      const ds = new DecompressionStream(fmt);
      const writer = ds.writable.getWriter();
      writer.write(uint8Slice).catch(() => {});
      writer.close().catch(() => {});
      const reader = ds.readable.getReader();
      const chunks = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.byteLength;
      }
      const out = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.byteLength;
      }
      return new TextDecoder('latin1').decode(out);
    } catch (_) {}
  }
  return new TextDecoder('latin1').decode(uint8Slice);
}

async function extractPdfTextFromBuffer(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const rawLatin = new TextDecoder('latin1').decode(bytes);
  const extracted = [];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;

  while ((match = streamRegex.exec(rawLatin)) !== null) {
    const bodyStr = match[1];
    const slice = new Uint8Array(bodyStr.length);
    for (let i = 0; i < bodyStr.length; i++) {
      slice[i] = bodyStr.charCodeAt(i) & 0xff;
    }
    const decoded = await decompressFlate(slice);
    const litRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
    let litMatch;
    while ((litMatch = litRegex.exec(decoded)) !== null) {
      let s = litMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, ' ')
        .replace(/\\t/g, ' ')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')')
        .replace(/\\\\/g, '\\')
        .replace(/\\\d{3}/g, ' ');
      if (/[a-zA-Z]{2,}/.test(s)) {
        extracted.push(s);
      }
    }
  }
  return extracted.join(' ').replace(/[ \t]+/g, ' ').trim();
}

async function extractPdfTabContent(tabUrl) {
  const resp = await fetch(tabUrl);
  const blob = await resp.blob();

  for (const host of [activeBackend, 'https://omnilogic-backend.onrender.com', 'http://127.0.0.1:8000']) {
    try {
      const formData = new FormData();
      formData.append('file', blob, 'document.pdf');
      formData.append('type', 'pdf');
      const ocrResp = await fetch(`${host}/api/v1/ocr`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(15000)
      });
      if (ocrResp.ok) {
        const data = await ocrResp.json();
        if (data.text && data.text.trim().length > 40) {
          return data.text.trim();
        }
      }
    } catch (_) {}
  }

  return await extractPdfTextFromBuffer(await blob.arrayBuffer());
}

// ── Main summarize flow ────────────────────────────────────
async function runSummarize() {
  if (isLoading) return;

  hideError();
  setLoading(true);
  showProgress('Extracting page content…');
  statsRow.style.display  = 'none';
  outputPanel.style.display = 'none';

  try {
    // Step 1 — Get tab
    setProgress(15, 'Reading active tab…');
    currentTab = await getActiveTab();

    if (!currentTab || !currentTab.url) {
      throw new Error('No active tab found. Please navigate to a web page first.');
    }

    // Block chrome:// and extension pages
    if (currentTab.url.startsWith('chrome://') ||
        currentTab.url.startsWith('chrome-extension://') ||
        currentTab.url.startsWith('about:')) {
      throw new Error('Cannot summarize browser internal pages. Please navigate to a real web page.');
    }

    // Step 2 — Extract content (supports both HTML pages and PDF tabs)
    setProgress(35, 'Extracting readable content…');
    let extracted;
    if (isPdfUrl(currentTab.url)) {
      setProgress(40, 'Extracting PDF document text…');
      const pdfText = await extractPdfTabContent(currentTab.url);
      extracted = {
        success: true,
        text: pdfText,
        meta: { title: currentTab.title || 'PDF Document', url: currentTab.url },
        wordCount: countWords(pdfText)
      };
    } else {
      try {
        extracted = await extractPageContent(currentTab);
      } catch (e) {
        extracted = {
          success: false,
          text: '',
          meta: { title: currentTab.title, url: currentTab.url },
          wordCount: 0
        };
      }
      if (!extracted.text || extracted.text.trim().length < 20) {
        // Fallback: Check if tab is a PDF served without .pdf extension
        try {
          const pdfText = await extractPdfTabContent(currentTab.url);
          if (pdfText && pdfText.length > 40) {
            extracted = {
              success: true,
              text: pdfText,
              meta: { title: currentTab.title || 'PDF Document', url: currentTab.url },
              wordCount: countWords(pdfText)
            };
          }
        } catch (_) {}
      }
    }

    if (!extracted.text || extracted.text.trim().length < 20) {
      throw new Error('Page has too little readable text to summarize.');
    }

    extractedWords = extracted.wordCount || countWords(extracted.text);

    // Step 2.5 — Automatically recognize topic category if set to 'auto'
    const effectiveMode = selectedMode === 'auto'
      ? autoDetectTopicCategory(extracted.text, extracted.meta?.title || currentTab.title, extracted.meta?.url || currentTab.url)
      : selectedMode;
    updateDetectedCategoryUI(effectiveMode, selectedMode !== 'auto');

    // Step 3 — Call backend
    setProgress(60, `Summarizing as ${formatMode(effectiveMode)}…`);
    const t0 = Date.now();
    const result = await callSummarizer(extracted.text, effectiveMode, extracted.meta || {});
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    // Step 4 — Render result
    setProgress(100, 'Done!');
    const finalMode = result.mode || effectiveMode;
    updateDetectedCategoryUI(finalMode, selectedMode !== 'auto');
    lastSummary = enforceStrictCategoryHeadings(
      result.summary || result.text || result.result || JSON.stringify(result),
      finalMode
    );

    const summWords = countWords(lastSummary);
    const ratio = extractedWords > 0
      ? `${Math.round((1 - summWords / extractedWords) * 100)}%`
      : '—';

    // Stats
    document.getElementById('statWords').textContent    = extractedWords.toLocaleString();
    document.getElementById('statSummWords').textContent = summWords.toLocaleString();
    document.getElementById('statRatio').textContent    = ratio;
    document.getElementById('statTime').textContent     = elapsed;
    statsRow.style.display = 'flex';
    statsRow.classList.add('fade-in');

    // Output
    outputBody.innerHTML = renderSummary(lastSummary, finalMode);
    modeTag.textContent  = selectedMode === 'auto' ? `✨ ${formatMode(finalMode)}` : formatMode(finalMode);
    if (result.model) modelTag.textContent = result.model;
    outputFooter.style.display = 'flex';
    outputPanel.style.display  = 'block';
    outputPanel.classList.add('fade-in');

    // Cache in storage
    chrome.storage.local.set({
      lastSummary,
      lastMode: finalMode,
      lastUrl: currentTab.url,
      lastTitle: currentTab.title,
      lastTime: Date.now()
    });

    hideProgress();
    setLoading(false);

  } catch (err) {
    let title = 'Summarization Failed';
    let msg   = err.message || 'Unknown error';

    if (msg.includes('fetch') || msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
      title = 'Backend Offline';
      msg   = 'Cannot reach OmniLogic backend at localhost:8000. Start the backend with: python -m uvicorn app.main:app --reload --port 8000';
    } else if (msg.includes('timeout') || msg.includes('AbortError')) {
      title = 'Request Timed Out';
      msg   = 'The summarization took too long. Try a shorter page or check the backend.';
    } else if (msg.includes('Could not establish connection')) {
      title = 'Page Not Ready';
      msg   = 'Please refresh the page and try again.';
    }

    showError(title, msg);
  }
}

// ── Mode selection (Auto by default, optional manual override) ──
const modeOverrideSelect = document.getElementById('modeOverrideSelect');
if (modeOverrideSelect) {
  modeOverrideSelect.addEventListener('change', (e) => {
    selectedMode = e.target.value;
    if (selectedMode === 'auto') {
      const cat = autoDetectTopicCategory('', currentTab?.title || '', currentTab?.url || '');
      updateDetectedCategoryUI(cat, false);
    } else {
      updateDetectedCategoryUI(selectedMode, true);
    }
  });
}

// ── Button events ──────────────────────────────────────────
summarizeBtn.addEventListener('click', runSummarize);

retryBtn.addEventListener('click', () => {
  hideError();
  runSummarize();
});

copyBtn.addEventListener('click', async () => {
  if (!lastSummary) return;
  try {
    await navigator.clipboard.writeText(lastSummary);
    copyBtn.classList.add('copied');
    copyBtn.title = 'Copied!';
    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyBtn.title = 'Copy to clipboard';
    }, 2000);
  } catch (_) {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = lastSummary;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
});

openAppBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:3000' });
});

// ── Restore last session ───────────────────────────────────
async function restoreLastSession(tab) {
  const data = await chrome.storage.local.get(['lastSummary','lastMode','lastUrl','lastTitle','lastTime']);
  if (
    data.lastSummary &&
    data.lastUrl === tab?.url &&
    !data.lastSummary.includes('AI Mode conversation:') &&
    data.lastTime &&
    (Date.now() - data.lastTime) < 120000
  ) {
    const activeCat = data.lastMode || detectedMode || 'executive';
    lastSummary = enforceStrictCategoryHeadings(data.lastSummary, activeCat);
    outputBody.innerHTML = renderSummary(lastSummary, activeCat);
    modeTag.textContent  = `✨ ${formatMode(activeCat)}`;
    outputFooter.style.display = 'flex';
    outputPanel.style.display  = 'block';
  }
}

// ── Init ───────────────────────────────────────────────────
(async function init() {
  // Load tab info & immediately auto-detect topic category
  currentTab = await getActiveTab();
  if (currentTab) {
    pageTitle.textContent = currentTab.title || currentTab.url || 'Unknown page';
    const initialCat = autoDetectTopicCategory('', currentTab.title || '', currentTab.url || '');
    updateDetectedCategoryUI(initialCat, false);

    // Refine category from live page text in background
    if (currentTab.url && !currentTab.url.startsWith('chrome://') && !isPdfUrl(currentTab.url)) {
      extractPageContent(currentTab).then((res) => {
        if (res && res.text && selectedMode === 'auto') {
          const refinedCat = autoDetectTopicCategory(res.text, currentTab.title || '', currentTab.url || '');
          updateDetectedCategoryUI(refinedCat, false);
        }
      }).catch(() => {});
    }
  }

  // Check backend
  await checkBackend();

  // Try to restore last session for this page
  await restoreLastSession(currentTab);
})();
