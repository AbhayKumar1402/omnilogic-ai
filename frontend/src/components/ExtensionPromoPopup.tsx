"use client";

import React, { useState, useEffect, useRef } from "react";
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
  const [installStepVisible, setInstallStepVisible] = useState(false);
  const widgetLauncherRef = useRef<HTMLAnchorElement>(null);

  // If published to Chrome Web Store, set NEXT_PUBLIC_CHROME_WEBSTORE_URL to the official store URL
  const webstoreUrl = process.env.NEXT_PUBLIC_CHROME_WEBSTORE_URL || "";

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Unregister any old PWA service worker so Chrome treats this purely as a Web App + Chrome Extension
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) {
          reg.unregister();
        }
      });
    }

    const dismissed = sessionStorage.getItem("omnilogic_ext_promo_dismissed");
    if (!dismissed) {
      const timer = setTimeout(() => {
        setShowToast(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Inject live on-page floating widget script via 1-click toolbar button
  useEffect(() => {
    if (widgetLauncherRef.current && typeof window !== "undefined") {
      const origin = window.location.origin;
      const code = `javascript:(function(){if(window.__omnilogic_content_injected){var f=document.getElementById('omnilogic-floating-root');if(f&&f.shadowRoot){f.shadowRoot.getElementById('ol-fab').click();}return;}var s=document.createElement('script');s.src='${origin}/omnilogic-widget.js?t='+Date.now();document.body.appendChild(s);})();`;
      widgetLauncherRef.current.setAttribute("href", code);
    }
  }, [isModalOpen, showToast]);

  const handleDismissToast = () => {
    setShowToast(false);
    sessionStorage.setItem("omnilogic_ext_promo_dismissed", "true");
  };

  const handleAddToChromeClick = () => {
    if (webstoreUrl) {
      window.open(webstoreUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (onOpenModal) {
      onOpenModal();
    }
  };

  const handleDownloadAndInstall = () => {
    const link = document.createElement("a");
    link.href = "/omnilogic-chrome-extension.zip";
    link.download = "omnilogic-chrome-extension.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setInstallStepVisible(true);
  };

  const handleCopyExtensionsUrl = () => {
    navigator.clipboard.writeText("chrome://extensions");
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  return (
    <>
      {/* Commercial Chrome Extension Floating Pop-Up Banner (Grammarly / Monica / Loom Style) */}
      <AnimatePresence>
        {showToast && !isModalOpen && (
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
            className="fixed top-20 right-4 sm:right-6 z-50 w-[350px] sm:w-[395px] rounded-2xl bg-[#0e0e17]/98 backdrop-blur-2xl border border-secondary/45 shadow-[0_20px_60px_rgba(0,0,0,0.92),0_0_35px_rgba(123,208,255,0.22)] p-4 sm:p-5 overflow-hidden"
          >
            {/* Top Chrome Web Store Badge + Close */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary/15 border border-secondary/35 text-secondary text-[10px] font-mono font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                Chrome Browser Extension
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-amber-400 font-bold">★★★★★ 5.0</span>
                <button
                  onClick={handleDismissToast}
                  className="p-1 text-on-surface-variant/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="Dismiss"
                >
                  <span className="material-symbols-outlined text-[18px] block">close</span>
                </button>
              </div>
            </div>

            {/* Main Extension Info */}
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(123,208,255,0.3)]">
                <span className="material-symbols-outlined text-black text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  extension
                </span>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                  OmniLogic for Google Chrome
                </h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Adds a floating <strong className="text-secondary">&ldquo;⚡ Summarize Page&rdquo;</strong> button directly onto every website you visit so you can summarize any article or PDF without leaving the tab.
                </p>
              </div>
            </div>

            {/* Commercial "Add to Chrome — It's Free" CTA */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={handleAddToChromeClick}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold text-xs tracking-wide flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(26,115,232,0.45)] transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Add to Chrome &mdash; It&apos;s Free</span>
              </button>
              <button
                onClick={handleDismissToast}
                className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-on-surface-variant hover:text-white transition-colors cursor-pointer"
              >
                Later
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chrome Web Store Style Listing & Instant Extension Installer Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseModal}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              className="relative z-10 w-full max-w-2xl rounded-2xl bg-[#0c0c14] border border-secondary/40 shadow-[0_25px_80px_rgba(0,0,0,0.95),0_0_40px_rgba(123,208,255,0.2)] p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[92vh]"
            >
              {/* Store Listing Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-[0_0_25px_rgba(123,208,255,0.35)] flex-shrink-0">
                    <span className="material-symbols-outlined text-black text-[30px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      extension
                    </span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg sm:text-xl font-h1 font-bold text-white">
                        OmniLogic AI Summarizer
                      </h2>
                      <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 font-bold">
                        ✓ Verified Extension
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-on-surface-variant">
                      <span className="text-amber-400 font-bold">★★★★★ 5.0</span>
                      <span>•</span>
                      <span>Manifest V3</span>
                      <span>•</span>
                      <span className="text-secondary">Works directly on any webpage</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={handleDownloadAndInstall}
                    className="py-2.5 px-5 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white font-bold text-xs tracking-wide flex items-center gap-2 shadow-[0_4px_20px_rgba(26,115,232,0.5)] transition-all cursor-pointer whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-[18px]">extension</span>
                    <span>Add to Chrome</span>
                  </button>
                  <button
                    onClick={onCloseModal}
                    className="p-2 text-on-surface-variant hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
              </div>

              {/* Visual Preview of How the Extension Works Directly on Any Webpage */}
              <div className="rounded-xl bg-[#07070c] border border-white/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-secondary font-bold">
                    ✨ How It Works Directly on Any Webpage
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    In-Page Floating Button + Toolbar Popup
                  </span>
                </div>

                {/* Simulated Browser Viewport */}
                <div className="rounded-xl bg-[#11111a] border border-white/10 p-3.5 relative overflow-hidden">
                  <div className="flex items-center gap-1.5 mb-2.5 pb-2 border-b border-white/5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                    <span className="ml-2 text-[10px] font-mono text-on-surface-variant/60 bg-black/50 px-2.5 py-0.5 rounded w-full">
                      https://en.wikipedia.org/wiki/Artificial_intelligence
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[11px] text-on-surface-variant/50 pr-28">
                    <div className="h-2.5 w-3/4 bg-white/10 rounded" />
                    <div className="h-2 w-full bg-white/5 rounded" />
                    <div className="h-2 w-5/6 bg-white/5 rounded" />
                    <div className="h-2 w-2/3 bg-white/5 rounded" />
                  </div>

                  {/* Simulated Floating Extension Button on the Page */}
                  <div className="mt-3 flex items-center justify-end">
                    <div className="px-3.5 py-1.5 rounded-full bg-[#151522] border border-secondary text-white text-[11px] font-bold flex items-center gap-1.5 shadow-[0_0_20px_rgba(123,208,255,0.35)]">
                      <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
                      <span>⚡ Summarize Page</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instant Drag-and-Drop Chrome Extension Installation */}
              {installStepVisible && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="p-4 rounded-xl bg-blue-500/10 border border-blue-400/40 space-y-3"
                >
                  <div className="flex items-center gap-2 text-blue-300 font-bold text-xs">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>omnilogic-chrome-extension.zip downloaded! Complete in 2 clicks:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 rounded-lg bg-black/60 border border-white/10 space-y-1.5">
                      <span className="font-mono text-secondary font-bold block">
                        1. Open Chrome Extensions
                      </span>
                      <p className="text-on-surface-variant text-[11px]">
                        Copy & paste into a new tab and switch on <strong className="text-white">Developer mode</strong> (top right):
                      </p>
                      <button
                        onClick={handleCopyExtensionsUrl}
                        className="w-full py-1.5 px-2.5 rounded bg-white/10 hover:bg-white/15 text-white font-mono text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px] text-secondary">
                          {copiedUrl ? "check" : "content_copy"}
                        </span>
                        <span>{copiedUrl ? "Copied chrome://extensions!" : "Copy chrome://extensions"}</span>
                      </button>
                    </div>
                    <div className="p-3 rounded-lg bg-black/60 border border-white/10 space-y-1.5">
                      <span className="font-mono text-secondary font-bold block">
                        2. Drag & Drop or Load Unpacked
                      </span>
                      <p className="text-on-surface-variant text-[11px]">
                        Unzip the downloaded file and click <strong className="text-white">Load unpacked</strong> (or drag the folder onto the <code className="text-white">chrome://extensions</code> page).
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Zero-Install Instant Live Widget Injector */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[17px]">bolt</span>
                    Want to use the floating widget immediately without installing?
                  </span>
                  <p className="text-[11px] text-on-surface-variant">
                    Drag this button to your Chrome Bookmarks Bar. Click it on any website to pop up the floating <strong className="text-white">OmniLogic Extension Drawer</strong> directly on that webpage!
                  </p>
                </div>
                <a
                  ref={widgetLauncherRef}
                  onClick={(e) => {
                    e.preventDefault();
                    alert("Drag this button to your Chrome Bookmarks Bar! When you click it on any website, the floating OmniLogic Extension Drawer will appear right on that webpage.");
                  }}
                  draggable={true}
                  className="py-2 px-4 rounded-full bg-gradient-to-r from-primary to-secondary text-black font-bold text-xs whitespace-nowrap shadow-[0_0_20px_rgba(221,183,255,0.3)] cursor-grab active:cursor-grabbing select-none self-end sm:self-center"
                >
                  ⚡ OmniLogic Live Widget
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
