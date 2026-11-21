import json
import os
import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class TrainingExample(BaseModel):
    id: str
    category: str
    input_text: str
    target_summary: str
    key_entities: List[str] = Field(default_factory=list)
    compression_ratio: float = 0.0

GOLDEN_SUMMARIZATION_DATASET: List[Dict[str, Any]] = [
    {
        "id": "train_tech_01",
        "category": "technical",
        "input_text": (
            "During high-throughput spatial warping operations in the Antigravity v4 engine, "
            "the system exhibited severe memory spikes peaking at 14.8 GB, ultimately triggering Out-Of-Memory (OOM) "
            "panics across worker nodes. Root-cause profiling in the manifold folding loop revealed that temporary "
            "scratch buffers allocated per frame were bypassing the garbage collector due to cyclic references "
            "in the closure environment. Reference counters never reached zero, preventing deallocation. "
            "The engineering team patched this by introducing an explicit drop(temp_warp) barrier and scoped "
            "allocation guards (AllocationFrame::strict_isolation). Post-patch profiling showed memory stabilization "
            "at 1.2 GB, zero OOM events across 500,000 cycles, and a 28% reduction in frame latency."
        ),
        "target_summary": (
            "• **Root Cause**: Cyclic closure references in the manifold folding loop bypassed garbage collection, leaking scratch buffers up to 14.8 GB.\n"
            "• **Resolution**: Enforced scoped allocation guards (`AllocationFrame::strict_isolation`) and an explicit `drop(temp_warp)` barrier.\n"
            "• **Impact**: Memory usage stabilized at 1.2 GB with 0 OOM crashes across 500k cycles and 28% lower frame latency."
        ),
        "key_entities": ["Antigravity v4", "manifold folding loop", "cyclic references", "drop(temp_warp)", "AllocationFrame", "1.2 GB"],
    },
    {
        "id": "train_exec_02",
        "category": "executive",
        "input_text": (
            "Q3 2026 performance results for the enterprise AI infrastructure segment indicate total revenue reached "
            "$84.2M, representing a 42% year-over-year increase driven by demand for autonomous agent orchestration. "
            "Gross margins expanded by 340 basis points to 71.2% as inference hardware costs were optimized through "
            "dynamic model routing and batching. Net customer retention stood at 134%, with 120 new enterprise logos acquired. "
            "However, operating expenses rose 18% due to investments in GPU clusters and international data sovereignty compliance. "
            "Cash reserves ended at $145M with positive free cash flow of $18.4M. For Q4, leadership forecasts revenue between "
            "$92M and $96M, prioritizing the commercial launch of multi-agent cognitive solvers."
        ),
        "target_summary": (
            "• **Financial Highlights**: Q3 revenue grew 42% YoY to $84.2M with gross margins expanding to 71.2% (+$18.4M FCF, $145M cash reserves).\n"
            "• **Growth Drivers**: 134% net retention and 120 enterprise client additions, supported by GPU inference optimizations.\n"
            "• **Outlook**: Q4 revenue guidance projected at $92M–$96M, centered on cognitive agent monetization."
        ),
        "key_entities": ["$84.2M", "42% YoY", "71.2% margins", "134% retention", "$145M cash", "Q4 guidance $92M-$96M"],
    },
    {
        "id": "train_arch_03",
        "category": "architecture",
        "input_text": (
            "Distributed vector indexing architectures face a fundamental trilemma between query latency, index build time, "
            "and recall accuracy. In HNSW (Hierarchical Navigable Small World) graphs, increasing M (number of bidirectional links) "
            "and efConstruction dramatically improves recall on high-dimensional vectors (e.g. 1536-dim or 768-dim embeddings) "
            "from 88% to 98.4%, but increases RAM overhead by 4.2x and quadruples index construction latency. Conversely, "
            "Inverted File Flat (IVFFlat) indexes with scalar quantization (SQ8) decrease memory footprint by 75% at the expense "
            "of a 4% recall penalty on tail queries. For real-time multi-agent memory, the optimal hybrid pattern utilizes "
            "an in-memory write buffer with quantization for sub-5ms writes, backed by background asynchronous graph compaction."
        ),
        "target_summary": (
            "• **Trade-off Analysis**: HNSW delivers high recall (98.4%) but incurs 4.2x memory overhead; IVFFlat-SQ8 cuts RAM by 75% with a 4% tail recall penalty.\n"
            "• **Architectural Recommendation**: Adopt a tiered hybrid strategy—low-latency quantized in-memory write buffers paired with asynchronous background HNSW compaction."
        ),
        "key_entities": ["HNSW", "IVFFlat-SQ8", "scalar quantization", "98.4% recall", "hybrid write buffer", "asynchronous compaction"],
    },
    {
        "id": "train_dense_04",
        "category": "chain_of_density",
        "input_text": (
            "The Post-Mortem of Incident INC-9402 on October 14 details a catastrophic 47-minute outage affecting the "
            "global payment routing service. At 14:02 UTC, a configuration push to the Envoy service mesh mistakenly "
            "lowered the upstream circuit-breaker threshold from 500 concurrent connections to 50, triggering immediate "
            "cascading 503 Service Unavailable errors across 12 regional clusters. The automated rollback pipeline failed "
            "because the deployment lock had not been released by the initial Canary orchestrator. Manual intervention "
            "by the site reliability team restored normal traffic routing by 14:49 UTC. Five customer accounts experienced "
            "duplicate charges due to untracked idempotent retry loops, which were subsequently refunded within 4 hours. "
            "Action items include decoupling deployment locks from rollback hooks, adding automated Canary sanity checks, "
            "and implementing strict idempotency keys on payment retry endpoints."
        ),
        "target_summary": (
            "• **Incident INC-9402 Summary**: 47-min global payment outage caused by an Envoy mesh threshold misconfiguration (reduced to 50 connections) and a stuck canary rollback lock.\n"
            "• **Impact & Remedy**: 12 clusters returned 503 errors; 5 duplicate charges were auto-refunded within 4 hours.\n"
            "• **Mitigations**: Decouple rollback locks, enforce automated canary threshold validation, and mandate strict payment idempotency keys."
        ),
        "key_entities": ["INC-9402", "Envoy mesh", "circuit-breaker threshold 50", "canary lock", "12 regional clusters", "idempotency keys"],
    },
]

