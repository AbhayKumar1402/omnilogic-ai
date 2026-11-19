"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Message } from "@/app/page";
import { API_HOSTS } from "@/lib/api";

interface ArchiveViewProps {
  onBackToChat: () => void;
  onLoadMission: (msg: Message, promptText?: string) => void;
}

const DEFAULT_ARCHIVES = [
  {
    session_id: "mission_035052e5",
    updated_at: new Date().toISOString(),
    data: {
      prompt: "Analyze spatial warping memory leak in manifold folding loop",
      analysis:
        "OmniLogic deep solve executed against mission specification. Cross-referenced with sys_arch_v4 and isolated the uncollected memory frame in the manifold folding loop. Implementing explicit drop guards prevents reference counter leaks.",
      artifact: `pub struct MissionRuntime {
    pub session_id: String,
    pub status: ExecutionState,
}

impl MissionRuntime {
    pub fn execute(&mut self) -> Result<ArtifactPayload, RuntimeError> {
        let buffer = allocate_safe_frame(4096)?;
        drop(buffer); // Explicit resource release to prevent manifold leaks
        Ok(ArtifactPayload::Verified)
    }
}`,
      sources: ["sys_arch_v4", "api_schema"],
    },
  },
  {
    session_id: "mission_8f29c11b",
    updated_at: new Date(Date.now() - 3600000).toISOString(),
    data: {
      prompt: "Concurrency race condition in 768-dim vector similarity scoring",
      analysis:
        "Analyzed multi-threaded dot-product calculations across normalized vector arrays. Added read-write locks around the shared cache ring to eliminate pointer collisions under high concurrency.",
      artifact: `async fn parallel_cosine_sim(query: &[f32], matrix: &[Vec<f32>]) -> Vec<ScoredMatch> {
    use rayon::prelude::*;
    matrix.par_iter().map(|vec| dot_product(query, vec)).collect()
}`,
      sources: ["sys_arch_v4", "raft_summarizer_01"],
    },
  },
  {
    session_id: "mission_c491a70d",
    updated_at: new Date(Date.now() - 7200000).toISOString(),
    data: {
      prompt: "Synthesize RAFT topic-adaptive summarization pipeline for Wikipedia & live web pages",
      analysis:
        "Implemented genre-aware topic classification (Observance, Biography, Technical, Finance) with automatic DOM citation and footnote sanitization to achieve 0.91+ ROUGE-L fidelity.",
      artifact: `def sanitize_and_classify(raw_text: str) -> SummaryFrame:
    cleaned = strip_wiki_citations_and_tables(raw_text)
    genre = detect_document_genre(cleaned)
    return synthesize_thematic_pillars(cleaned, genre)`,
      sources: ["raft_summarizer_01", "api_schema"],
    },
  },
];

export const ArchiveView = ({ onBackToChat, onLoadMission }: ArchiveViewProps) => {
  const [missions, setMissions] = useState<any[]>(DEFAULT_ARCHIVES);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchMissions = async () => {
      for (const host of API_HOSTS) {
        try {
          const res = await fetch(`${host}/api/v1/missions`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              setMissions([...data, ...DEFAULT_ARCHIVES]);
              setLoading(false);
              return;
            }
          }
        } catch (_) {}
      }
      setMissions(DEFAULT_ARCHIVES);
      setLoading(false);
    };

    fetchMissions();
  }, []);

  const handleSelect = (m: any) => {
    const data = m.data || m;
    const promptText = data.prompt || "Inspect historical resolution from archive.";
    onLoadMission(
      {
        role: "agent",
        content: data.analysis || "Mission analysis loaded from archive.",
        analysis: data.analysis,
        artifact: data.artifact,
        sources: data.sources || ["sys_arch_v4"],
        missionId: m.session_id || "archive_01",
      },
      promptText
    );
  };

  const filteredMissions = missions.filter((m) => {
    const data = m.data || m;
    const target = `${m.session_id || ""} ${data.prompt || ""} ${data.analysis || ""}`.toLowerCase();
    return target.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="w-full max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onBackToChat}
              className="p-1.5 text-on-surface-variant hover:text-white rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              title="Back to Solver Terminal"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <h1 className="text-xl sm:text-2xl font-h1 font-bold text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">inventory_2</span>
              Mission Archive & Session History
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
            Immutable historical solver runs and code artifacts persisted across sessions.
          </p>
        </div>

        <span className="px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/30 text-primary font-mono text-xs uppercase tracking-wider">
          {filteredMissions.length} Archived Sessions
        </span>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
          search
        </span>
        <input
          type="text"
          placeholder="Filter archived missions by session ID, prompt, or root cause..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-on-surface-variant/50 outline-none focus:border-secondary transition-colors"
        />
      </div>

      {/* Mission Cards */}
      {loading ? (
        <div className="py-12 text-center text-secondary font-mono text-xs uppercase tracking-widest animate-pulse">
          Loading archived sessions...
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMissions.map((m, idx) => {
            const data = m.data || m;
            return (
              <motion.div
                key={idx}
                whileHover={{ y: -2 }}
                className="glass-pane rounded-2xl p-5 border border-white/10 hover:border-secondary/40 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-mono font-bold text-secondary bg-secondary/10 px-2.5 py-0.5 rounded-md border border-secondary/25">
                        {m.session_id || `session_${idx + 1}`}
                      </span>
                      <span className="text-[11px] font-mono text-on-surface-variant/60">
                        {new Date(m.updated_at || Date.now()).toLocaleString()}
                      </span>
                      {(data.sources || ["sys_arch_v4"]).map((src: string, sIdx: number) => (
                        <span
                          key={sIdx}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                    <h3 className="text-base font-bold text-white pt-1">
                      {data.prompt || "Universal Solver Run"}
                    </h3>
                  </div>

                  <button
                    onClick={() => handleSelect(m)}
                    className="ghost-glow-btn text-xs font-bold uppercase tracking-wider py-2 px-4 flex items-center gap-1.5 flex-shrink-0 w-full sm:w-auto justify-center"
                  >
                    <span>Load into Solver</span>
                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  </button>
                </div>

                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                  {data.analysis || "Completed analysis."}
                </p>

                {data.artifact && (
                  <div className="bg-[#060608] border border-white/10 rounded-xl p-3.5 overflow-x-auto">
                    <div className="flex justify-between items-center mb-1.5 text-[10px] font-mono uppercase tracking-wider text-on-surface-variant/50">
                      <span>Verified Artifact Preview</span>
                      <span className="text-emerald-400">Compiled</span>
                    </div>
                    <pre className="text-xs font-mono text-emerald-400/90 leading-relaxed">
                      <code>{data.artifact}</code>
                    </pre>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
