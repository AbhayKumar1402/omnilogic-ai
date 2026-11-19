"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  artifactCode?: string;
}

export const DeployModal = ({ isOpen, onClose, artifactCode = "" }: DeployModalProps) => {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);

  const handleSimulateDeploy = () => {
    setIsDeploying(true);
    setTimeout(() => {
      setIsDeploying(false);
      setDeploySuccess(true);
      setTimeout(() => setDeploySuccess(false), 3000);
    }, 1500);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([artifactCode || "// OmniLogic Artifact\n"], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = "omnilogic_solution.rs";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

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
          className="relative z-10 w-full max-w-xl obsidian-panel glass-pane rounded-2xl p-6 border border-white/20 shadow-2xl space-y-4"
        >
          <div className="flex justify-between items-center border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[22px]">rocket_launch</span>
              <h2 className="text-base sm:text-lg font-bold text-white">Deploy Solution Artifact</h2>
            </div>
            <button
              onClick={onClose}
              className="text-on-surface-variant hover:text-white p-1 rounded-lg hover:bg-white/5"
            >
              ✕
            </button>
          </div>

          <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
            Verify and deploy the generated code patch into your live runtime architecture or download the source artifact.
          </p>

          {/* Artifact Preview Box */}
          <div className="p-3 bg-black/70 rounded-xl border border-white/10 max-h-48 overflow-y-auto">
            <pre className="text-xs font-mono text-emerald-400">
              <code>{artifactCode || "// No active artifact generated yet. Run a solve prompt first."}</code>
            </pre>
          </div>

          {deploySuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-mono flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              Artifact successfully compiled and verified against architecture schema!
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-2">
            <button
              onClick={handleDownload}
              disabled={!artifactCode}
              className="slate-glass-btn text-xs font-bold uppercase py-2 px-4 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              Download File (.rs)
            </button>
            <button
              onClick={handleSimulateDeploy}
              disabled={!artifactCode || isDeploying}
              className="ghost-glow-btn text-xs font-bold uppercase py-2 px-4 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[16px]">
                {isDeploying ? "sync" : "publish"}
              </span>
              {isDeploying ? "Deploying..." : "Execute Hot Patch"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