def tokenize_words(text: str) -> List[str]:
    """Simple regex word tokenizer for metric calculations."""
    return re.findall(r"\b\w+\b", text.lower())

def compute_ngram_counts(words: List[str], n: int) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for i in range(len(words) - n + 1):
        ngram = " ".join(words[i : i + n])
        counts[ngram] = counts.get(ngram, 0) + 1
    return counts

def compute_rouge_n(hypothesis: str, reference: str, n: int = 1) -> float:
    """Computes ROUGE-N F1 score."""
    hyp_words = tokenize_words(hypothesis)
    ref_words = tokenize_words(reference)
    if not hyp_words or not ref_words:
        return 0.0

    hyp_ngrams = compute_ngram_counts(hyp_words, n)
    ref_ngrams = compute_ngram_counts(ref_words, n)

    overlap = 0
    for ngram, count in hyp_ngrams.items():
        if ngram in ref_ngrams:
            overlap += min(count, ref_ngrams[ngram])

    total_ref = sum(ref_ngrams.values())
    total_hyp = sum(hyp_ngrams.values())

    if total_ref == 0 or total_hyp == 0:
        return 0.0

    precision = overlap / total_hyp
    recall = overlap / total_ref
    if precision + recall == 0:
        return 0.0
    f1 = 2 * (precision * recall) / (precision + recall)
    return round(f1, 4)

def compute_lcs(x: List[str], y: List[str]) -> int:
    """Computes length of Longest Common Subsequence with bounded window for instant speed."""
    x = x[:300]
    y = y[:300]
    m, n = len(x), len(y)
    dp = [0] * (n + 1)
    for i in range(m):
        prev = 0
        xi = x[i]
        for j in range(n):
            temp = dp[j + 1]
            if xi == y[j]:
                dp[j + 1] = prev + 1
            elif dp[j] > dp[j + 1]:
                dp[j + 1] = dp[j]
            prev = temp
    return dp[n]

