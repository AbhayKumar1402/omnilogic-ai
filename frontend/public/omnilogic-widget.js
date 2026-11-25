// OmniLogic Commercial Chrome Extension Content Script
// 1. Extracts clean readable content from any web page
// 2. Injects a floating Grammarly/Monica-style "⚡ Summarize Page" widget directly onto any webpage
//    plus a text-selection tooltip ("⚡ Summarize Selection") and an in-page AI Summary Drawer!

(function () {
  if (window.__omnilogic_content_injected) return;
  window.__omnilogic_content_injected = true;

  const API_ENDPOINTS = [
    "https://omnilogic-backend.onrender.com/api/v1/summarize",
    "http://127.0.0.1:8000/api/v1/summarize",
  ];

  function extractCleanText() {
    const clone = document.body.cloneNode(true);
    const noiseSelectors = [
      "script", "style", "noscript", "iframe", "svg", "canvas",
      "nav", "header", "footer", "aside",
      '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
      '[role="complementary"]', '[role="search"]',
      ".nav", ".navbar", ".navigation", ".header", ".footer",
      ".sidebar", ".side-bar", ".widget", ".ad", ".ads", ".advertisement",
      ".cookie", ".cookie-banner", ".popup", ".modal-overlay",
      "#omnilogic-floating-root", "sup.reference", ".reference", ".mw-editsection"
    ];

    noiseSelectors.forEach((selector) => {
      try {
        clone.querySelectorAll(selector).forEach((el) => el.remove());
      } catch (_) {}
    });

    const contentSelectors = [
      "main", "article", '[role="main"]', ".main-content", ".post-content",
      ".article-body", ".entry-content", ".content-body", "#main-content", "#content"
    ];

    let primaryContent = null;
    for (const sel of contentSelectors) {
      const el = clone.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 200) {
        primaryContent = el;
        break;
      }
    }

    const sourceEl = primaryContent || clone;
    // Ensure block & heading tags have trailing spaces/newlines so breadcrumb titles never glue onto sentences
    sourceEl.querySelectorAll("h1, h2, h3, h4, h5, h6, p, div, li, cite, tr, br").forEach((el) => {
      el.appendChild(document.createTextNode("\n"));
    });
    let text = sourceEl.innerText || sourceEl.textContent || "";
    text = text
      .replace(/([a-z]{3,})([A-Z][a-z]{3,})/g, "$1. $2")
      .replace(/\[\s*(?:\d+|[a-zA-Z]{1,3}|citation needed|edit)\s*\]/gi, "")
      .replace(/\t/g, " ")
      .replace(/[ ]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (text.length > 25000) {
      text = text.substring(0, 25000);
    }
    return text;
  }

  function getPageMeta() {
    return {
      title: document.title || "",
      url: window.location.href,
      description: document.querySelector('meta[name="description"]')?.content || "",
    };
  }

  const CATEGORY_LABELS = {
    executive: "Executive Overview",
    technical: "Technical & Engineering",
    architecture: "Systems Architecture",
    chain_of_density: "Dense (Chain-of-Density)",
    actionable: "Action Items & Directives",
    finance_product: "Finance & Product",
    narrative_history: "Narrative & History",
    meetings_dialogue: "Meetings & Dialogue",
    scientific_academic: "Scientific & Academic",
    legal_governance: "Legal & Governance",
  };

  function autoDetectCategory(text) {
    const u = location.href.toLowerCase();
    const combined = `${document.title} ${u} ${(text || "").substring(0, 12000)}`.toLowerCase();
    if (u.includes("arxiv.org") || u.includes("ncbi.nlm") || u.includes("ieee.org")) return "scientific_academic";
    if (u.includes("readthedocs.io") || u.includes("github.com") || u.includes("stackoverflow.com")) return "technical";

    const lexicons = {
      legal_governance: ["constitution", "article ", "amendment", "statute", "supreme court", "parliament", "jurisdiction", "fundamental rights", "clause", "legislation", "governance"],
      scientific_academic: ["abstract", "methodology", "hypothesis", "et al", "arxiv", "empirical", "theorem", "experiment", "neural network", "citation", "journal", "preprint"],
      finance_product: ["factsheet", "etf", "mutual fund", "index fund", "aum", "nav", "expense ratio", "revenue", "earnings", "fiscal", "gross margin", "portfolio", "dividend", "arr", "roi"],
      architecture: ["monolithic", "microservices", "distributed system", "system topology", "sharding", "vector index", "hnsw", "load balancer", "high availability", "scalability"],
      technical: ["fastapi", "uvicorn", "python", "javascript", "typescript", "docker", "kubernetes", "api", "endpoint", "memory leak", "compiler", "oauth", "tutorial", "documentation"],
      narrative_history: ["emperor", "empire", "dynasty", "reign", "century", "kingdom", "war", "ancient", "republic", "senate", "historical", "biography", "chronicle", "civilization"],
      meetings_dialogue: ["standup", "transcript", "attendees", "moderator", "speaker", "agenda", "minutes of meeting", "sprint", "interview"],
      actionable: ["action items", "checklist", "step 1", "step 2", "next steps", "how to", "playbook", "todo", "guidelines"],
      chain_of_density: ["wikipedia", "encyclopedia", "metabolism", "digestion", "physiology"],
    };

    let bestCat = u.includes("wikipedia.org") ? "chain_of_density" : "executive";
    let bestScore = 0;
    for (const [cat, words] of Object.entries(lexicons)) {
      let score = 0;
      for (const w of words) {
        if (combined.includes(w)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestCat = cat;
      }
    }
    return bestCat;
  }

  // Listen for messages from extension toolbar popup.js
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "extractContent") {
        try {
          const text = extractCleanText();
          const meta = getPageMeta();
          sendResponse({
            success: true,
            text,
            meta,
            charCount: text.length,
            wordCount: text.split(/\s+/).filter(Boolean).length,
          });
        } catch (err) {
          sendResponse({
            success: false,
            error: err.message,
            text: document.body.innerText?.substring(0, 5000) || "",
          });
        }
      }
      return true;
    });
  }

  // Do not inject floating button on OmniLogic's own dashboard
  if (location.hostname === "localhost" || location.hostname.includes("omnilogic")) {
    return;
  }

  // Create Floating On-Page Commercial Extension Widget (Shadow DOM isolated so site CSS never breaks it)
  function mountFloatingExtensionWidget() {
    if (document.getElementById("omnilogic-floating-root")) return;

    const host = document.createElement("div");
    host.id = "omnilogic-floating-root";
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .omnilogic-fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483646;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        border-radius: 999px;
        background: linear-gradient(135deg, #101018 0%, #191926 100%);
        color: #ffffff;
        border: 1.5px solid rgba(123, 208, 255, 0.55);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.65), 0 0 20px rgba(123, 208, 255, 0.25);
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.3px;
        transition: all 0.2s ease;
        user-select: none;
      }
      .omnilogic-fab:hover {
        transform: translateY(-2px) scale(1.03);
        border-color: #7bd0ff;
        box-shadow: 0 14px 36px rgba(0, 0, 0, 0.8), 0 0 28px rgba(123, 208, 255, 0.45);
      }
      .omnilogic-fab-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #7bd0ff;
        box-shadow: 0 0 10px #7bd0ff;
      }
      .omnilogic-panel {
        position: fixed;
        bottom: 78px;
        right: 24px;
        z-index: 2147483647;
        width: 380px;
        max-height: 540px;
        display: none;
        flex-direction: column;
        border-radius: 18px;
        background: #0c0c14;
        color: #e5e2e1;
        border: 1px solid rgba(123, 208, 255, 0.4);
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.88), 0 0 35px rgba(123, 208, 255, 0.18);
        overflow: hidden;
      }
      .omnilogic-panel.open { display: flex; }
      .omnilogic-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 13px 16px;
        background: linear-gradient(90deg, rgba(221, 183, 255, 0.12), rgba(123, 208, 255, 0.12));
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .omnilogic-title {
        font-size: 13px;
        font-weight: 700;
        color: #fff;
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .omnilogic-close {
        background: transparent;
        border: none;
        color: #aaa;
        font-size: 18px;
        cursor: pointer;
        line-height: 1;
      }
      .omnilogic-close:hover { color: #fff; }
      .omnilogic-modes {
        display: flex;
        gap: 5px;
        padding: 10px 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        overflow-x: auto;
      }
      .omnilogic-mode-btn {
        padding: 5px 10px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.04);
        color: #ccc;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      }
      .omnilogic-mode-btn.active {
        background: #7bd0ff;
        color: #000;
        border-color: #7bd0ff;
        font-weight: 700;
      }
      .omnilogic-body {
        padding: 14px 16px;
        overflow-y: auto;
        font-size: 12.5px;
        line-height: 1.6;
        white-space: pre-wrap;
        max-height: 360px;
      }
      .omnilogic-footer {
        padding: 10px 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        color: #7bd0ff;
        background: rgba(0, 0, 0, 0.4);
      }
      .omnilogic-run-btn {
        padding: 6px 13px;
        border-radius: 8px;
        border: none;
        background: linear-gradient(90deg, #7bd0ff, #ddb7ff);
        color: #000;
        font-weight: 700;
        font-size: 11px;
        cursor: pointer;
      }
    `;

    const container = document.createElement("div");
    container.innerHTML = `
      <div class="omnilogic-panel" id="ol-panel">
        <div class="omnilogic-header">
          <div class="omnilogic-title">
            <span class="omnilogic-fab-dot"></span>
            <span>OmniLogic AI Summarizer</span>
          </div>
          <button class="omnilogic-close" id="ol-close">✕</button>
        </div>
        <div class="omnilogic-modes" id="ol-modes">
          <button class="omnilogic-mode-btn active" data-mode="auto">✨ Auto-Detect</button>
          <button class="omnilogic-mode-btn" data-mode="executive">Executive</button>
          <button class="omnilogic-mode-btn" data-mode="technical">Technical</button>
          <button class="omnilogic-mode-btn" data-mode="chain_of_density">Dense (CoD)</button>
          <button class="omnilogic-mode-btn" data-mode="actionable">Action Items</button>
        </div>
        <div class="omnilogic-body" id="ol-body">Click "Summarize This Page" below to distill this webpage right here.</div>
        <div class="omnilogic-footer">
          <span id="ol-stats">✨ Auto-Detect Topic Ready</span>
          <button class="omnilogic-run-btn" id="ol-run">⚡ Summarize Page</button>
        </div>
      </div>
      <button class="omnilogic-fab" id="ol-fab" title="Summarize this webpage with OmniLogic AI">
        <span class="omnilogic-fab-dot"></span>
        <span>⚡ Summarize Page</span>
      </button>
    `;

    shadow.appendChild(style);
    shadow.appendChild(container);

    let currentMode = "auto";
    const panel = shadow.getElementById("ol-panel");
    const fab = shadow.getElementById("ol-fab");
    const closeBtn = shadow.getElementById("ol-close");
    const runBtn = shadow.getElementById("ol-run");
    const bodyEl = shadow.getElementById("ol-body");
    const statsEl = shadow.getElementById("ol-stats");
    const modeBtns = shadow.querySelectorAll(".omnilogic-mode-btn");

    modeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        modeBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentMode = btn.getAttribute("data-mode") || "auto";
      });
    });

    async function triggerSummarize() {
      const selectedText = window.getSelection()?.toString()?.trim() || "";
      const pageText = selectedText.length > 60 ? selectedText : extractCleanText();
      if (!pageText || pageText.length < 30) {
        bodyEl.textContent = "Not enough readable text found on this page.";
        return;
      }

      const effectiveMode = currentMode === "auto" ? autoDetectCategory(pageText) : currentMode;
      const catLabel = CATEGORY_LABELS[effectiveMode] || effectiveMode;

      bodyEl.textContent = `⏳ Auto-recognized topic as [${catLabel}]. Extracting & summarizing with OmniLogic AI...`;
      statsEl.textContent = `🎯 ${catLabel}`;

      for (const endpoint of API_ENDPOINTS) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: pageText, mode: effectiveMode }),
          });
          if (res.ok) {
            const data = await res.json();
            const rawSum = data.summary || data.result || "Summary generated.";
            const strictHeaders = {
              scientific_academic: ["Research Objective & Academic Scope", "Methodology & Structural Framework", "Empirical Findings & Quantitative Specs", "Scholarly Conclusions & Guidelines"],
              technical: ["Technical Overview & System Scope", "Core Mechanisms & Implementation", "Configuration & Operational Pipeline", "Performance Metrics & Verification"],
              architecture: ["System Topology & Architectural Pattern", "Component Boundaries & Data Flow", "Scalability & Trade-off Analysis", "Operational Resilience & Deployment"],
              legal_governance: ["Statutory & Constitutional Scope", "Structural Provisions & Mandates", "Foundational Rights & Obligations", "Enforcement & Amendment Mechanisms"],
              finance_product: ["Financial & Market Overview", "Core Performance & Valuation Metrics", "Portfolio Composition & Strengths", "Strategic Verdict & Fiscal Outlook"],
              narrative_history: ["Historical Context & Origins", "Chronological Milestones & Events", "Governance, Reforms & Cultural Shifts", "Historical Impact & Enduring Legacy"],
              meetings_dialogue: ["Meeting Context & Core Agenda", "Key Decisions & Consensus Reached", "Open Questions, Risks & Blockers", "Assigned Action Items & Next Steps"],
              actionable: ["Primary Objective & Action Scope", "Step-by-Step Execution Directives", "Key Rules & Operational Standards", "Immediate Deliverables & Checklist"],
              chain_of_density: ["Core Subject & Foundational Definition", "High-Density Quantitative & Causal Facts", "Structural Taxonomy & Classifications", "Empirical Synthesis & Systemic Impact"],
              executive: ["Executive Summary & Core Thesis", "Key Quantitative Highlights & Facts", "Foundational Pillars & Structure", "Strategic Takeaways & Recommendations"],
            };
            const targetH = strictHeaders[effectiveMode] || strictHeaders.executive;
            let bIdx = 0;
            const cleanedSum = rawSum.split("\n").map((l) =>
              l.replace(/^[•\-*]\s*\*\*([^*]+)\*\*:\s*(?:[A-Z][A-Za-z0-9 &.,'-]{3,35}?\s*—\s*)?/, () => {
                const h = targetH[Math.min(bIdx, targetH.length - 1)];
                bIdx++;
                return `• **${h}**: `;
              })
            ).join("\n");
            bodyEl.textContent = cleanedSum;
            if (data.metrics) {
              statsEl.textContent = `🎯 ${catLabel} • ${data.metrics.summary_words}w`;
            } else {
              statsEl.textContent = `🎯 ${catLabel} • Complete`;
            }
            return;
          }
        } catch (_) {}
      }

      bodyEl.textContent = "Could not connect to OmniLogic API. Please ensure the backend is online.";
      statsEl.textContent = "Connection error";
    }

    fab.addEventListener("click", () => {
      const isOpen = panel.classList.toggle("open");
      if (isOpen && bodyEl.textContent.startsWith("Click ")) {
        triggerSummarize();
      }
    });

    closeBtn.addEventListener("click", () => {
      panel.classList.remove("open");
    });

    runBtn.addEventListener("click", () => {
      triggerSummarize();
    });
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    mountFloatingExtensionWidget();
  } else {
    window.addEventListener("DOMContentLoaded", mountFloatingExtensionWidget);
  }
})();
