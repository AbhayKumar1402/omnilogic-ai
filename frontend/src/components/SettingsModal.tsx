"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_HOSTS, PRIMARY_API_URL } from "@/lib/api";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal = ({ isOpen, onClose }: SettingsModalProps) => {
  const [backendStatus, setBackendStatus] = useState<string>("Checking...");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-1.5-flash");

  useEffect(() => {
    if (!isOpen) return;
    const checkHealth = async () => {
      for (const host of API_HOSTS) {
        try {
          const res = await fetch(`${host}/api/v1/health`);
          if (res.ok) {
            const data = await res.json();
            setBackendStatus(`Online (${data.vector_service} / ${data.supabase_service})`);
            return;
          }
        } catch (_) {}
      }
      setBackendStatus("Offline (Backend server not responding on :8000)");
    };
    checkHealth();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative z-10 w-full max-w-lg obsidian-panel glass-pane rounded-2xl p-6 border border-white/20 shadow-2xl space-y-4"
        >
          <div className="flex justify-between items-center border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[22px]">settings</span>
              <h2 className="text-base sm:text-lg font-bold text-white">System Settings & Status</h2>
            </div>
            <button
              onClick={onClose}
              className="text-on-surface-variant hover:text-white p-1 rounded-lg hover:bg-white/5"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3.5">
            {/* Backend Connectivity Status */}
            <div className="p-3.5 bg-black/60 rounded-xl border border-white/10 flex justify-between items-center">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant/70 block">
                  FastAPI Backend Endpoint
                </span>
                <span className="text-xs font-mono text-white">{PRIMARY_API_URL}</span>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  backendStatus.startsWith("Online")
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                }`}
              >
                {backendStatus}
              </span>
            </div>

            {/* AI Model Selection */}
            <div className="p-3.5 bg-black/60 rounded-xl border border-white/10 space-y-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant/70 block">
                Target AI Model
              </span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-[#111111] border border-white/15 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-primary"
              >
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Ultra Fast & Low Latency)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Architectural Reasoning)</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash (Next-Gen Grounding)</option>
              </select>
            </div>

            {/* Architecture Standards */}
            <div className="p-3 bg-surface-variant/20 rounded-xl border border-white/5 space-y-1 text-xs text-on-surface-variant">
              <strong className="text-white block font-sans">Active Mission Protocol:</strong>
              <div className="font-mono text-[11px] space-y-0.5">
                <div>• Lead Orchestrator: LangGraph StateGraph</div>
                <div>• Grounding: Vector Cosine Retrieval (768-dim)</div>
                <div>• Theme: Obsidian Liquid Glass v4.2</div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="ghost-glow-btn text-xs font-bold uppercase py-2 px-4">
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
