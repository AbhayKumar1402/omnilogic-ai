"use client";

import React, { useState } from "react";

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminAuthModal = ({ isOpen, onClose, onSuccess }: AdminAuthModalProps) => {
  const [passkey, setPasskey] = useState("");
  const [error, setError] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Default admin passkey: omnilogic2026 or admin
    if (passkey.trim() === "omnilogic2026" || passkey.trim() === "admin") {
      sessionStorage.setItem("omnilogic_admin_auth", "true");
      setError(false);
      setPasskey("");
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm rounded-2xl bg-[#09090b] border border-white/15 p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[20px]">lock</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Administrator Access</h3>
            <p className="text-xs text-on-surface-variant">Model training, datasets & system controls</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant block mb-1">
              Admin Passkey
            </label>
            <input
              type="password"
              autoFocus
              placeholder="Enter admin passkey..."
              value={passkey}
              onChange={(e) => {
                setPasskey(e.target.value);
                setError(false);
              }}
              className="w-full bg-black/60 border border-white/15 focus:border-primary rounded-xl px-3 py-2 text-sm text-white outline-none transition-colors"
            />
            {error && (
              <p className="text-[11px] text-red-400 mt-1 font-mono">
                Incorrect passkey. (Default: omnilogic2026)
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-on-surface-variant hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ghost-glow-btn text-xs font-bold uppercase py-1.5 px-4"
            >
              Verify & Enter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
