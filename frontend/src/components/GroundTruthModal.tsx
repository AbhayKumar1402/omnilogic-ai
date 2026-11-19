"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface GroundTruthModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources?: string[];
}

export const GroundTruthModal = ({
  isOpen,
  onClose,
  sources = ["sys_arch_v4", "api_schema"],
}: GroundTruthModalProps) => {
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
              <span className="material-symbols-outlined text-primary text-[22px]">verified</span>
              <h2 className="text-base sm:text-lg font-bold text-white">Ground Truth Verification</h2>
            </div>
            <button
              onClick={onClose}
              className="text-on-surface-variant hover:text-white p-1 rounded-lg hover:bg-white/5"
            >
              ✕
            </button>
          </div>

          <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
            OmniLogic grounds every solver resolution in verified vector memory shards and deterministic constraints.
          </p>

          <div className="space-y-3">
            <div className="p-3.5 bg-black/60 rounded-xl border border-white/10 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono text-secondary">Cosine Grounding Metric</span>
                <span className="font-mono font-bold text-emerald-400">0.962 (High Confidence)</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-secondary to-emerald-400 h-full w-[96%]"></div>
              </div>
            </div>

            <div className="p-3.5 bg-black/60 rounded-xl border border-white/10 space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant/70 block">
                Active Knowledge Anchors:
              </span>
              <div className="flex flex-wrap gap-2">
                {sources.map((src, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-mono flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">menu_book</span>
                    {src}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3 bg-surface-variant/20 rounded-xl border border-white/5 text-xs text-on-surface-variant leading-relaxed">
              <strong className="text-white block mb-0.5">Vector Store Specification:</strong>
              Index: <code className="text-secondary">omnilogic-memory</code> (Pinecone AWS us-east-1 serverless) with fallback local in-memory cosine shard.
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={onClose} className="ghost-glow-btn text-xs font-bold uppercase py-2 px-4">
              Close Inspector
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
