"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PromptBarProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export const PromptBar = ({ onSend, disabled }: PromptBarProps) => {
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (input.trim() && !disabled) {
      onSend(input);
      setInput("");
      setShowAttachMenu(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      setIsRecording(true);
      // Simulate listening and populating a prompt
      setTimeout(() => {
        setInput("Analyze spatial memory leak in manifold folding loop");
        setIsRecording(false);
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 2000);
    }
  };

  const handleAttachSnippet = (snippet: string) => {
    setInput((prev) => (prev ? `${prev}\n[Context: ${snippet}]` : `[Context: ${snippet}] `));
    setShowAttachMenu(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const quickPrompts = [
    "Analyze spatial memory leak in manifold folding",
    "Synthesize Rust allocation frame for spatial warping",
    "Audit thread pool concurrency under high load",
  ];

  return (
    <div className="fixed bottom-0 left-0 md:left-64 right-0 p-3 sm:p-5 md:p-6 flex flex-col items-center z-40 bg-gradient-to-t from-[#050505] via-[#050505]/90 to-transparent pointer-events-none">
      {/* Quick Prompts Carousel (when input is empty) */}
      {!input && (
        <div className="hidden sm:flex items-center gap-2 mb-2 pointer-events-auto max-w-3xl w-full overflow-x-auto py-1 px-2 no-scrollbar">
          <span className="text-[10px] font-mono uppercase tracking-widest text-secondary/60 flex items-center gap-1 flex-shrink-0">
            <span className="material-symbols-outlined text-[13px]">lightbulb</span>
            Try:
          </span>
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInput(qp);
                if (inputRef.current) inputRef.current.focus();
              }}
              className="text-[11px] text-on-surface-variant hover:text-white bg-surface-variant/40 hover:bg-white/10 px-2.5 py-1 rounded-full border border-white/5 transition-all truncate flex-shrink-0"
            >
              {qp}
            </button>
          ))}
        </div>
      )}

      {/* Attach Context Popover */}
      <AnimatePresence>
        {showAttachMenu && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="w-full max-w-md mb-2 p-3 rounded-2xl glass-pane obsidian-panel shadow-2xl pointer-events-auto border border-white/15"
          >
            <div className="flex justify-between items-center mb-2 px-1">
              <span className="text-[11px] font-mono uppercase tracking-widest text-secondary">
                Attach Grounding Context
              </span>
              <button
                onClick={() => setShowAttachMenu(false)}
                className="text-on-surface-variant hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1">
              {[
                { label: "v4 Architecture Schema", desc: "Manifold folding & explicit drop frames" },
                { label: "Memory Pool Specification", desc: "High-throughput bounded ring buffers" },
                { label: "Live Diagnostic Dump", desc: "Attach simulated runtime crash trace" },
              ].map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleAttachSnippet(item.label)}
                  className="w-full text-left p-2 rounded-xl hover:bg-white/5 flex items-center gap-2 text-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-primary text-[18px]">attachment</span>
                  <div>
                    <div className="font-semibold text-white">{item.label}</div>
                    <div className="text-[10px] text-on-surface-variant/70">{item.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Glass Prompt Bar */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`w-full max-w-3xl glass-pane rounded-2xl sm:rounded-full p-1.5 sm:p-2 flex items-center gap-1.5 sm:gap-2 pointer-events-auto shadow-[0_10px_40px_rgba(0,0,0,0.6)] focus-within:shadow-[0_0_30px_rgba(168,85,247,0.25)] border border-white/15 transition-all duration-300 ${
          disabled ? "opacity-60 grayscale" : ""
        }`}
      >
        {/* Context Attachment Button */}
        <button
          onClick={() => setShowAttachMenu(!showAttachMenu)}
          className={`p-2.5 text-on-surface-variant hover:text-secondary transition-colors rounded-full hover:bg-white/5 flex-shrink-0 ${
            showAttachMenu ? "text-secondary bg-secondary/10" : ""
          }`}
          title="Attach Context / Shard"
          disabled={disabled}
        >
          <span className="material-symbols-outlined text-[20px]">
            {showAttachMenu ? "cancel" : "add_circle"}
          </span>
        </button>

        {/* Text Input */}
        <input
          ref={inputRef}
          className="flex-1 bg-transparent border-none focus:ring-0 text-on-surface text-sm sm:text-base placeholder-on-surface-variant/50 px-2 py-2 outline-none min-w-0"
          placeholder={
            disabled
              ? "Orchestrating agents..."
              : isRecording
              ? "Listening to your voice..."
              : "Ask anything to OmniLogic (e.g. solve memory leak)..."
          }
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />

        {/* Mic / Voice Recording Button */}
        <button
          onClick={toggleRecording}
          className={`p-2.5 transition-colors rounded-full hover:bg-white/5 flex-shrink-0 ${
            isRecording
              ? "text-red-400 bg-red-500/20 animate-pulse"
              : "text-on-surface-variant hover:text-primary"
          }`}
          title={isRecording ? "Stop Listening" : "Voice Input"}
          disabled={disabled}
        >
          <span className="material-symbols-outlined text-[20px]">
            {isRecording ? "mic" : "mic_none"}
          </span>
        </button>

        {/* Send Button */}
        <button
          onClick={handleSubmit}
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 mr-1 ${
            input.trim() && !disabled
              ? "bg-gradient-to-r from-primary to-primary-container text-on-primary hover:opacity-95 shadow-[0_0_15px_rgba(168,85,247,0.5)] scale-100"
              : "bg-surface-variant/40 text-on-surface-variant/40 cursor-not-allowed scale-95"
          }`}
          disabled={disabled || !input.trim()}
          title="Initiate Mission"
        >
          <span className="material-symbols-outlined text-[18px] sm:text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            arrow_upward
          </span>
        </button>
      </motion.div>
    </div>
  );
};
