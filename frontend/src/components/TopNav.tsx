"use client";

import React from "react";

interface TopNavProps {
  onToggleMobileMenu?: () => void;
  onDeployFix?: () => void;
  onGroundTruth?: () => void;
  onOpenHistory?: () => void;
  onOpenSettings?: () => void;
  onOpenAccount?: () => void;
  hasArtifact?: boolean;
  isAdmin?: boolean;
  onExitAdmin?: () => void;
}

export const TopNav = ({
  onToggleMobileMenu,
  onDeployFix,
  onGroundTruth,
  onOpenHistory,
  onOpenSettings,
  onOpenAccount,
  hasArtifact = false,
  isAdmin = false,
  onExitAdmin,
}: TopNavProps) => {
  return (
    <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 sm:px-6 md:px-8 h-16 bg-surface/70 backdrop-blur-xl border-b border-white/10">
      {/* Brand & Mobile Hamburger */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="p-2 text-on-surface-variant hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Toggle navigation drawer"
            title="Open Menu Drawer"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
        )}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-[0_0_15px_rgba(221,183,255,0.4)]">
            <span className="material-symbols-outlined text-black text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              neurology
            </span>
          </div>
          <span className="font-h1 text-xl font-bold text-on-surface tracking-tight bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
            OmniLogic
          </span>
          <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest rounded-full bg-primary/10 border border-primary/20 text-primary">
            v4.2 Active
          </span>
          {isAdmin && (
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
              Admin
            </span>
          )}
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {isAdmin && onExitAdmin && (
          <button
            onClick={onExitAdmin}
            className="text-xs font-mono text-on-surface-variant hover:text-white px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
            title="Return to Public User Portal"
          >
            <span className="material-symbols-outlined text-[15px]">arrow_back</span>
            <span className="hidden sm:inline">User View</span>
          </button>
        )}
        <button
          onClick={onDeployFix}
          className={`ghost-glow-btn text-xs sm:text-code-sm font-bold uppercase tracking-wider py-1.5 px-3 sm:py-2 sm:px-4 flex items-center gap-1.5 ${
            hasArtifact ? "border-secondary text-secondary shadow-[0_0_15px_rgba(123,208,255,0.3)] animate-pulse" : "opacity-75"
          }`}
          title="Deploy current resolution artifact"
        >
          <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
          <span className="hidden sm:inline">Deploy Fix</span>
        </button>

        <button
          onClick={onGroundTruth}
          className="slate-glass-btn text-xs sm:text-code-sm font-bold uppercase tracking-wider py-1.5 px-3 sm:py-2 sm:px-4 flex items-center gap-1.5"
          title="Inspect Ground Truth & Memory Shards"
        >
          <span className="material-symbols-outlined text-[16px]">verified</span>
          <span className="hidden sm:inline">Ground Truth</span>
        </button>

        <div className="flex items-center gap-1 sm:gap-2 border-l border-white/10 pl-2 sm:pl-3">
          <button
            onClick={onOpenHistory}
            className="p-2 text-on-surface-variant hover:text-primary rounded-lg hover:bg-white/5 transition-colors"
            title="Mission History & Archive"
          >
            <span className="material-symbols-outlined text-[20px]">history</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2 text-on-surface-variant hover:text-primary rounded-lg hover:bg-white/5 transition-colors"
            title="System Configuration & Keys"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
          <button
            onClick={onOpenAccount}
            className="p-2 text-on-surface-variant hover:text-primary rounded-lg hover:bg-white/5 transition-colors"
            title="Account & Session Status"
          >
            <span className="material-symbols-outlined text-[20px]">account_circle</span>
          </button>
        </div>
      </div>
    </header>
  );
};
