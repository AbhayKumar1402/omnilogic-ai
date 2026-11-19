"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SideNavProps {
  onNewSolve?: () => void;
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onOpenUpgrade?: () => void;
  onOpenDocs?: () => void;
  onOpenSupport?: () => void;
}

export const SideNav = ({
  onNewSolve,
  activeTab = "new",
  onSelectTab,
  isOpenMobile = false,
  onCloseMobile,
  onOpenUpgrade,
  onOpenDocs,
  onOpenSupport,
}: SideNavProps) => {
  const tabs = [
    { id: "new", label: "Solver Terminal", icon: "terminal", desc: "Multi-Agent Workspace" },
    { id: "train", label: "Model Training", icon: "model_training", desc: "Fine-Tuning & Summarizer" },
    { id: "kb", label: "Knowledge Base", icon: "database", desc: "Vector Memory & Shards" },
    { id: "streams", label: "Logic Streams", icon: "account_tree", desc: "Agent Workflow Graph" },
    { id: "archive", label: "Archive", icon: "inventory_2", desc: "Historical Solutions" },
  ];

  const handleTabClick = (tabId: string) => {
    if (onSelectTab) {
      onSelectTab(tabId);
    }
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const handleFreshReset = () => {
    if (onNewSolve) {
      onNewSolve();
    }
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const navContent = (
    <div className="flex flex-col h-full w-64 pt-20 pb-5 px-4 border-r border-white/10 bg-[#08080b]/95 backdrop-blur-2xl select-none">
      {/* Mobile Close Button */}
      <div className="md:hidden flex justify-between items-center mb-4 pb-2 border-b border-white/10">
        <span className="text-xs font-mono uppercase tracking-widest text-secondary">Navigation</span>
        <button
          onClick={onCloseMobile}
          className="p-1.5 text-on-surface-variant hover:text-white rounded-lg hover:bg-white/5"
          aria-label="Close navigation"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Brand Badge */}
      <div className="mb-4 px-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-secondary/15 border border-secondary/30 flex items-center justify-center shadow-[0_0_15px_rgba(123,208,255,0.2)]">
            <span className="material-symbols-outlined text-secondary text-[19px]">smart_toy</span>
          </div>
          <div>
            <h2 className="font-h1 text-[16px] font-bold text-white leading-tight">Universal Solver</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-400/90">Online & Grounded</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated "+ New Solve" Reset Button */}
      <button
        onClick={handleFreshReset}
        className="mb-4 w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-primary/20 via-primary/15 to-secondary/15 hover:from-primary/30 hover:to-secondary/25 border border-primary/35 hover:border-primary text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(221,183,255,0.12)] cursor-pointer"
      >
        <span className="material-symbols-outlined text-primary text-[18px]">add_circle</span>
        <span>New Solve Session</span>
      </button>

      {/* Nav Tabs */}
      <div className="flex-1 space-y-1.5 overflow-y-auto pr-0.5">
        <div className="px-2 pb-1 text-[10px] font-mono uppercase tracking-widest text-on-surface-variant/40">
          Core Modules
        </div>
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <motion.button
              key={t.id}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleTabClick(t.id)}
              className={`w-full text-left flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-secondary/15 text-white border border-secondary/40 shadow-[0_0_20px_rgba(123,208,255,0.12)]"
                  : "text-on-surface-variant hover:bg-white/[0.04] hover:text-white border border-transparent"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                  isActive ? "bg-secondary text-black" : "bg-white/5 text-on-surface-variant"
                }`}
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {t.icon}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-semibold tracking-wide ${isActive ? "text-white" : ""}`}>
                  {t.label}
                </div>
                <div className="text-[10px] text-on-surface-variant/60 truncate">{t.desc}</div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="mt-auto pt-4 border-t border-white/10 space-y-2.5">
        <button
          onClick={onOpenUpgrade}
          className="w-full ghost-glow-btn py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[16px]">tune</span>
          Engine Config
        </button>

        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <button
            onClick={onOpenDocs}
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-on-surface-variant/70 hover:text-white text-[11px] rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px] text-secondary">menu_book</span>
            Shards
          </button>
          <button
            onClick={onOpenSupport}
            className="flex items-center justify-center gap-1.5 px-2 py-1.5 text-on-surface-variant/70 hover:text-white text-[11px] rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px] text-primary">vital_signs</span>
            Status
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full z-40">
        {navContent}
      </aside>

      {/* Mobile Slide-Over Drawer */}
      <AnimatePresence>
        {isOpenMobile && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative z-10 h-full shadow-2xl"
            >
              {navContent}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
