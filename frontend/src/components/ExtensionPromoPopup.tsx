"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ExtensionPromoPopupProps {
  isModalOpen?: boolean;
  onCloseModal?: () => void;
  onOpenModal?: () => void;
}

export const ExtensionPromoPopup = ({
  isModalOpen = false,
  onCloseModal,
  onOpenModal,
}: ExtensionPromoPopupProps) => {
  const [showToast, setShowToast] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("omnilogic_ext_promo_dismissed");
    if (!dismissed) {
      const timer = setTimeout(() => {
        setShowToast(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismissToast = () => {
    setShowToast(false);
    sessionStorage.setItem("omnilogic_ext_promo_dismissed", "true");
  };

  const handleDownloadExtension = () => {
    const link = document.createElement("a");
    link.href = "/omnilogic-chrome-extension.zip";
    link.download = "omnilogic-chrome-extension.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setDownloaded(true);
    if (onOpenModal) {
      onOpenModal();
    }
  };

  const handleCopyExtensionsUrl = () => {
    navigator.clipboard.writeText("chrome://extensions");
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  return (
    <>
      {/* Floating Bottom-Right Pop-Up Notification Banner */}
      <AnimatePresence>
        {showToast && !isModalOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="fixed bottom-5 right-5 z-50 w-[340px] sm:w-[385px] rounded-2xl bg-[#0b0b12]/95 backdrop-blur-2xl border border-secondary/40 shadow-[0_15px_50px_rgba(0,0,0,0.85),0_0_30px_rgba(123,208,255,0.2)] p-4 sm:p-5 overflow-hidden"
          >
            {/* Ambient Top Glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-secondary/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-primary/20 rounded-full blur-2xl pointer-events-none" />

            {/* Top Row: Badge + Dismiss */}
            <div className="flex items-center justify-between gap-2 mb-2.5 relative z-10">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary/15 border border-secondary/30 text-secondary text-[10px] font-mono font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                Chrome Extension • Manifest V3
              </div>
              <button
                onClick={handleDismissToast}
                className="p-1 text-on-surface-variant/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Dismiss notification"
                aria-label="Dismiss notification"
              >
                <span className="material-symbols-outlined text-[18px] block">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="flex items-start gap-3.5 relative z-10">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-primary/30 to-secondary/30 border border-secondary/40 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(123,208,255,0.25)] mt-0.5">
                <span className="material-symbols-outlined text-secondary text-[24px]">extension</span>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                  Summarize Any Webpage in 1-Click
                </h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Add the official <strong>OmniLogic Extension</strong> to Chrome and distill articles, docs, and PDFs directly on any open browser tab.
                </p>
              </div>
            </div>

            {/* Highlights */}
            <div className="flex flex-wrap items-center gap-1.5 mt-3 mb-3.5 relative z-10">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-on-surface-variant">
                ⚡ 1-Click Tab Capture
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-on-surface-variant">
                📄 Live PDF & Docs
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-on-surface-variant">
                🎯 6 AI Modes
              </span>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-2 relative z-10">
              <button
                onClick={handleDownloadExtension}
                className="flex-1 py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-secondary to-primary text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(123,208,255,0.35)] hover:opacity-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">download</span>
                <span>Add to Chrome</span>
              </button>
              <button
                onClick={() => {
                  if (onOpenModal) onOpenModal();
                }}
                className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-mono text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                How to Use
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Step-by-Step Chrome Extension Installation Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseModal}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              className="relative z-10 w-full max-w-xl rounded-2xl bg-[#0a0a10] border border-secondary/35 shadow-[0_25px_70px_rgba(0,0,0,0.9),0_0_40px_rgba(123,208,255,0.15)] p-5 sm:p-6 space-y-5 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-primary/25 to-secondary/25 border border-secondary/40 flex items-center justify-center shadow-[0_0_20px_rgba(123,208,255,0.2)]">
                    <span className="material-symbols-outlined text-secondary text-[24px]">extension</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-h1 font-bold text-white">
                        Get OmniLogic for Chrome
                      </h2>
                      <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        v1.4 Ready
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Summarize any live webpage, documentation, or PDF tab directly inside your browser.
                    </p>
                  </div>
                </div>
                <button
                  onClick={onCloseModal}
                  className="p-1.5 text-on-surface-variant hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* 3-Step Visual Guide */}
              <div className="space-y-3.5">
                {/* Step 1 */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-secondary text-black font-mono text-xs font-bold flex items-center justify-center">
                        1
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-white">
                        Download & Unzip the Extension Package
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant pl-7">
                      Download the official bundle below and extract/unzip it to any folder on your computer.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadExtension}
                    className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-secondary to-primary text-black font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(123,208,255,0.3)] hover:opacity-95 transition-all cursor-pointer whitespace-nowrap self-end sm:self-center"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    <span>{downloaded ? "Download Again (.zip)" : "Download .ZIP"}</span>
                  </button>
                </div>

                {/* Step 2 */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-secondary text-black font-mono text-xs font-bold flex items-center justify-center">
                      2
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-white">
                      Open Chrome Extensions & Enable Developer Mode
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant pl-7">
                    Copy the address below, paste it into a new Chrome tab address bar, and toggle on{" "}
                    <strong className="text-white">Developer mode</strong> in the top-right corner:
                  </p>
                  <div className="pl-7 flex items-center gap-2">
                    <code className="flex-1 bg-black/70 border border-white/15 rounded-lg px-3 py-2 text-xs font-mono text-secondary select-all">
                      chrome://extensions
                    </code>
                    <button
                      onClick={handleCopyExtensionsUrl}
                      className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-mono text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px] text-secondary">
                        {copiedUrl ? "check" : "content_copy"}
                      </span>
                      <span>{copiedUrl ? "Copied!" : "Copy URL"}</span>
                    </button>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-secondary text-black font-mono text-xs font-bold flex items-center justify-center">
                      3
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-white">
                      Click &ldquo;Load Unpacked&rdquo; & Pin to Toolbar
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant pl-7 leading-relaxed">
                    Click <strong className="text-white">Load unpacked</strong> (top-left button in Chrome), select the unzipped{" "}
                    <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded">omnilogic-chrome-extension</code> folder, and pin{" "}
                    <strong className="text-white">OmniLogic</strong> from your puzzle icon 🧩 in the browser bar!
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Synced with Trained Model v1.4
                </span>
                <button
                  onClick={onCloseModal}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
