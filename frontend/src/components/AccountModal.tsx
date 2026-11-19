"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_HOSTS } from "@/lib/api";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

export const AccountModal = ({ isOpen, onClose, onNavigateTab }: AccountModalProps) => {
  const [operatorName, setOperatorName] = useState("Lead AI Architect");
  const [operatorRole, setOperatorRole] = useState("OmniLogic Principal Operator");
  const [isEditing, setIsEditing] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [stats, setStats] = useState({
    datasetSize: 8,
    trainerStatus: "completed",
    backendOnline: true,
  });

  useEffect(() => {
    if (!isOpen) return;
    const savedName = localStorage.getItem("omnilogic_operator_name");
    const savedRole = localStorage.getItem("omnilogic_operator_role");
    if (savedName) setOperatorName(savedName);
    if (savedRole) setOperatorRole(savedRole);

    const fetchStats = async () => {
      for (const host of API_HOSTS) {
        try {
          const res = await fetch(`${host}/api/v1/health`);
          if (res.ok) {
            const data = await res.json();
            setStats({
              datasetSize: data.dataset_size ?? 8,
              trainerStatus: data.trainer_status ?? "completed",
              backendOnline: true,
            });
            return;
          }
        } catch (_) {}
      }
      setStats((prev) => ({ ...prev, backendOnline: false }));
    };
    fetchStats();
  }, [isOpen]);

  const handleSaveProfile = () => {
    localStorage.setItem("omnilogic_operator_name", operatorName);
    localStorage.setItem("omnilogic_operator_role", operatorRole);
    setIsEditing(false);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
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
          className="relative z-10 w-full max-w-lg obsidian-panel glass-pane rounded-2xl p-6 border border-white/20 shadow-2xl space-y-5"
        >
          {/* Header */}
          <div className="flex justify-between items-center border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">account_circle</span>
              <h2 className="text-base sm:text-lg font-bold text-white">Operator Profile & Workspace Account</h2>
            </div>
            <button
              onClick={onClose}
              className="text-on-surface-variant hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Profile Identity Card */}
          <div className="p-4 bg-black/60 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary/30 to-secondary/30 border border-primary/40 flex items-center justify-center shadow-[0_0_25px_rgba(221,183,255,0.25)] flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-3xl">shield_person</span>
              </div>
              <div>
                {isEditing ? (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={operatorName}
                      onChange={(e) => setOperatorName(e.target.value)}
                      className="bg-[#111111] border border-primary/40 rounded-lg px-2.5 py-1 text-xs text-white outline-none w-full"
                      placeholder="Operator Name"
                    />
                    <input
                      type="text"
                      value={operatorRole}
                      onChange={(e) => setOperatorRole(e.target.value)}
                      className="bg-[#111111] border border-white/15 rounded-lg px-2.5 py-1 text-[11px] text-on-surface-variant outline-none w-full"
                      placeholder="Operator Role"
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">{operatorName}</h3>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-primary">
                        Pro Tier
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5">{operatorRole}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          stats.backendOnline ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                        }`}
                      ></span>
                      <span className="text-[10px] font-mono text-emerald-400">
                        {stats.backendOnline ? "Authenticated • Local & Cloud Sync Active" : "Local Workspace Mode"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {isEditing ? (
              <button
                onClick={handleSaveProfile}
                className="ghost-glow-btn text-xs font-bold uppercase py-1.5 px-3 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[15px]">check</span>
                Save
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="slate-glass-btn text-xs font-mono py-1.5 px-3 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">edit</span>
                Edit Profile
              </button>
            )}
          </div>

          {savedNotice && (
            <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">verified</span>
              Operator profile updated and persisted to workspace.
            </div>
          )}

          {/* Account Telemetry & Training Stats */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 bg-black/50 rounded-xl border border-white/10 text-center">
              <span className="text-[10px] font-mono uppercase text-on-surface-variant/60 block">
                Trained Shards
              </span>
              <span className="text-lg font-bold font-mono text-secondary mt-0.5 block">
                {stats.datasetSize}
              </span>
            </div>
            <div className="p-3 bg-black/50 rounded-xl border border-white/10 text-center">
              <span className="text-[10px] font-mono uppercase text-on-surface-variant/60 block">
                Model Status
              </span>
              <span className="text-xs font-bold font-mono text-emerald-400 uppercase mt-1.5 block">
                {stats.trainerStatus}
              </span>
            </div>
            <div className="p-3 bg-black/50 rounded-xl border border-white/10 text-center">
              <span className="text-[10px] font-mono uppercase text-on-surface-variant/60 block">
                Extension Bridge
              </span>
              <span className="text-xs font-bold font-mono text-primary mt-1.5 block">
                Manifest V3
              </span>
            </div>
          </div>

          {/* Quick Account Shortcuts */}
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant/60 block">
              Quick Workspace Actions
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => {
                  if (onNavigateTab) onNavigateTab("train");
                  onClose();
                }}
                className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-left flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-primary text-[18px]">model_training</span>
                <div>
                  <div className="text-xs font-semibold text-white">AI Training Lab</div>
                  <div className="text-[10px] text-on-surface-variant/60">Manage topics & exemplars</div>
                </div>
              </button>

              <button
                onClick={() => {
                  if (onNavigateTab) onNavigateTab("archive");
                  onClose();
                }}
                className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-left flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-secondary text-[18px]">history</span>
                <div>
                  <div className="text-xs font-semibold text-white">Session History</div>
                  <div className="text-[10px] text-on-surface-variant/60">View archived missions</div>
                </div>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end pt-2 border-t border-white/10">
            <button onClick={onClose} className="ghost-glow-btn text-xs font-bold uppercase py-2 px-5">
              Close Profile
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