def compute_rouge_l(hypothesis: str, reference: str) -> float:
    """Computes ROUGE-L (Longest Common Subsequence) F1 score."""
    hyp_words = tokenize_words(hypothesis)
    ref_words = tokenize_words(reference)
    if not hyp_words or not ref_words:
        return 0.0
    lcs_len = compute_lcs(hyp_words, ref_words)
    precision = lcs_len / len(hyp_words)
    recall = lcs_len / len(ref_words)
    if precision + recall == 0:
        return 0.0
    return round(2 * (precision * recall) / (precision + recall), 4)

def evaluate_summary(hypothesis: str, reference: str) -> Dict[str, Any]:
    """Evaluates summary against reference and returns comprehensive metrics."""
    orig_words = len(tokenize_words(reference))
    sum_words = len(tokenize_words(hypothesis))
    ratio = round(sum_words / max(orig_words, 1), 3)

    r1 = compute_rouge_n(hypothesis, reference, 1)
    r2 = compute_rouge_n(hypothesis, reference, 2)
    rl = compute_rouge_l(hypothesis, reference)

    return {
        "rouge1": r1,
        "rouge2": r2,
        "rougeL": rl,
        "original_words": orig_words,
        "summary_words": sum_words,
        "compression_ratio": ratio,
        "efficiency_score": round((r1 * 0.4 + r2 * 0.3 + rl * 0.3) * (1.0 - min(ratio, 0.5)), 4),
    }

class DatasetManager:
    def __init__(self, data_path: Optional[str] = None):
        self.data_path = data_path or os.path.join(os.path.dirname(__file__), "training_dataset.jsonl")
        self.examples: List[TrainingExample] = []
        self._load_or_initialize()

    def _load_or_initialize(self):
        if os.path.exists(self.data_path):
            try:
                with open(self.data_path, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip():
                            data = json.loads(line)
                            self.examples.append(TrainingExample(**data))
            except Exception as e:
                print(f"Warning: Failed to load dataset file: {e}")

        if not self.examples:
            # Seed with golden dataset
            for item in GOLDEN_SUMMARIZATION_DATASET:
                ex = TrainingExample(
                    id=item["id"],
                    category=item["category"],
                    input_text=item["input_text"],
                    target_summary=item["target_summary"],
                    key_entities=item["key_entities"],
                    compression_ratio=round(len(item["target_summary"]) / len(item["input_text"]), 3),
                )
                self.examples.append(ex)
            self.save_dataset()

    def save_dataset(self):
        os.makedirs(os.path.dirname(self.data_path), exist_ok=True)
        with open(self.data_path, "w", encoding="utf-8") as f:
            for ex in self.examples:
                f.write(ex.model_dump_json() + "\n")

    def add_example(self, category: str, input_text: str, target_summary: str, key_entities: Optional[List[str]] = None) -> TrainingExample:
        ex_id = f"train_{Date_id() if 'Date_id' in globals() else os.urandom(4).hex()}"
        ex = TrainingExample(
            id=ex_id,
            category=category,
            input_text=input_text,
            target_summary=target_summary,
            key_entities=key_entities or [],
            compression_ratio=round(len(target_summary) / max(len(input_text), 1), 3),
        )
        self.examples.append(ex)
        self.save_dataset()
        return ex

    def delete_example(self, example_id: str) -> bool:
        """Deletes an exemplar by its ID from memory and disk."""
        initial_len = len(self.examples)
        self.examples = [ex for ex in self.examples if ex.id != example_id]
        if len(self.examples) < initial_len:
            self.save_dataset()
            return True
        return False

    def update_example_category(self, example_id: str, new_category: str) -> Optional[TrainingExample]:
        """Updates the category of an exemplar (e.g. from technical to scientific_academic)."""
        for ex in self.examples:
            if ex.id == example_id:
                ex.category = new_category
                self.save_dataset()
                return ex
        return None

    def export_gemini_format(self) -> List[Dict[str, Any]]:
        """Exports examples into Google Gemini fine-tuning JSON format."""
        formatted = []
        for ex in self.examples:
            formatted.append({
                "text_input": (
                    f"You are the OmniLogic Ultra-Efficient Summarizer. "
                    f"Extract the vital information from this {ex.category} text with high density and zero fluff:\n\n"
                    f"{ex.input_text}"
                ),
                "output": ex.target_summary,
            })
        return formatted

dataset_manager = DatasetManager()
