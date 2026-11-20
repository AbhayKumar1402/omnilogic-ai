/* ═══════════════════════════════════════════════════════════
   OmniLogic Chrome Extension — Popup Logic
   ═══════════════════════════════════════════════════════════ */

const BACKEND = 'https://omnilogic-backend.onrender.com';

// ── State ──────────────────────────────────────────────────
let selectedMode   = 'executive';
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
    executive:        'Executive',
    technical:        'Technical',
    chain_of_density: 'Dense',
    actionable:       'Actions'
  };
  return labels[mode] || mode;
}

/** Render markdown-style bullets & bold from summary text */
function renderSummary(text) {
  // Bold **text**
  let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
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

  // Client-side local fallback if backend server is stopped
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 35 && s.length < 320);
  const top = sentences.slice(0, 5);
  let fallbackSummary = '';
  if (mode === 'executive') {
    fallbackSummary = top.slice(0, 3).map((s, i) => `- **Key Takeaway ${i + 1}**: ${s}`).join('\n');
  } else if (mode === 'actionable') {
    fallbackSummary = top.slice(0, 4).map((s, i) => `- **Action ${i + 1}**: ${s}`).join('\n');
  } else if (mode === 'chain_of_density') {
    fallbackSummary = top.slice(0, 4).join(' ');
  } else {
    fallbackSummary = top.slice(0, 4).map(s => `- ${s}`).join('\n');
  }
  return {
    mode,
    summary: fallbackSummary || text.substring(0, 400),
    model: 'omnilogic-local-v1'
  };
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

    // Step 2 — Extract content
    setProgress(35, 'Extracting readable content…');
    let extracted;
    try {
      extracted = await extractPageContent(currentTab);
    } catch (e) {
      // Last-resort: use tab title + URL as minimal context
      extracted = {
        success: false,
        text: `Page: ${currentTab.title}\nURL: ${currentTab.url}`,
        meta: { title: currentTab.title, url: currentTab.url },
        wordCount: 10
      };
    }

    if (!extracted.text || extracted.text.trim().length < 20) {
      throw new Error('Page has too little readable text to summarize.');
    }

    extractedWords = extracted.wordCount || countWords(extracted.text);

    // Step 3 — Call backend
    setProgress(60, 'Sending to OmniLogic AI…');
    const t0 = Date.now();
    const result = await callSummarizer(extracted.text, selectedMode, extracted.meta || {});
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    // Step 4 — Render result
    setProgress(100, 'Done!');
    lastSummary = result.summary || result.text || result.result || JSON.stringify(result);

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
    outputBody.innerHTML = renderSummary(lastSummary);
    modeTag.textContent  = formatMode(selectedMode);
    if (result.model) modelTag.textContent = result.model;
    outputFooter.style.display = 'flex';
    outputPanel.style.display  = 'block';
    outputPanel.classList.add('fade-in');

    // Cache in storage
    chrome.storage.local.set({
      lastSummary,
      lastMode: selectedMode,
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

// ── Mode selection ─────────────────────────────────────────
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMode = btn.dataset.mode;
  });
});

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
    // Show previous summary for the same page (only if fresh < 2 mins and clean)
    lastSummary = data.lastSummary;
    outputBody.innerHTML = renderSummary(lastSummary);
    modeTag.textContent  = formatMode(data.lastMode || 'executive');
    outputFooter.style.display = 'flex';
    outputPanel.style.display  = 'block';
  }
}

// ── Init ───────────────────────────────────────────────────
(async function init() {
  // Load tab info
  currentTab = await getActiveTab();
  if (currentTab) {
    pageTitle.textContent = currentTab.title || currentTab.url || 'Unknown page';
  }

  // Check backend
  await checkBackend();

  // Try to restore last session for this page
  await restoreLastSession(currentTab);
})();
