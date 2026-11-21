"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { UserSummarizerView } from "@/components/UserSummarizerView";
import { AdminAuthModal } from "@/components/AdminAuthModal";
import { SettingsModal } from "@/components/SettingsModal";
import { AccountModal } from "@/components/AccountModal";
import { ExtensionPromoPopup } from "@/components/ExtensionPromoPopup";

export type Message = {
  role: "user" | "agent";
  content: string;
  analysis?: string;
  artifact?: string;
  sources?: string[];
  missionId?: string;
};

export default function Home() {
  const router = useRouter();
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#050508] text-on-surface flex flex-col relative overflow-x-hidden">
      {/* Top Navigation - Clean & Professional for Normal Users */}
      <TopNav
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAccount={() => setIsAccountOpen(true)}
        onOpenExtensionModal={() => setIsExtensionModalOpen(true)}
        isAdmin={false}
      />

      {/* Main Content Area - Full-Featured User Document & Live URL Summarizer */}
      <div className="flex-1 pt-24 sm:pt-28 pb-16 px-4 sm:px-6 md:px-8 flex flex-col items-center w-full min-w-0">
        <UserSummarizerView onOpenAdminLogin={() => setIsAdminAuthOpen(true)} />
      </div>

      {/* Floating Chrome Extension Notification Popup & Installation Guide Modal */}
      <ExtensionPromoPopup
        isModalOpen={isExtensionModalOpen}
        onOpenModal={() => setIsExtensionModalOpen(true)}
        onCloseModal={() => setIsExtensionModalOpen(false)}
      />

      {/* Admin Passcode Modal (only pops up if someone clicks Administrator Portal) */}
      <AdminAuthModal
        isOpen={isAdminAuthOpen}
        onClose={() => setIsAdminAuthOpen(false)}
        onSuccess={() => {
          setIsAdminAuthOpen(false);
          router.push("/admin");
        }}
      />

      {/* User Settings & Account Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
      />
    </main>
  );
}
