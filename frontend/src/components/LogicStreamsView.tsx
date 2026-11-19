"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";

interface LogicStreamsViewProps {
  onBackToChat: () => void;
}

export const LogicStreamsView = ({ onBackToChat }: LogicStreamsViewProps) => {
  const [selectedNode, setSelectedNode] = useState<string>("research");
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);

  const nodes = [
    {
      id: "input",
      label: "Mission Trigger",
      type: "EntryPoint",
      latency: "1.4 ms",
      desc: "Clears transient state; initializes LangGraph state machine with sanitized prompt and execution frame.",
      details: {
        protocol: "Fresh Input v4.2",
        transientState: "Purged on Entry",
        historyStatus: "Immutable Session Key",
      },
      logs: [
        "[00:00.001] Purging transient memory registers...",
        "[00:00.002] Assigned mission UUID & initialized StateGraph.",
      ],
      icon: "play_arrow",
      status: "Verified",
    },
    {
      id: "research",
      label: "Researcher Agent",
      type: "Graph Node",
      latency: "18.2 ms",
      desc: "Queries Pinecone & local vector shards, computes 768-dim cosine similarity, and retrieves top golden exemplars.",
      details: {
        agent: "Lead Technical Researcher",
        retrievalMethod: "Cosine Similarity (Top-K)",
        models: "text-embedding-004 + RAFT Shards",
      },
      logs: [
        "[00:00.008] Generating 768-dim query embedding...",
        "[00:00.019] Retrieved top anchors (cosine score: 0.962).",
      ],
      icon: "travel_explore",
      status: "Active",
    },
    {
      id: "solve",
      label: "Solver Agent",
      type: "Graph Node",
      latency: "142.0 ms",
      desc: "Synthesizes architectural solution or topic-adaptive summary, validates ROUGE density, and formats code artifacts.",
      details: {
        agent: "Lead Universal Solver",
        outputFormat: "ANALYSIS + ARTIFACT + METRICS",
        codeStandard: "Obsidian v4 / Zero-Leak Guards",
      },
      logs: [
        "[00:00.045] Grounding prompt with retrieved vector exemplars...",
        "[00:00.160] Synthesized verified resolution & code artifact.",
      ],
      icon: "integration_instructions",
      status: "Active",
    },
    {
      id: "persist",
      label: "Persistence Store",
      type: "State Sync",
      latency: "6.8 ms",
      desc: "Asynchronously commits mission results and training checkpoints to Supabase and local JSONL storage.",
      details: {
        relationalStore: "Supabase PostgreSQL",
        vectorStore: "Pinecone (omnilogic-memory)",
        cacheFallback: "In-Memory + JSONL Disk Sync",
      },
      logs: [
        "[00:00.164] Committing session payload to persistence store...",
        "[00:00.168] StateGraph transition -> END (200 OK).",
      ],
      icon: "cloud_sync",
      status: "Verified",
    },
  ];

  const handleSimulatePipeline = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    nodes.forEach((n, idx) => {
      setTimeout(() => {
        setActiveStepIndex(idx);
        setSelectedNode(n.id);
        if (idx === nodes.length - 1) {
          setTimeout(() => {
            setIsSimulating(false);
            setActiveStepIndex(null);
          }, 900);
        }
      }, idx * 700);
    });
  };

  const activeNodeInfo = nodes.find((n) => n.id === selectedNode) || nodes[1];

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
              <span className="material-symbols-outlined text-secondary">account_tree</span>
              Logic Streams & LangGraph Topology
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
            Interactive state-graph pipeline connecting Vector Retrieval, Multi-Agent Reasoning, and Persistence.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSimulatePipeline}
            disabled={isSimulating}
            className="ghost-glow-btn text-xs font-bold uppercase tracking-wider py-2 px-4 flex items-center gap-2 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[16px] ${isSimulating ? "animate-spin" : ""}`}>
              {isSimulating ? "sync" : "play_circle"}
            </span>
            {isSimulating ? "Tracing Graph..." : "Simulate Pipeline"}
          </button>

          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            DAG Online
          </span>
        </div>
      </div>

      {/* Visual Workflow Graph — Responsive 4-Node Pipeline */}
      <div className="glass-pane rounded-2xl p-5 sm:p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-mono uppercase tracking-widest text-on-surface-variant/70">
            Execution StateGraph (Click any node to inspect)
          </span>
          <span className="text-[11px] font-mono text-secondary">
            Total Pipeline Latency: ~168.4 ms
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
          {nodes.map((node, i) => {
            const isSelected = selectedNode === node.id;
            const isExecuting = activeStepIndex === i;
            return (
              <motion.button
                key={node.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedNode(node.id)}
                className={`text-left p-4 rounded-2xl border transition-all relative flex flex-col justify-between gap-3 cursor-pointer ${
                  isSelected || isExecuting
                    ? "bg-secondary/15 border-secondary shadow-[0_0_25px_rgba(123,208,255,0.2)]"
                    : "bg-black/50 border-white/10 hover:border-white/25 hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 text-on-surface-variant">
                    Step 0{i + 1}
                  </span>
                  <span className="text-[11px] font-mono text-emerald-400">{node.latency}</span>
                </div>

                <div className="flex items-center gap-3 my-1">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected || isExecuting
                        ? "bg-secondary text-black shadow-[0_0_15px_rgba(123,208,255,0.5)]"
                        : "bg-white/5 text-secondary border border-white/10"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[22px]">{node.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{node.label}</div>
                    <div className="text-[11px] font-mono text-secondary/80">{node.type}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 w-full text-[10px] font-mono">
                  <span className="text-on-surface-variant/60">Status</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    {isExecuting ? "Executing..." : node.status}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Node Inspector Panel */}
      <motion.div
        key={activeNodeInfo.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-pane rounded-2xl p-5 sm:p-6 border border-white/10 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[22px]">{activeNodeInfo.icon}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">{activeNodeInfo.label}</h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-secondary">
                  {activeNodeInfo.type}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">{activeNodeInfo.desc}</p>
            </div>
          </div>

          <span className="self-start sm:self-center text-[11px] font-mono uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
            {activeNodeInfo.status} • {activeNodeInfo.latency}
          </span>
        </div>

        {/* Node Metadata Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(activeNodeInfo.details).map(([key, val]) => (
            <div key={key} className="bg-black/60 border border-white/10 p-3.5 rounded-xl">
              <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant/60 block mb-1">
                {key.replace(/([A-Z])/g, " $1")}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-primary font-mono block">
                {val}
              </span>
            </div>
          ))}
        </div>

        {/* Live Telemetry Log Trace */}
        <div className="bg-[#060608] border border-white/10 rounded-xl p-4 space-y-1.5 font-mono text-xs">
          <div className="text-[10px] uppercase tracking-widest text-on-surface-variant/50 mb-2 flex items-center justify-between">
            <span>Node Execution Trace</span>
            <span className="text-emerald-400">STREAM_OK</span>
          </div>
          {activeNodeInfo.logs.map((log, index) => (
            <div key={index} className="text-on-surface-variant flex items-center gap-2">
              <span className="text-secondary">❯</span>
              <span>{log}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
