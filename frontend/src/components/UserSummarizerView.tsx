"use client";

import React, { useState, useEffect } from "react";
import { API_HOSTS } from "@/lib/api";

interface UserSummarizerViewProps {
  onOpenAdminLogin?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  auto: "✨ AI Auto-Detect (Simultaneous)",
  executive: "Executive Overview",
  technical: "Technical & Engineering",
  architecture: "Systems Architecture",
  chain_of_density: "Dense (Chain-of-Density)",
  actionable: "Action Items & Directives",
  finance_product: "Finance & Product Reviews",
  narrative_history: "Narrative & History",
  meetings_dialogue: "Meetings & Dialogue",
  scientific_academic: "Scientific & Academic",
  legal_governance: "Legal, Policy & Governance",
};

const STRICT_CATEGORY_HEADERS: Record<string, string[]> = {
  scientific_academic: [
    "Research Objective & Academic Scope",
    "Methodology & Structural Framework",
    "Empirical Findings & Quantitative Specs",
    "Scholarly Conclusions & Guidelines",
  ],
  technical: [
    "Technical Overview & System Scope",
    "Core Mechanisms & Implementation",
    "Configuration & Operational Pipeline",
    "Performance Metrics & Verification",
  ],
  architecture: [
    "System Topology & Architectural Pattern",
    "Component Boundaries & Data Flow",
    "Scalability & Trade-off Analysis",
    "Operational Resilience & Deployment",
  ],
  legal_governance: [
    "Statutory & Constitutional Scope",
    "Structural Provisions & Mandates",
    "Foundational Rights & Obligations",
    "Enforcement & Amendment Mechanisms",
  ],
  finance_product: [
    "Financial & Market Overview",
    "Core Performance & Valuation Metrics",
    "Portfolio Composition & Strengths",
    "Strategic Verdict & Fiscal Outlook",
  ],
  narrative_history: [
    "Historical Context & Origins",
    "Chronological Milestones & Events",
    "Governance, Reforms & Cultural Shifts",
    "Historical Impact & Enduring Legacy",
  ],
  meetings_dialogue: [
    "Meeting Context & Core Agenda",
    "Key Decisions & Consensus Reached",
    "Open Questions, Risks & Blockers",
    "Assigned Action Items & Next Steps",
  ],
  actionable: [
    "Primary Objective & Action Scope",
    "Step-by-Step Execution Directives",
    "Key Rules & Operational Standards",
    "Immediate Deliverables & Checklist",
  ],
  chain_of_density: [
    "Core Subject & Foundational Definition",
    "High-Density Quantitative & Causal Facts",
    "Structural Taxonomy & Classifications",
    "Empirical Synthesis & Systemic Impact",
  ],
  executive: [
    "Executive Summary & Core Thesis",
    "Key Quantitative Highlights & Facts",
    "Foundational Pillars & Structure",
    "Strategic Takeaways & Recommendations",
  ],
};

