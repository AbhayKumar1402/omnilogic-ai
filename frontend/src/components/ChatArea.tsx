"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Message } from "@/app/page";

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  onInspectSource?: (source: string) => void;
}

export const ChatArea = ({ messages, isLoading, onInspectSource }: ChatAreaProps) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = async (code: string, idx: number) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback for non-https or restricted contexts
        const textarea = document.createElement("textarea");
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (e) {
      console.warn("Clipboard copy fallback applied:", e);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  return (
    <div className="w-full max-w-5xl space-y-6 sm:space-y-8 flex flex-col px-1 sm:px-0">
      {messages.map((msg, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={`${
            msg.role === "user"
              ? "self-end max-w-full sm:max-w-[85%] flex-row-reverse"
              : "self-start max-w-full sm:max-w-[92%]"
          } flex items-start gap-2.5 sm:gap-4 w-full`}
        >
          {/* Avatar Icon */}
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex-shrink-0 flex items-center justify-center border border-white/10 ${
              msg.role === "user"
                ? "bg-surface-variant text-on-surface"
                : "bg-primary/20 border-primary/40 text-primary shadow-[0_0_20px_rgba(168,85,247,0.35)]"
            }`}
          >
            <span
              className="material-symbols-outlined text-[18px] sm:text-[20px]"
              style={msg.role === "agent" ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {msg.role === "user" ? "person" : "auto_awesome"}
            </span>
          </div>

          {/* Message Bubble */}
          <div
            className={`glass-pane rounded-2xl p-4 sm:p-6 w-full ${
              msg.role === "user"
                ? "rounded-tr-sm bg-surface-variant/30 border-white/10"
                : "rounded-tl-sm space-y-4 obsidian-panel"
            }`}
          >
            {msg.role === "agent" && (
              <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                  <span className="text-[11px] font-mono text-secondary uppercase tracking-widest font-semibold">
                    Universal Solver Resolution
                  </span>
                </div>
                {msg.missionId && (
                  <span className="text-[10px] font-mono text-on-surface-variant/50">
                    ID: {msg.missionId}
                  </span>
                )}
              </div>
            )}

            {/* Analysis Text */}
            <p className="text-sm sm:text-base text-on-surface leading-relaxed whitespace-pre-wrap font-sans">
              {msg.content}
            </p>

            {/* Detailed Analysis Callout if present */}
            {msg.analysis && msg.analysis !== msg.content && (
              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                <span className="text-primary font-semibold mr-1 font-mono uppercase text-[10px] tracking-wider block sm:inline">
                  Deep Grounding:
                </span>
                {msg.analysis}
              </div>
            )}

            {/* Obsidian Code Artifact */}
            {msg.artifact && (
              <div className="obsidian-panel rounded-xl overflow-hidden flex flex-col mt-4 border border-white/10 shadow-2xl">
                <div className="bg-black/70 px-4 py-2.5 border-b border-white/10 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
                    <span className="text-xs text-secondary font-mono ml-2 font-medium">
                      Resolution Artifact
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(msg.artifact || "", idx)}
                    className="text-on-surface-variant hover:text-white transition-all flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10"
                    title="Copy artifact to clipboard"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {copiedIndex === idx ? "check" : "content_copy"}
                    </span>
                    <span className="font-mono text-[11px]">
                      {copiedIndex === idx ? "Copied!" : "Copy Code"}
                    </span>
                  </button>
                </div>
                <div className="p-4 sm:p-5 overflow-x-auto bg-[#060606]">
                  <pre className="text-xs sm:text-code-sm text-on-surface/90 leading-relaxed font-mono selection:bg-primary/30">
                    <code>{msg.artifact}</code>
                  </pre>
                </div>
              </div>
            )}

            {/* Sources & Grounding Tags */}
            {msg.sources && msg.sources.length > 0 && (
              <div className="pt-3 border-t border-white/5 flex flex-wrap gap-2 items-center">
                <span className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant/50 mr-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">database</span>
                  Grounded In:
                </span>
                {msg.sources.map((source: string, sIdx: number) => (
                  <button
                    key={sIdx}
                    onClick={() => onInspectSource && onInspectSource(source)}
                    className="bg-primary/10 border border-primary/25 px-2.5 py-0.5 text-xs text-primary flex items-center gap-1 rounded-full hover:bg-primary/20 hover:border-primary/50 transition-all font-mono text-[11px]"
                    title={`Click to inspect ${source}`}
                  >
                    <span className="material-symbols-outlined text-[13px]">menu_book</span>
                    {source}
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      ))}

      {/* Loading Skeleton */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="self-start flex items-center gap-3 text-secondary font-mono text-xs uppercase tracking-widest glass-pane px-4 py-3 rounded-2xl border border-secondary/30 shadow-[0_0_20px_rgba(123,208,255,0.15)]"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-ping"></span>
          <span>Orchestrating Agents: LangGraph Research & Solve in progress...</span>
        </motion.div>
      )}
    </div>
  );
};
