import asyncio
import json
import logging
import re
import ssl
import urllib.error
import urllib.request
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.core.vector import vector_service
from app.training.dataset import dataset_manager, evaluate_summary, tokenize_words

logger = logging.getLogger(__name__)


def sanitize_text(text: str) -> str:
    """Removes UI chrome, Wikipedia footnotes, citation brackets, and preserves Article/Section labels."""
    if not text:
        return ""

    raw_input = text
    # 0. Remove Google Search / AI Mode UI noise lines and raw table/nav noise
    noise_patterns = [
        r"^AI Mode conversation:.*$",
        r"^Do you want to provide feedback\??.*$",
        r"^Thank you for your feedback.*$",
        r"^Provide feedback on.*$",
        r"^Appearance hide.*$",
        r"^From Wikipedia, the free encyclopedia.*$",
    ]
    clean_lines = []
    for line in text.splitlines():
        trimmed = line.strip()
        if not trimmed:
            continue
        if any(re.match(pat, trimmed, flags=re.I) for pat in noise_patterns):
            continue
        # Remove inline "AI Mode conversation: ... Do you want to provide feedback."
        trimmed = re.sub(
            r"AI Mode conversation:.*?Do you want to provide feedback\.?",
            "",
            trimmed,
            flags=re.I,
        ).strip()
        if not trimmed:
            continue
        # Drop only short markdown divider rows like |---|---|
        if len(trimmed) < 100 and re.match(r"^\|?[\s:-]+\|[\s:-|]+$", trimmed):
            continue
        clean_lines.append(trimmed)

    if not clean_lines or len("\n".join(clean_lines).strip()) < 30:
        text = raw_input.strip()
    else:
        text = "\n".join(clean_lines)

    # 1. Join "Article 14. Guarantees..." -> "Article 14: Guarantees..." so sentence splitting never drops "Article 14"
    text = re.sub(
        r"\b(Article\s+\d+[A-Z]?(?:\s*(?:&|,|and)\s*\d+[A-Z]?)*)\.\s+",
        r"\1: ",
        text,
    )

    # 2. Strip double-bracketed markdown citation groups like [[1](url), [2](url)]
    text = re.sub(r"\[\s*(?:\[\d+\]\([^)]+\)\s*,?\s*)+\]", "", text)
    # 3. Strip markdown citation links where text is just footnotes: [\[b\]](url), [1](url)
    text = re.sub(
        r"\[(?:\\?\[)?\s*(?:cite_note|note|edit|\d{1,4}|[a-zA-Z]{1,3})\s*(?:\\?\])?\]\([^)]+\)",
        "",
        text,
        flags=re.I,
    )
    # 4. Unpack real concept links: [Legislative Department of India](url) -> Legislative Department of India
    text = re.sub(r"\[([^\]\n]+)\]\([^)]+\)", r"\1", text)
    # 5. Strip bracketed footnotes: [13], [b], \[15\], [a], [edit], [citation needed]
    text = re.sub(
        r"\\?\[(?:\\?\[)?\s*(?:cite_note|note|edit|\d{1,4}|[a-zA-Z]{1,3}|citation needed)\s*(?:\\?\])?\\?\]",
        "",
        text,
        flags=re.I,
    )
    text = re.sub(r"\[\s*\d+\s*\]", "", text)
    text = re.sub(r"\[\s*[a-zA-Z]\s*\]", "", text)
    text = text.replace(r"\[", "").replace(r"\]", "")

    # 6. Clean glued Wikipedia headings and inline edit buttons
    text = re.sub(
        r"\b(?:Military innovations|Taxation|Economy Trade|Trade|Culture|Administration|Economy)\s+(?=[A-Z])",
        "",
        text,
    )
    text = re.sub(r"([a-zA-Z]+)edit\b", r"\1", text)
    text = re.sub(r"\b(edit|edit section)\b", "", text, flags=re.I)

    # 7. Fix punctuation spacing
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    text = re.sub(r"([,.;:!?])\1+", r"\1", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


SUMMARIZATION_PROMPTS = {
    "executive": (
        "You are the OmniLogic Executive Summarizer. Produce a comprehensive, structured executive summary "
        "covering the core overview, key quantitative facts/metrics, foundational components, and strategic takeaways. "
        "Use crisp markdown bullet points with bold headings and preserve all key numbers, articles, and named entities."
    ),
    "technical": (
        "You are the OmniLogic Deep Technical Summarizer. Analyze the technical architecture, structural taxonomy, "
        "core mechanisms, exact specifications/numbers, and verification metrics. Use structured markdown sections and bullets."
    ),
    "architecture": (
        "You are the OmniLogic Systems Architecture Summarizer. Synthesize system topology, structural hierarchy, "
        "data-flow boundaries, trade-offs, and core operational components in detailed markdown sections."
    ),
    "chain_of_density": (
        "You are the OmniLogic Chain-of-Density Summarizer. Generate a summary that is maximally dense in salient entities, "
        "measurements, dates, and causal connections while remaining clean, comprehensive, and structured."
    ),
    "actionable": (
        "You are the OmniLogic Action-Oriented Summarizer. Convert the input into immediate actionable directives: "
        "Core Scope, Critical Provisions/Actions, Key Rules, and Practical Takeaways."
    ),
    "finance_product": (
        "You are the OmniLogic Finance & Product Review Summarizer. Extract financial metrics (ARR, margins, ROI, pricing), "
        "product strengths/weaknesses, competitive differentiation, and verdict."
    ),
    "narrative_history": (
        "You are the OmniLogic Long-Form Narrative & History Summarizer. Synthesize historical context, chronological milestones, "
        "key figures, structural reforms, cultural/societal transformations, and enduring legacy."
    ),
    "meetings_dialogue": (
        "You are the OmniLogic Meetings & Unstructured Dialogue Summarizer. Distill multi-speaker transcripts into "
        "Core Agenda & Consensus, Key Decisions Made, Open Questions/Blockers, and Assigned Action Items."
    ),
    "scientific_academic": (
        "You are the OmniLogic Scientific & Academic Summarizer. Structure the synthesis into Research Objective, "
        "Methodology & Framework, Quantitative Findings, and Theoretical/Practical Implications."
    ),
    "legal_governance": (
        "You are the OmniLogic Legal, Policy & Governance Summarizer. Extract Constitutional/Statutory Scope & Structure, "
        "Major Parts & Schedules, Foundational Articles & Rights, and Amendment/Governance Mechanisms."
    ),
}


class EfficientSummarizer:
    def _prepare_hierarchical_context(self, text: str, max_chars: int = 85000) -> str:
        """For huge documents (e.g., 400+ page PDFs), preserves complete beginning-to-end coverage across all chapters/pages."""
        if len(text) <= max_chars:
            return text
        # Sample evenly across 25 distributed windows from Page 1 through the final page so every section of a 402-page PDF is represented
        num_windows = 25
        window_size = max_chars // num_windows
        step = max((len(text) - window_size) // max(num_windows - 1, 1), 1)
        segments = []
        for i in range(num_windows):
            start = i * step
            chunk = text[start : start + window_size].strip()
            pct = round((start / max(len(text), 1)) * 100)
            segments.append(f"--- [DOCUMENT SECTION {i + 1}/{num_windows} (~{pct}% through document)] ---\n{chunk}")
        return "\n\n".join(segments)

    def _retrieve_trained_exemplars(self, text: str, mode: str, top_k: int = 2) -> List[Dict[str, Any]]:
        """
        Searches dataset_manager.examples with STRICT category isolation.
        When `mode` is provided, ONLY exemplars belonging to that exact `mode` category are eligible,
        preventing cross-category contamination (e.g., finance headers leaking into scientific/academic summaries).
        """
        query_words = set(tokenize_words(text[:4000]))
        if not query_words:
            return []

        target_mode = (mode or "").lower().strip()
        scored = []
        for ex in dataset_manager.examples:
            ex_cat = ex.category.lower().strip()
            # STRICT CATEGORY ISOLATION: If a target mode is active, never retrieve exemplars from other categories
            if target_mode and target_mode in SUMMARIZATION_PROMPTS and ex_cat != target_mode:
                continue

            # Compare against leading 4,000 chars so 66,000-word documents don't dominate via vocabulary size
            ex_words = set(tokenize_words(ex.input_text[:4000]))
            if not ex_words:
                continue
            intersection = len(query_words & ex_words)
            union = len(query_words | ex_words)
            jaccard = intersection / max(union, 1)
            len_balance = min(len(query_words), len(ex_words)) / max(len(query_words), len(ex_words), 1)
            overlap_ratio = (intersection / max(min(len(query_words), len(ex_words)), 1)) * len_balance
            score = (jaccard * 0.6) + (overlap_ratio * 0.4)
            scored.append((score, ex))

        scored.sort(key=lambda x: x[0], reverse=True)
        results = []
        for score, ex in scored[:top_k]:
            results.append({
                "id": ex.id,
                "category": ex.category,
                "score": round(score, 4),
                "input_text": ex.input_text,
                "target_summary": ex.target_summary,
            })
        return results

    def auto_detect_category(self, text: str) -> str:
        """Automatically classifies input text into one of the 10 specialized cognitive categories using whole-word boundaries."""
        sample = (text or "")[:12000].lower()
        if not sample.strip():
            return "executive"

        # 1. Check associative similarity against trained Golden Exemplars first
        matches = self._retrieve_trained_exemplars(sample, mode="", top_k=1)
        if matches and matches[0]["score"] >= 0.25 and matches[0]["category"] in SUMMARIZATION_PROMPTS:
            return matches[0]["category"]

        # 2. Multi-domain lexical density scoring across all 10 categories (strict word-boundary matching for short tokens)
        domain_lexicons = {
            "legal_governance": [
                "constitution", "article ", "amendment", "statute", "supreme court", "parliament",
                "jurisdiction", "fundamental rights", "clause", "ordinance", "legislation",
                "statutory", "governance", "directive principles", "schedule", "writ",
            ],
            "scientific_academic": [
                "research paper", "dissertation", "thesis", "literature review", "conference",
                "journal", "ieee", "acm", "abstract", "methodology", "hypothesis", "et al",
                "arxiv", "empirical", "theorem", "experiment", "transduction", "neural network",
                "citation", "peer-reviewed", "preprint", "academic", "university", "manuscript",
            ],
            "finance_product": [
                "factsheet", "mutual fund", "index fund", "expense ratio", "gross margin",
                "free cash flow", "portfolio", "dividend", "sharpe ratio", "market cap",
                "valuation", "ebitda", "quarterly revenue", "fiscal year", "stock market",
            ],
            "architecture": [
                "monolithic", "microservices", "distributed system", "system topology", "sharding",
                "vector index", "hnsw", "ivfflat", "load balancer", "high availability", "consensus",
                "data flow", "message queue", "kafka", "event-driven", "scalability", "database schema",
            ],
            "technical": [
                "fastapi", "uvicorn", "python", "javascript", "typescript", "docker", "kubernetes",
                "sqlalchemy", "endpoint", "memory leak", "garbage collection", "compiler",
                "post-mortem", "outage", "oauth", "repository", "tutorial", "source code", "debugging",
            ],
            "narrative_history": [
                "emperor", "empire", "dynasty", "reign", "century", "kingdom", "ancient",
                "republic", "senate", "historical", "biography", "chronicle", "treaty", "civilization",
                "world war", "invasion", "monarch", "colonial", "revolution",
            ],
            "meetings_dialogue": [
                "standup", "transcript", "attendees", "moderator", "speaker", "agenda",
                "minutes of meeting", "blocker", "sprint", "q&a", "interview", "discussion",
            ],
            "actionable": [
                "action items", "checklist", "step 1", "step 2", "next steps", "how to",
                "playbook", "todo", "deliverables", "standard operating procedure", "guidelines",
            ],
            "chain_of_density": [
                "wikipedia", "encyclopedia", "metabolism", "digestion", "physiology",
                "international men's day", "comprehensive overview", "thermogenesis",
            ],
            "executive": [
                "executive", "strategic", "leadership", "board of directors", "roadmap",
                "stakeholder", "enterprise", "key takeaways",
            ],
        }

        best_cat = "executive"
        best_score = 0
        for cat, keywords in domain_lexicons.items():
            hits = sum(1 for kw in keywords if kw in sample)
            if hits > best_score:
                best_score = hits
                best_cat = cat

        return best_cat

    async def summarize(
        self,
        text: str,
        mode: str = "auto",
        max_words: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Performs high-density summarization with SIMULTANEOUS single-pass AI category determination
        when mode='auto', ensuring every bullet heading strictly belongs to the determined category.
        """
        text = sanitize_text(text)
        requested_mode = (mode or "auto").lower().strip()
        is_auto_mode = requested_mode == "auto" or requested_mode not in SUMMARIZATION_PROMPTS
        initial_mode = self.auto_detect_category(text) if is_auto_mode else requested_mode

        MANDATORY_CATEGORY_HEADINGS = {
            "scientific_academic": "1. Research Objective & Academic Scope | 2. Methodology & Structural Framework | 3. Empirical Findings & Quantitative Specifications | 4. Scholarly Conclusions & Guidelines",
            "technical": "1. Technical Overview & System Scope | 2. Core Mechanisms & Implementation Specs | 3. Operational Pipeline & Configuration | 4. Performance Metrics & Verification",
            "architecture": "1. System Topology & Architectural Pattern | 2. Component Boundaries & Data Flow | 3. Scalability & Trade-off Analysis | 4. Operational Resilience & Deployment",
            "legal_governance": "1. Statutory & Constitutional Scope | 2. Structural Provisions & Mandates | 3. Foundational Rights, Articles & Rules | 4. Governance, Compliance & Enforcement",
            "finance_product": "1. Financial & Market Overview | 2. Core Performance & Valuation Metrics | 3. Portfolio Strengths & Adoption Drivers | 4. Strategic Verdict & Fiscal Outlook",
            "narrative_history": "1. Historical Context & Origins | 2. Chronological Milestones & Key Events | 3. Governance, Reforms & Cultural Shifts | 4. Historical Impact & Enduring Legacy",
            "meetings_dialogue": "1. Meeting Context & Core Agenda | 2. Key Decisions & Consensus Reached | 3. Open Questions, Risks & Blockers | 4. Assigned Action Items & Deadlines",
            "actionable": "1. Primary Objective & Action Scope | 2. Step-by-Step Execution Directives | 3. Key Rules & Formatting Standards | 4. Immediate Deliverables & Checklist",
            "chain_of_density": "1. Core Entity & Foundational Definition | 2. High-Density Quantitative & Causal Facts | 3. Structural Taxonomy & Classifications | 4. Empirical Synthesis & Systemic Impact",
            "executive": "1. Executive Summary & Core Thesis | 2. Key Quantitative Highlights & Facts | 3. Foundational Pillars & Structure | 4. Strategic Takeaways & Recommendations",
        }

        # 1. Retrieve top matching trained exemplars
        trained_matches = self._retrieve_trained_exemplars(text, initial_mode, top_k=2)
        matched_sources = [m["id"] for m in trained_matches] or ["arch_seed_01"]

        # 2. If the user already trained the model on this exact/near-identical document (score >= 0.65),
        #    return the trained target_summary directly in < 5ms!
        if trained_matches and trained_matches[0]["score"] >= 0.65:
            matched_cat = trained_matches[0]["category"].lower()
            direct_summary = sanitize_text(trained_matches[0]["target_summary"])
            metrics = evaluate_summary(direct_summary, text)
            words_original = metrics["original_words"]
            words_summary = metrics["summary_words"]
            reading_time_saved = round(max((words_original - words_summary) / 200 * 60, 0))
            return {
                "mode": matched_cat,
                "summary": direct_summary,
                "metrics": {
                    "original_words": words_original,
                    "summary_words": words_summary,
                    "compression_ratio": metrics["compression_ratio"],
                    "efficiency_score": metrics["efficiency_score"],
                    "reading_time_saved_seconds": reading_time_saved,
                    "rouge1": metrics["rouge1"],
                    "rougeL": metrics["rougeL"],
                },
                "grounding_exemplars": matched_sources,
            }

        if len(text) > 60000:
            prompt_context = await self._condense_large_text(text, initial_mode)
            if len(prompt_context) > 90000:
                prompt_context = self._prepare_hierarchical_context(prompt_context, max_chars=90000)
        else:
            prompt_context = text

        if is_auto_mode:
            all_schemas = "\n".join(
                f"- {cat_id}: {headings}" for cat_id, headings in MANDATORY_CATEGORY_HEADINGS.items()
            )
            prompt = f"""You are the OmniLogic Simultaneous Classifier & High-Density Summarizer.

TASK:
Read the document below and SIMULTANEOUSLY:
1. Determine which ONE of the 10 domain categories below best represents the document's core content.
2. Summarize the document using ONLY the 4 mandatory section headings belonging to that determined category.

AVAILABLE CATEGORIES AND THEIR MANDATORY SECTION HEADINGS:
{all_schemas}

STRICT OUTPUT FORMAT:
- Line 1 MUST be exactly: CATEGORY: <chosen_category_id>
- Lines 2+ MUST be your 4 bullet points formatted as: • **<Mandatory Heading>**: <Detailed synthesis>
- NEVER mix headings across categories (e.g., if the document is scientific_academic, NEVER use financial or legal headings).
- Ignore webpage navigation noise, search result breadcrumb prefixes, or cookie banners.

DOCUMENT TO SUMMARIZE ({len(text):,} characters total):
{prompt_context}

{f"Target length: approximately {max_words} words." if max_words else "Provide a thorough, structured, publication-grade summary strictly tailored to the determined category."}
"""
        else:
            mode = requested_mode
            system_instruction = SUMMARIZATION_PROMPTS[mode]
            allowed_headings = MANDATORY_CATEGORY_HEADINGS.get(mode, MANDATORY_CATEGORY_HEADINGS["executive"])
            few_shot_block = ""
            for m in trained_matches:
                if m["category"].lower() != mode.lower():
                    continue
                snippet_in = m["input_text"][:500].strip()
                snippet_out = m["target_summary"][:700].strip()
                few_shot_block += (
                    f"\n--- TRAINED EXEMPLAR ({m['id']} | Category: {m['category']}) ---\n"
                    f"SOURCE EXCERPT:\n{snippet_in}\n"
                    f"TARGET SUMMARY FORMAT:\n{snippet_out}\n"
                )
            prompt = f"""{system_instruction}

MANDATORY CATEGORY ISOLATION RULE (ACTIVE CATEGORY: {mode.upper()}):
You MUST structure every bullet point in your summary strictly around the [{mode.upper()}] category using ONLY these exact section headings:
{allowed_headings}
NEVER use headings or terminology from other categories.

{f"REFERENCE STYLE FROM SAME-CATEGORY EXEMPLARS:{few_shot_block}" if few_shot_block else ""}

CRITICAL RULES:
1. Ignore any webpage navigation noise, search result breadcrumb prefixes, search bar headers, or feedback prompts.
2. Summarize the document comprehensively using ONLY the [{mode.upper()}] headings listed above (• **Heading**: Details).

DOCUMENT TO SUMMARIZE ({len(text):,} characters total):
{prompt_context}

{f"Target length: approximately {max_words} words." if max_words else "Provide a thorough, structured, publication-grade summary strictly tailored to this category."}
"""

        # 4. Call Live Gemini REST API
        summary_text = await self._generate(prompt)
        final_mode = initial_mode

        if summary_text:
            # Extract simultaneous CATEGORY: <id> header if returned by the AI
            lines = summary_text.strip().splitlines()
            cleaned_lines = []
            for idx, l in enumerate(lines):
                cat_match = re.match(r"^\s*(?:\*\*)?CATEGORY(?:\*\*)?:\s*([a-z_]+)\s*$", l.strip(), flags=re.I)
                if idx == 0 and cat_match:
                    candidate_cat = cat_match.group(1).lower().strip()
                    if candidate_cat in SUMMARIZATION_PROMPTS:
                        final_mode = candidate_cat
                    continue
                cleaned_lines.append(l)
            summary_text = "\n".join(cleaned_lines).strip()
            if is_auto_mode and final_mode == initial_mode:
                # Also verify against the generated summary text
                final_mode = self.auto_detect_category(summary_text + "\n" + text[:4000])
        else:
            # Deterministic Local High-Efficiency Summary Fallback
            final_mode = initial_mode
            summary_text = self._fallback_summary(text, final_mode)

        mode = final_mode
        summary_text = sanitize_text(summary_text)

        # 5. Compute Compression & Efficiency Metrics
        metrics = evaluate_summary(summary_text, text)
        words_original = metrics["original_words"]
        words_summary = metrics["summary_words"]
        reading_time_saved = round(max((words_original - words_summary) / 200 * 60, 0))

        return {
            "mode": mode,
            "summary": summary_text,
            "metrics": {
                "original_words": words_original,
                "summary_words": words_summary,
                "compression_ratio": metrics["compression_ratio"],
                "efficiency_score": metrics["efficiency_score"],
                "reading_time_saved_seconds": reading_time_saved,
                "rouge1": metrics["rouge1"],
                "rougeL": metrics["rougeL"],
            },
            "grounding_exemplars": matched_sources,
        }

    async def _condense_large_text(self, text: str, mode: str) -> str:
        """Map-reduce for documents of ANY size: condenses every chunk (start to end) into key facts, concurrently."""
        target_chunks = 12
        chunk_size = min(max(24000, len(text) // target_chunks + 1), 200000)
        chunks = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]
        sem = asyncio.Semaphore(8)

        def _extractive(chunk: str) -> str:
            sents = [s.strip() for s in re.split(r"(?<=[.!?])\s+", chunk) if 40 <= len(s.strip()) <= 320]
            if not sents:
                return chunk[:600]
            step = max(len(sents) // 6, 1)
            return " ".join(sents[::step][:6])

        async def _one(idx: int, chunk: str) -> str:
            async with sem:
                p = (
                    f"Extract the key facts, names, numbers, definitions, and section/chapter/article topics from "
                    f"part {idx + 1} of {len(chunks)} of a large document. Return dense bullet points (max 180 words). "
                    f"Ignore navigation noise.\n\n{chunk}"
                )
                out = await self._generate(p, max_tokens=500, timeout=12)
                return f"[Part {idx + 1}/{len(chunks)}] " + (out or _extractive(chunk))

        tasks = [asyncio.ensure_future(_one(i, c)) for i, c in enumerate(chunks)]
        done, pending = await asyncio.wait(tasks, timeout=25)
        for t in pending:
            t.cancel()
        parts = [
            t.result() if t in done and not t.exception() else f"[Part {i + 1}/{len(chunks)}] " + _extractive(chunks[i])
            for i, t in enumerate(tasks)
        ]
        return "\n\n".join(parts)

    async def _generate(self, prompt: str, max_tokens: int = 1200, timeout: int = 15) -> Optional[str]:
        """Calls Gemini v1beta REST endpoint directly across active models."""
        if not (settings.GOOGLE_API_KEY and settings.GOOGLE_API_KEY.strip()):
            return None

        api_key = settings.GOOGLE_API_KEY.strip()
        candidate_models = [
            "models/gemini-3.5-flash-lite",
            "models/gemini-3.1-flash-lite",
            "models/gemini-flash-lite-latest",
        ]

        def _call_rest(model_path: str) -> Optional[str]:
            url = f"https://generativelanguage.googleapis.com/v1beta/{model_path}:generateContent?key={api_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": max_tokens,
                },
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            ctx = ssl._create_unverified_context()
            with urllib.request.urlopen(req, context=ctx, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts and "text" in parts[0]:
                        return parts[0]["text"].strip()
            return None

        for m in candidate_models:
            try:
                res_text = await asyncio.wait_for(
                    asyncio.to_thread(_call_rest, m),
                    timeout=float(timeout) + 2.0,
                )
                if res_text and len(res_text) > 40:
                    return res_text
            except urllib.error.HTTPError as he:
                logger.info(f"Gemini REST {m} HTTP {he.code}")
                continue
            except Exception as e:
                logger.info(f"Gemini REST {m} error: {e}")
                err_msg = str(e).lower()
                if "getaddrinfo" in err_msg or "name or service not known" in err_msg:
                    break

        return None

    def _fallback_summary(self, text: str, mode: str) -> str:
        """
        Generates a strictly category-isolated, multi-section synthesis when offline.
        Every bullet heading belongs 100% to the requested `mode` — zero cross-category leakage.
        """
        clean_lines = [line.strip() for line in text.splitlines() if line.strip()]
        cleaned_text = " ".join(clean_lines)

        # Extract any explicit "Article X: ..." items ONLY when mode is legal_governance
        article_items = re.findall(
            r"(Article\s+\d+[A-Z]?(?:\s*(?:&|,|and)\s*\d+[A-Z]?)*:\s*[^.!?]+[.!?])",
            cleaned_text,
        )

        sentences = [
            s.strip()
            for s in re.split(r"(?<=[.!?])\s+", cleaned_text)
            if 25 <= len(s.strip()) <= 400
        ]

        if not sentences:
            sentences = [cleaned_text[:350]] if cleaned_text else ["Document analyzed."]

        # Special multi-article breakdown strictly for legal_governance mode
        if mode == "legal_governance" and len(article_items) >= 3:
            out = []
            scope_sents = [
                s for s in sentences
                if any(w in s.lower() for w in ["originally contained", "constitution", "articles", "parts", "schedules", "established", "took effect"])
            ]
            if scope_sents:
                out.append("• **Constitutional & Statutory Scope**: " + " ".join(s.rstrip(".!?") + "." for s in scope_sents[:2]))
            top_articles = [a.strip().rstrip(".!?") + "." for a in article_items[:8]]
            out.append("• **Foundational Articles & Legal Provisions**:\n  - " + "\n  - ".join(top_articles))
            return "\n".join(out)

        # STRICTLY ISOLATED CATEGORY PROFILES (100% bound to `mode`, never hijacked by other categories)
        STRICT_CATEGORY_PROFILES = {
            "scientific_academic": [
                ("Research Objective & Academic Scope", ["research", "objective", "hypothesis", "propose", "study", "paper", "dissertation", "investigate", "abstract", "journal", "conference"]),
                ("Methodology & Structural Framework", ["methodology", "format", "structure", "layout", "section", "method", "model", "framework", "algorithm", "experiment", "literature"]),
                ("Empirical Findings & Quantitative Specs", ["pages", "words", "results", "metrics", "accuracy", "margin", "font", "spacing", "table", "figure", "data", "analysis"]),
                ("Scholarly Conclusions & Guidelines", ["conclusion", "reference", "citation", "ieee", "acm", "implication", "guideline", "submission", "demonstrate"]),
            ],
            "technical": [
                ("Technical Overview & System Scope", ["system", "framework", "api", "service", "application", "module", "platform", "tutorial", "documentation", "overview"]),
                ("Core Mechanisms & Implementation", ["function", "code", "implementation", "engine", "runtime", "async", "database", "protocol", "token", "compiler", "bug", "leak"]),
                ("Configuration & Operational Pipeline", ["config", "deploy", "docker", "container", "server", "port", "endpoint", "route", "pipeline", "command", "install"]),
                ("Performance Metrics & Verification", ["performance", "latency", "memory", "test", "verify", "benchmark", "throughput", "error", "fix", "resolution"]),
            ],
            "architecture": [
                ("System Topology & Architectural Pattern", ["architecture", "monolith", "microservice", "topology", "distributed", "layer", "tier", "pattern", "design"]),
                ("Component Boundaries & Data Flow", ["component", "service", "flow", "interface", "gateway", "queue", "shard", "index", "vector", "storage"]),
                ("Scalability & Trade-off Analysis", ["scalability", "trade-off", "latency", "overhead", "memory", "recall", "throughput", "coupling", "complexity"]),
                ("Operational Resilience & Deployment", ["resilience", "availability", "fault", "cluster", "node", "orchestration", "deployment", "hybrid"]),
            ],
            "legal_governance": [
                ("Statutory & Constitutional Scope", ["constitution", "statute", "act", "law", "policy", "enacted", "framework", "governance", "jurisdiction"]),
                ("Structural Provisions & Mandates", ["part", "schedule", "clause", "section", "provision", "mandate", "authority", "regulation", "rule"]),
                ("Foundational Rights & Obligations", ["right", "duty", "obligation", "protection", "liberty", "equality", "freedom", "compliance", "citizen"]),
                ("Enforcement & Amendment Mechanisms", ["amendment", "court", "parliament", "judicial", "enforcement", "emergency", "penalty", "review"]),
            ],
            "finance_product": [
                ("Financial & Market Overview", ["fund", "etf", "index", "revenue", "market", "financial", "fiscal", "quarter", "asset", "investment"]),
                ("Core Performance & Valuation Metrics", ["return", "nav", "aum", "margin", "profit", "yield", "ratio", "price", "cost", "growth", "cash flow"]),
                ("Portfolio Composition & Strengths", ["portfolio", "equity", "allocation", "holding", "retention", "adoption", "feature", "advantage"]),
                ("Strategic Verdict & Fiscal Outlook", ["outlook", "forecast", "guidance", "benchmark", "risk", "verdict", "recommendation"]),
            ],
            "narrative_history": [
                ("Historical Context & Origins", ["born", "founded", "origin", "early", "dynasty", "ancient", "century", "era", "kingdom", "established"]),
                ("Chronological Milestones & Events", ["reign", "war", "campaign", "conquest", "battle", "treaty", "expansion", "republic", "empire"]),
                ("Governance, Reforms & Cultural Shifts", ["reform", "administration", "policy", "culture", "religion", "institution", "senate", "society", "economy"]),
                ("Historical Impact & Enduring Legacy", ["legacy", "death", "succeeded", "influence", "history", "endured", "transformation", "impact"]),
            ],
            "meetings_dialogue": [
                ("Meeting Context & Core Agenda", ["agenda", "meeting", "standup", "discuss", "sync", "topic", "participant", "overview"]),
                ("Key Decisions & Consensus Reached", ["decided", "agreed", "confirmed", "approved", "consensus", "resolved", "alignment"]),
                ("Open Questions, Risks & Blockers", ["blocker", "issue", "question", "pending", "risk", "concern", "challenge", "dependency"]),
                ("Assigned Action Items & Next Steps", ["action", "next step", "owner", "deadline", "follow up", "deliver", "schedule"]),
            ],
            "actionable": [
                ("Primary Objective & Action Scope", ["goal", "objective", "purpose", "overview", "requirement", "scope", "target"]),
                ("Step-by-Step Execution Directives", ["step", "first", "next", "create", "run", "execute", "implement", "configure", "process"]),
                ("Key Rules & Operational Standards", ["must", "ensure", "rule", "standard", "guideline", "require", "policy", "avoid"]),
                ("Immediate Deliverables & Checklist", ["deliverable", "complete", "verify", "check", "final", "submit", "outcome"]),
            ],
            "chain_of_density": [
                ("Core Subject & Foundational Definition", ["is a", "defined", "refers to", "consists", "overview", "primary", "fundamental"]),
                ("High-Density Quantitative & Causal Facts", ["percent", "number", "rate", "energy", "process", "mechanism", "factor", "total"]),
                ("Structural Taxonomy & Classifications", ["type", "category", "form", "stage", "phase", "component", "system", "group"]),
                ("Empirical Synthesis & Systemic Impact", ["impact", "effect", "result", "function", "role", "significance", "global"]),
            ],
            "executive": [
                ("Executive Summary & Core Thesis", ["overview", "summary", "core", "primary", "main", "objective", "purpose", "focus"]),
                ("Key Quantitative Highlights & Facts", ["number", "metric", "total", "rate", "percent", "scale", "key", "data"]),
                ("Foundational Pillars & Structure", ["structure", "component", "part", "system", "framework", "process", "organization"]),
                ("Strategic Takeaways & Recommendations", ["takeaway", "conclusion", "impact", "outcome", "future", "strategy", "recommendation"]),
            ],
        }

        thematic_profiles = STRICT_CATEGORY_PROFILES.get(mode, STRICT_CATEGORY_PROFILES["executive"])

        out = []
        used = set()
        for title, kws in thematic_profiles:
            best_sent = None
            best_score = 0
            best_idx = -1
            for idx, s in enumerate(sentences):
                if idx in used:
                    continue
                score = sum(1 for kw in kws if kw.lower() in s.lower())
                if score > best_score:
                    best_score = score
                    best_sent = s
                    best_idx = idx
            if best_sent and best_score > 0:
                used.add(best_idx)
                out.append(f"• **{title}**: " + best_sent.rstrip(".!?") + ".")

        # If any section in this category still needs a point, fill from remaining top sentences
        # using strictly THIS category's own section titles (never leaking other categories!)
        if len(out) < len(thematic_profiles):
            used_titles = {b.split("**")[1] for b in out if "**" in b}
            remaining_sents = [s for idx, s in enumerate(sentences) if idx not in used]
            r_idx = 0
            for title, _ in thematic_profiles:
                if title not in used_titles and r_idx < len(remaining_sents):
                    out.append(f"• **{title}**: " + remaining_sents[r_idx].rstrip(".!?") + ".")
                    r_idx += 1
                if len(out) >= 4:
                    break

        if mode == "chain_of_density":
            return "\n".join(out)

        return "\n".join(out)


summarizer = EfficientSummarizer()