function autoDetectTopicCategory(text = "", url = ""): string {
  const combined = `${url} ${(text || "").substring(0, 12000)}`.toLowerCase();
  const u = (url || "").toLowerCase();

  if (u.includes("arxiv.org") || u.includes("ncbi.nlm") || u.includes("ieee.org") || u.includes("sciencedirect")) {
    return "scientific_academic";
  }
  if (u.includes("readthedocs.io") || u.includes("github.com") || u.includes("gitlab.com") || u.includes("stackoverflow.com")) {
    return "technical";
  }

  const lexicons: Record<string, string[]> = {
    legal_governance: [
      "constitution", "article ", "amendment", "statute", "supreme court", "parliament",
      "jurisdiction", "fundamental rights", "clause", "ordinance", "legislation", "statutory",
      "governance", "directive principles", "schedule",
    ],
    scientific_academic: [
      "research paper", "dissertation", "thesis", "literature review", "conference",
      "journal", "ieee", "acm", "abstract", "methodology", "hypothesis", "et al", "arxiv",
      "empirical", "theorem", "experiment", "transduction", "neural network", "citation",
      "peer-reviewed", "preprint", "university",
    ],
    finance_product: [
      "factsheet", "mutual fund", "index fund", "expense ratio", "gross margin",
      "free cash flow", "portfolio", "dividend", "sharpe ratio", "market cap",
      "valuation", "ebitda", "quarterly revenue", "fiscal year", "stock market",
    ],
    architecture: [
      "monolithic", "microservices", "distributed system", "system topology", "sharding",
      "vector index", "hnsw", "ivfflat", "load balancer", "high availability", "consensus",
      "data flow", "message queue", "kafka", "event-driven", "scalability", "database schema",
    ],
    technical: [
      "fastapi", "uvicorn", "python", "javascript", "typescript", "docker", "kubernetes",
      "sqlalchemy", "endpoint", "memory leak", "garbage collection", "compiler",
      "post-mortem", "outage", "oauth", "repository", "tutorial", "documentation", "source code",
    ],
    narrative_history: [
      "emperor", "empire", "dynasty", "reign", "century", "kingdom", "ancient",
      "republic", "senate", "historical", "biography", "chronicle", "treaty", "civilization",
      "world war", "invasion", "monarch", "revolution",
    ],
    meetings_dialogue: [
      "standup", "transcript", "attendees", "moderator", "speaker", "agenda",
      "minutes of meeting", "blocker", "sprint", "q&a", "interview", "discussion",
    ],
    actionable: [
      "action items", "checklist", "step 1", "step 2", "next steps", "how to",
      "playbook", "todo", "deliverables", "standard operating procedure", "guidelines",
    ],
    chain_of_density: [
      "wikipedia", "encyclopedia", "metabolism", "digestion", "physiology",
      "comprehensive overview", "thermogenesis",
    ],
  };

  let bestCat = u.includes("wikipedia.org") ? "chain_of_density" : "executive";
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

function enforceStrictCategoryHeadings(rawSummary: string, mode: string): string {
  if (!rawSummary) return "";
  const headers = STRICT_CATEGORY_HEADERS[mode] || STRICT_CATEGORY_HEADERS.executive;
  const allowedLower = new Set(headers.map((h) => h.toLowerCase()));

  let bulletIdx = 0;
  const lines = rawSummary
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";

      const m = trimmed.match(/^(?:[•\-*]\s*)?\*\*([^*]+)\*\*:\s*(.*)$/);
      if (m) {
        const existingHeading = m[1].trim();
        let body = m[2].trim();
        body = body.replace(/^[A-Z][A-Za-z0-9 &.,'-]{2,40}?([A-Z][a-z]{3,}\b)/, "$1");

        const targetHeading = allowedLower.has(existingHeading.toLowerCase())
          ? existingHeading
          : headers[Math.min(bulletIdx, headers.length - 1)];
        bulletIdx++;
        return `• **${targetHeading}**: ${body}`;
      }
      return trimmed;
    })
    .filter(Boolean);

  return lines.join("\n");
}

export const UserSummarizerView = ({ onOpenAdminLogin }: UserSummarizerViewProps) => {
  const [inputText, setInputText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [selectedMode, setSelectedMode] = useState("auto");
  const [determinedMode, setDeterminedMode] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryResult, setSummaryResult] = useState<any>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sharedUrl = params.get("url");
      const sharedText = params.get("text");
      if (sharedText && sharedText.trim().length > 40) {
        setInputText(sharedText.trim());
        handleRunSummarize(sharedText.trim());
      } else if (sharedUrl && sharedUrl.trim()) {
        setUrlInput(sharedUrl.trim());
        handleSummarizeUrl(sharedUrl.trim());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const SAMPLE_PRESETS = [
    {
      title: "🏛️ Indian Constitution",
      text: "The Constitution of India originally contained 395 articles in 22 parts and 8 schedules when it took effect on January 26, 1950. Through constitutional amendments, it has grown to 448+ articles across 25 parts and 12 schedules. Key foundational articles include: Article 1 declares India a Union of States. Article 14 guarantees equality before the law. Article 19 protects fundamental freedoms of speech and assembly. Article 21 guarantees the right to life and personal liberty, while Article 21A guarantees free and compulsory education for children. Article 32 grants the right to move the Supreme Court via constitutional writs. Article 51A outlines fundamental duties.",
    },
    {
      title: "⚡ Production Incident",
      text: "Incident Post-Mortem INC-9402: At 03:14 UTC, production Kubernetes ingress nodes experienced an out-of-memory crash across us-east-1. Telemetry buffer in the gRPC middleware retained cyclic references during downstream Redis latency spikes. Heap allocation reached 15.6 GB dropping 18% of edge traffic. Hotfix v4.8.2 introduced explicit ring-buffer bounds (256MB) and circuit-breaker eviction, restoring memory to 1.1 GB with zero packet loss.",
    },
    {
      title: "🎓 Research Paper Format",
      text: "Exact length and formatting depend on your university or target conference/journal: Research Paper (Conference / Journal): Usually 4–8 pages in IEEE/ACM two-column layout, covering abstract, introduction, literature review, methodology, results, conclusion, and references. Standard Page & Text Formatting (for reports): A4 paper size, Times New Roman 12 pt body text, 1.5 line spacing, and 1-inch margins (1.25–1.5 inches on the left).",
    },
  ];

  const processBackendSummaryResponse = (data: any, sourceText: string, sourceUrl = "") => {
    let rawOutput = data.summary || data.result || "";
    let aiCat = data.mode && data.mode !== "auto" ? data.mode : "";

    const firstLineMatch = rawOutput.match(/^\s*(?:\*\*)?CATEGORY(?:\*\*)?:\s*([a-z_]+)\s*\n/i);
    if (firstLineMatch) {
      aiCat = firstLineMatch[1].toLowerCase().trim();
      rawOutput = rawOutput.replace(/^\s*(?:\*\*)?CATEGORY(?:\*\*)?:\s*[a-z_]+\s*\n/i, "").trim();
    }

    const finalCat =
      selectedMode !== "auto"
        ? selectedMode
        : aiCat && STRICT_CATEGORY_HEADERS[aiCat]
        ? aiCat
        : autoDetectTopicCategory(`${rawOutput} ${sourceText}`, sourceUrl);

    const strictSummary = enforceStrictCategoryHeadings(rawOutput, finalCat);
    setDeterminedMode(finalCat);
    setSummaryResult({
      ...data,
      mode: finalCat,
      summary: strictSummary,
    });
  };

  const handleRunSummarize = async (textToSummarize?: string) => {
    const text = (textToSummarize || inputText).trim();
    if (!text) return;

    // Auto-detect if user pasted a single URL link instead of raw text
    const isSingleUrl =
      (text.startsWith("http://") ||
        text.startsWith("https://") ||
        /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(text)) &&
      text.split(/\s+/).length === 1;
    if (isSingleUrl) {
      setUrlInput(text);
      await handleSummarizeUrl(text);
      return;
    }

    setIsSummarizing(true);
    setSummaryResult(null);

    const reqMode = selectedMode === "auto" ? "auto" : selectedMode;

    for (const host of ["http://127.0.0.1:8000", ...API_HOSTS]) {
      try {
        const res = await fetch(`${host}/api/v1/summarize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, mode: reqMode }),
        });
        if (res.ok) {
          const data = await res.json();
          processBackendSummaryResponse(data, text);
          setIsSummarizing(false);
          return;
        }
      } catch (_) {}
    }

    // Client-side simultaneous categorization & summary fallback
    setTimeout(() => {
      const finalCat = selectedMode !== "auto" ? selectedMode : autoDetectTopicCategory(text);
      const headers = STRICT_CATEGORY_HEADERS[finalCat] || STRICT_CATEGORY_HEADERS.executive;
      const sentences = text
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 20);
      const originalWords = text.split(/\s+/).length;
      const summaryText = sentences
        .slice(0, 4)
        .map((s, idx) => `• **${headers[idx] || headers[headers.length - 1]}**: ${s.replace(/[.!?]+$/, "")}.`)
        .join("\n");
      const summaryWords = summaryText.split(/\s+/).length;

      setDeterminedMode(finalCat);
      setSummaryResult({
        mode: finalCat,
        summary: summaryText,
        metrics: {
          original_words: originalWords,
          summary_words: summaryWords,
          compression_ratio: +(summaryWords / Math.max(originalWords, 1)).toFixed(2),
          reading_time_saved_seconds: Math.round(Math.max(((originalWords - summaryWords) / 200) * 60, 0)),
        },
      });
      setIsSummarizing(false);
    }, 300);
  };

  const handleSummarizeUrl = async (overrideUrl?: string) => {
    const target = (overrideUrl || urlInput).trim();
    if (!target) return;
    setIsSummarizing(true);
    setSummaryResult(null);

    const reqMode = selectedMode === "auto" ? "auto" : selectedMode;
    let lastErrorMessage = "";

    for (const host of ["http://127.0.0.1:8000", ...API_HOSTS]) {
      try {
        const res = await fetch(`${host}/api/v1/summarize/url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: target, mode: reqMode }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.extracted_text) {
            setInputText(data.extracted_text);
          }
          processBackendSummaryResponse(data, data.extracted_text || "", target);
          setIsSummarizing(false);
          return;
        } else {
          const errData = await res.json().catch(() => null);
          if (errData?.detail) {
            lastErrorMessage = errData.detail;
          }
        }
      } catch (e: any) {
        lastErrorMessage = e?.message || "";
      }
    }

    setIsSummarizing(false);
    alert(
      lastErrorMessage ||
        `Could not retrieve text from "${target}". The website may require login authentication or have bot protection. Please copy the article text and paste it into the box below, or use the OmniLogic Chrome Extension on the active tab.`
    );
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setUploadedFileName(file.name);
    setIsSummarizing(true);
    setSummaryResult(null);

    const reqMode = selectedMode === "auto" ? "auto" : selectedMode;

    for (const host of ["http://127.0.0.1:8000", ...API_HOSTS]) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("mode", reqMode);
        formData.append("auto_summarize", "true");
        const res = await fetch(`${host}/api/v1/extract/file`, {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.extracted_text) {
            setInputText(data.extracted_text);
            if (data.auto_summary) {
              processBackendSummaryResponse(
                {
                  summary: data.auto_summary,
                  mode: data.mode || reqMode,
                  metrics: data.metrics,
                },
                data.extracted_text
              );
              setIsSummarizing(false);
              return;
            }
            await handleRunSummarize(data.extracted_text);
            return;
          }
        }
      } catch (_) {}
    }

    setIsSummarizing(false);
  };

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* Hero Welcome Header */}
      <div className="text-center space-y-2 pt-2 pb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/25 text-secondary text-xs font-mono uppercase tracking-wider mb-1">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
          Universal AI Summarizer • Simultaneous Topic Recognition
        </div>
        <h1 className="text-3xl sm:text-4xl font-h1 font-bold text-white tracking-tight">
          Distill Any Document into Pure Insight
        </h1>
        <p className="text-sm sm:text-base text-on-surface-variant max-w-2xl mx-auto">
          Paste any link, upload a PDF/image, or drop in raw text — OmniLogic simultaneously recognizes the topic category across 10 domain streams and tailors every summary point automatically.
        </p>
      </div>

      {/* Input Options: Simultaneous Category Banner, URL, File Upload, Text Area */}
      <div className="obsidian-panel glass-pane rounded-2xl p-4 sm:p-5 border border-white/10 space-y-4">
        {/* Simultaneous AI Topic Recognition Bar (Matches Chrome Extension!) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-r from-secondary/10 via-primary/10 to-black/40 border border-secondary/30">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🎯</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-white">
                  {selectedMode === "auto"
                    ? determinedMode
                      ? `Determined Category: ${CATEGORY_LABELS[determinedMode] || determinedMode}`
                      : "Topic Category: AI Auto-Detect (On Summarize)"
                    : `Manual Category: ${CATEGORY_LABELS[selectedMode]}`}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded-full bg-secondary/15 text-secondary border border-secondary/30">
                  {selectedMode === "auto"
                    ? determinedMode
                      ? "🎯 AI Determined"
                      : "✨ Simultaneous AI"
                    : "⚙️ Manual Override"}
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                No need to choose a category — the AI determines the exact domain while summarizing and locks all bullet headings to it.
              </p>
            </div>
          </div>

          <select
            value={selectedMode}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedMode(val);
              if (val !== "auto") {
                setDeterminedMode(val);
              }
            }}
            title="Optional: Override automatic category detection"
            className="bg-[#12121a] border border-white/15 text-xs text-on-surface-variant hover:text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-secondary cursor-pointer self-end sm:self-center"
          >
            <option value="auto">✨ Auto-Detect (Recommended)</option>
            <option value="executive">Executive Overview</option>
            <option value="technical">Technical &amp; Engineering</option>
            <option value="architecture">Systems Architecture</option>
            <option value="chain_of_density">Dense (Chain-of-Density)</option>
            <option value="actionable">Action Items &amp; Directives</option>
            <option value="finance_product">Finance &amp; Product Reviews</option>
            <option value="narrative_history">Narrative &amp; History</option>
            <option value="meetings_dialogue">Meetings &amp; Dialogue</option>
            <option value="scientific_academic">Scientific &amp; Academic</option>
            <option value="legal_governance">Legal, Policy &amp; Governance</option>
          </select>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono text-on-surface-variant">Sample Topics:</span>
          {SAMPLE_PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => {
                setInputText(p.text);
                setSelectedMode("auto");
                setDeterminedMode(null);
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-on-surface-variant hover:text-white transition-colors cursor-pointer"
            >
              {p.title}
            </button>
          ))}
        </div>

        {/* Live URL Input Bar */}
        <div className="flex flex-col sm:flex-row gap-2 bg-black/50 p-2 rounded-xl border border-white/10">
          <div className="flex items-center gap-2 flex-1 px-2">
            <span className="material-symbols-outlined text-secondary text-[18px]">link</span>
            <input
              type="url"
              placeholder="Paste any live article or webpage link (e.g. Wikipedia, tech doc)..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-on-surface-variant/50 outline-none"
            />
          </div>
          <button
            onClick={() => handleSummarizeUrl()}
            disabled={isSummarizing || !urlInput.trim()}
            className="slate-glass-btn text-xs font-bold uppercase py-2 px-4 flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[15px] text-secondary">bolt</span>
            Summarize URL
          </button>
        </div>

        {/* File Drag & Drop / Upload */}
        <label className="flex items-center justify-between p-3 rounded-xl border border-dashed border-white/15 hover:border-secondary/50 bg-black/20 hover:bg-secondary/5 cursor-pointer transition-all">
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-secondary text-[22px]">upload_file</span>
            <div>
              <span className="text-xs font-bold text-white block">
                {uploadedFileName ? `Attached: ${uploadedFileName}` : "Upload Document or Image (PDF, JPG, PNG)"}
              </span>
              <span className="text-[11px] text-on-surface-variant">
                Extracts text, simultaneously determines category, and summarizes
              </span>
            </div>
          </div>
          <span className="text-[11px] font-mono text-secondary px-2.5 py-1 rounded bg-secondary/10">
            Browse File
          </span>
        </label>

        {/* Raw Text Box */}
        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-wider text-on-surface-variant block">
            Or Paste Article / Text Content Directly:
          </label>
          <textarea
            rows={5}
            placeholder="Paste any text, article, notes, or transcript here..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-on-surface-variant/40 outline-none focus:border-secondary transition-all"
          />
          <div className="flex justify-between items-center pt-1">
            <span className="text-[11px] font-mono text-on-surface-variant/60">
              {inputText ? inputText.trim().split(/\s+/).length : 0} words
            </span>
            <button
              onClick={() => handleRunSummarize()}
              disabled={isSummarizing || !inputText.trim()}
              className="ghost-glow-btn text-xs font-bold uppercase py-2 px-5 flex items-center gap-2 cursor-pointer disabled:opacity-40"
            >
              <span className={`material-symbols-outlined text-[16px] ${isSummarizing ? "animate-spin" : ""}`}>
                {isSummarizing ? "sync" : "auto_awesome"}
              </span>
              {isSummarizing ? "Simultaneously Categorizing & Summarizing..." : "Summarize Now"}
            </button>
          </div>
        </div>
      </div>

      {/* Summary Output Result */}
      {summaryResult && (
        <div className="obsidian-panel glass-pane rounded-2xl p-5 sm:p-6 border border-secondary/40 space-y-4 shadow-2xl animate-fade-in">
          <div className="flex flex-wrap justify-between items-center gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse"></span>
              <span className="text-xs font-mono font-bold uppercase text-secondary tracking-wider">
                🎯 {CATEGORY_LABELS[summaryResult.mode] || summaryResult.mode}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-secondary/10 text-secondary border border-secondary/25">
                {selectedMode === "auto" ? "✨ Determined by AI" : "Manual Category"}
              </span>
            </div>
            {summaryResult.metrics && (
              <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  Saved ~{summaryResult.metrics.reading_time_saved_seconds || 45}s reading time
                </span>
                <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-on-surface-variant">
                  {summaryResult.metrics.summary_words || 60} words
                </span>
              </div>
            )}
          </div>

          <div className="text-xs sm:text-sm text-white leading-relaxed whitespace-pre-wrap font-sans">
            {summaryResult.summary}
          </div>

          <div className="flex justify-end pt-2 border-t border-white/5">
            <button
              onClick={() => {
                navigator.clipboard.writeText(summaryResult.summary);
                alert("Summary copied to clipboard!");
              }}
              className="text-xs font-mono text-on-surface-variant hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">content_copy</span>
              Copy Summary
            </button>
          </div>
        </div>
      )}

      {/* Admin Link at the Bottom */}
      <div className="text-center pt-8 pb-4">
        <button
          onClick={onOpenAdminLogin}
          className="text-[11px] font-mono text-on-surface-variant/40 hover:text-on-surface-variant/80 transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]">admin_panel_settings</span>
          Administrator Portal
        </button>
      </div>
    </div>
  );
};
