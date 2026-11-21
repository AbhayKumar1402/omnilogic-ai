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
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showDevOptions, setShowDevOptions] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);

  const webstoreUrl = process.env.NEXT_PUBLIC_CHROME_WEBSTORE_URL || "";

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already running as installed Chrome App
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Check if layout script already captured Chrome's native beforeinstallprompt
    const win = window as any;
    if (win.__omnilogicDeferredPrompt) {
      setDeferredPrompt(win.__omnilogicDeferredPrompt);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      win.__omnilogicDeferredPrompt = e;
      setDeferredPrompt(e);
    };

    const handleCustomReady = () => {
      if (win.__omnilogicDeferredPrompt) {
        setDeferredPrompt(win.__omnilogicDeferredPrompt);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowToast(false);
      if (onCloseModal) onCloseModal();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("omnilogic-install-ready", handleCustomReady);
    window.addEventListener("appinstalled", handleAppInstalled);

    const dismissed = sessionStorage.getItem("omnilogic_ext_promo_dismissed");
    if (!dismissed && !window.matchMedia("(display-mode: standalone)").matches) {
      const timer = setTimeout(() => {
        setShowToast(true);
      }, 1000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("omnilogic-install-ready", handleCustomReady);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [onCloseModal]);

  // Attach dynamic 1-click bookmarklet href so React doesn't block javascript: protocol
  useEffect(() => {
    if (bookmarkletRef.current && typeof window !== "undefined") {
      const origin = window.location.origin;
      const code = `javascript:(function(){window.open('${origin}/?url='+encodeURIComponent(location.href),'_blank');})();`;
      bookmarkletRef.current.setAttribute("href", code);
    }
  }, [isModalOpen, showToast]);

  const handleDismissToast = () => {
    setShowToast(false);
    sessionStorage.setItem("omnilogic_ext_promo_dismissed", "true");
  };

  /**
   * 1-Click Native Chrome Install Handler:
   * 1. If Chrome's native `beforeinstallprompt` is ready -> Pops up Chrome's built-in "Install OmniLogic?" dialog immediately in 1 click!
   * 2. If Chrome Web Store URL is configured -> Opens the 1-click Chrome Web Store page!
   * 3. Otherwise -> Opens the simple 1-Click Chrome Address Bar / Toolbar Launcher dialog!
   */
  const handleOneClickAdd = async () => {
    const win = typeof window !== "undefined" ? (window as any) : null;
    const promptEvent = deferredPrompt || win?.__omnilogicDeferredPrompt;

    if (promptEvent) {
      try {
        promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
          setShowToast(false);
        }
        win.__omnilogicDeferredPrompt = null;
        setDeferredPrompt(null);
        return;
      } catch (_) {}
    }

    if (webstoreUrl) {
      window.open(webstoreUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (onOpenModal) {
      onOpenModal();
    }
  };

  const handleDownloadZip = () => {
    const link = document.createElement("a");
    link.href = "/omnilogic-chrome-extension.zip";
    link.download = "omnilogic-chrome-extension.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyExtensionsUrl = () => {
    navigator.clipboard.writeText("chrome://extensions");
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  return (
    <>
      {/* Native-Style Chrome Top-Right Suggestion Pop-Up (Right below Chrome's Address Bar / Extensions Toolbar) */}
      <AnimatePresence>
        {showToast && !isModalOpen && !isInstalled && (
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
            className="fixed top-20 right-4 sm:right-6 z-50 w-[340px] sm:w-[380px] rounded-2xl bg-[#101018]/98 backdrop-blur-2xl border border-secondary/50 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(123,208,255,0.22)] p-4 overflow-hidden"
          >
            {/* Pointer Arrow pointing up toward Chrome's Extension/URL bar */}
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary/15 border border-secondary/35 text-secondary text-[10px] font-mono font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping" />
                {deferredPrompt ? "Chrome 1-Click Install Ready" : "Add OmniLogic to Chrome"}
              </div>
              <button
                onClick={handleDismissToast}
                className="p-1 text-on-surface-variant/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Not now"
              >
                <span className="material-symbols-outlined text-[18px] block">close</span>
              </button>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(123,208,255,0.3)]">
                <span className="material-symbols-outlined text-black text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  extension
                </span>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white leading-snug">
                  Use OmniLogic on Any Webpage
                </h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  {deferredPrompt
                    ? "Click below to trigger Chrome's native 1-click install prompt — no downloads or setup required."
                    : "Add OmniLogic directly to your Chrome browser to summarize any article, doc, or PDF in 1 click."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3.5">
              <button
                onClick={handleOneClickAdd}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-secondary to-primary text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(123,208,255,0.35)] hover:opacity-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">add_circle</span>
                <span>Add to Chrome (1-Click)</span>
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

      {/* Simplified 1-Click Chrome Integration Modal (No Complex ZIP Steps Required!) */}
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
              className="relative z-10 w-full max-w-lg rounded-2xl bg-[#0b0b12] border border-secondary/40 shadow-[0_25px_70px_rgba(0,0,0,0.95),0_0_40px_rgba(123,208,255,0.2)] p-5 sm:p-6 space-y-5 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-[0_0_20px_rgba(123,208,255,0.3)]">
                    <span className="material-symbols-outlined text-black text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      extension
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg font-h1 font-bold text-white">
                      1-Click Add to Chrome
                    </h2>
                    <p className="text-xs text-on-surface-variant">
                      No file downloads or complex setup needed — choose either instant option:
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

              {/* OPTION 1: Native Chrome Browser Install */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-secondary/10 via-primary/10 to-transparent border border-secondary/35 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-secondary font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">install_desktop</span>
                    Option 1 • Native Chrome Browser Install
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Fastest • 0 Downloads
                  </span>
                </div>

                {deferredPrompt ? (
                  <div className="space-y-2.5">
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Click below and Chrome will immediately show its native <strong className="text-white">&ldquo;Install OmniLogic AI&rdquo;</strong> confirmation popup:
                    </p>
                    <button
                      onClick={handleOneClickAdd}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-secondary to-primary text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(123,208,255,0.35)] hover:opacity-95 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">add_to_drive</span>
                      <span>Trigger Chrome Native Install Popup Now</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Look at the right side of your <strong className="text-white">Chrome URL Address Bar</strong> at the top of your screen and click the{" "}
                    <strong className="text-secondary">Install OmniLogic icon (🖥️ / ⊕)</strong> — Chrome will install OmniLogic natively in 1 click!
                  </p>
                )}
              </div>

              {/* OPTION 2: 1-Click Drag-to-Toolbar Summarizer Button (Works on ANY Website!) */}
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-primary font-bold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">bolt</span>
                    Option 2 • 1-Click Any-Webpage Toolbar Button
                  </span>
                  <span className="text-[10px] font-mono text-on-surface-variant">
                    Works on Every Website
                  </span>
                </div>

                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Drag the glowing button below up to your <strong className="text-white">Chrome Bookmarks Bar</strong> (press <code className="text-white bg-white/10 px-1 py-0.5 rounded">Ctrl+Shift+B</code> if hidden). Whenever you are reading <em>any</em> article or webpage, click it once to summarize that page instantly!
                </p>

                <div className="flex items-center justify-center pt-1">
                  <a
                    ref={bookmarkletRef}
                    onClick={(e) => {
                      e.preventDefault();
                      alert("Drag this button up to your Chrome Bookmarks Bar! Then click it whenever you're on any webpage you want to summarize.");
                    }}
                    draggable={true}
                    className="py-2.5 px-5 rounded-full bg-gradient-to-r from-primary via-secondary to-primary text-black font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-[0_0_25px_rgba(221,183,255,0.4)] hover:scale-105 transition-transform cursor-grab active:cursor-grabbing select-none"
                    title="Drag me to your Chrome Bookmarks Bar!"
                  >
                    <span className="material-symbols-outlined text-[17px]">auto_awesome</span>
                    <span>⚡ Summarize with OmniLogic</span>
                  </a>
                </div>
              </div>

              {/* Optional Collapsible Section for Developers who want the Unpacked Extension */}
              <div className="pt-1 border-t border-white/10">
                <button
                  onClick={() => setShowDevOptions(!showDevOptions)}
                  className="w-full flex items-center justify-between text-[11px] font-mono text-on-surface-variant/70 hover:text-white py-1 cursor-pointer"
                >
                  <span>Advanced: Want the standalone Chrome Side-Popup (.zip)?</span>
                  <span className="material-symbols-outlined text-[16px]">
                    {showDevOptions ? "expand_less" : "expand_more"}
                  </span>
                </button>

                {showDevOptions && (
                  <div className="mt-2.5 p-3.5 rounded-xl bg-black/60 border border-white/10 space-y-2.5 text-xs text-on-surface-variant">
                    <div className="flex items-center justify-between gap-2">
                      <span>1. Download & unzip the extension package:</span>
                      <button
                        onClick={handleDownloadZip}
                        className="px-3 py-1.5 rounded-lg bg-secondary/20 hover:bg-secondary/30 border border-secondary/40 text-secondary font-mono text-[11px] font-bold cursor-pointer"
                      >
                        ⬇ Download .ZIP
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>2. Open Chrome Extensions & enable Developer Mode:</span>
                      <button
                        onClick={handleCopyExtensionsUrl}
                        className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/15 text-white font-mono text-[11px] cursor-pointer"
                      >
                        {copiedUrl ? "✓ Copied!" : "Copy chrome://extensions"}
                      </button>
                    </div>
                    <p>3. Click <strong className="text-white">Load unpacked</strong> and select the unzipped folder.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
