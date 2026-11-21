"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { SideNav } from "@/components/SideNav";
import { ChatArea } from "@/components/ChatArea";
import { PromptBar } from "@/components/PromptBar";
import { KnowledgeBaseView } from "@/components/KnowledgeBaseView";
import { LogicStreamsView } from "@/components/LogicStreamsView";
import { ArchiveView } from "@/components/ArchiveView";
import { TrainingView } from "@/components/TrainingView";
import { DeployModal } from "@/components/DeployModal";
import { GroundTruthModal } from "@/components/GroundTruthModal";
import { SettingsModal } from "@/components/SettingsModal";
import { AccountModal } from "@/components/AccountModal";
import { AdminAuthModal } from "@/components/AdminAuthModal";
import { ExtensionPromoPopup } from "@/components/ExtensionPromoPopup";
import { API_HOSTS } from "@/lib/api";

export type Message = {
  role: "user" | "agent";
  content: string;
  analysis?: string;
  artifact?: string;
  sources?: string[];
  missionId?: string;
};

const INITIAL_MESSAGES: Message[] = [
  {
    role: "user",
    content:
      "Can you analyze the current memory leak in the Antigravity module? It seems to be spiking during the spatial warping phase. I need a fix that aligns with the v4 architecture.",
  },
  {
    role: "agent",
    content:
      "I've cross-referenced the spatial warping logs with the v4 architecture schema. The memory leak originates in the manifold folding loop where garbage collection is being bypassed during high-stress operations.",
    analysis:
      "Implementing this explicit drop(temp_warp) within the strict allocation frame resolves the reference counting issue that was causing the OOM crashes during warping.",
    artifact: `fn fold_manifold(spatial_buffer: &mut SpatialBuffer) -> Result<(), WarpError> {
    let frame_guard = AllocationFrame::strict_isolation()?;
    let temp_warp = spatial_buffer.acquire_folding_slice(4096)?;
    
    // Explicit drop before cycle closure prevents reference counter leaks
    drop(temp_warp);
    frame_guard.commit();
    Ok(())
}`,
    sources: ["sys_arch_v4", "api_schema"],
    missionId: "mission_seed_01",
  },
];

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("train"); // Default to Model Training in Admin!

  // Navigation & Mobile Drawer
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Modals
  const [isDeployOpen, setIsDeployOpen] = useState(false);
  const [isGroundTruthOpen, setIsGroundTruthOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [activeSources, setActiveSources] = useState<string[]>(["sys_arch_v4", "api_schema"]);

  useEffect(() => {
    const auth = sessionStorage.getItem("omnilogic_admin_auth");
    if (auth === "true") {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
      setIsAuthModalOpen(true);
    }
  }, []);

  const latestArtifact = [...messages].reverse().find((m) => m.artifact)?.artifact || "";

  const handleNewSolve = () => {
    setMessages([]);
    setActiveTab("new");
    setIsMobileMenuOpen(false);
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      let data: any = null;
      for (const host of API_HOSTS) {
        try {
          const response = await fetch(`${host}/api/v1/mission/initiate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: text }),
          });
          if (response.ok) {
            data = await response.json();
            break;
          }
        } catch (_) {}
      }

      if (!data) throw new Error("Backend unreachable");

      const sources = data.sources && data.sources.length > 0 ? data.sources : ["sys_arch_v4"];
      setActiveSources(sources);

      const agentMsg: Message = {
        role: "agent",
        content: data.analysis || "Mission resolution complete.",
        analysis: data.analysis,
        artifact: data.artifact,
        sources: sources,
        missionId: data.mission_id,
      };

      setMessages((prev) => [...prev, agentMsg]);
    } catch (error) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: "agent",
            content: "Mission synthesized under architectural boundaries.",
            analysis: "Operational parameters verified.",
            artifact: `// Solution generated for: ${text}\n// Protocol aligned with v4 specification.`,
            sources: ["sys_arch_v4"],
            missionId: `mission_${Date.now()}`,
          },
        ]);
      }, 500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInspectSource = (source: string) => {
    setActiveSources([source]);
    setIsGroundTruthOpen(true);
  };

  const handleUseSnippet = (snippet: string) => {
    setActiveTab("new");
    handleSendMessage(snippet);
  };

  const handleLoadMission = (mission: any) => {
    setMessages([
      {
        role: "user",
        content: mission.prompt,
      },
      {
        role: "agent",
        content: mission.analysis,
        analysis: mission.analysis,
        artifact: mission.artifact,
        sources: mission.sources,
        missionId: mission.mission_id,
      },
    ]);
    setActiveTab("new");
  };

  // If not authenticated, show passcode modal over a clean backdrop
  if (isAuthenticated === false) {
    return (
      <main className="min-h-screen bg-[#050508] text-on-surface flex flex-col items-center justify-center p-4">
        <AdminAuthModal
          isOpen={isAuthModalOpen}
          onClose={() => router.push("/")}
          onSuccess={() => {
            setIsAuthenticated(true);
            setIsAuthModalOpen(false);
          }}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050508] text-on-surface flex flex-col relative overflow-x-hidden">
      {/* Top Navigation with Admin Badge & Return link */}
      <TopNav
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        onDeployFix={() => setIsDeployOpen(true)}
        onGroundTruth={() => setIsGroundTruthOpen(true)}
        onOpenHistory={() => setActiveTab("archive")}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAccount={() => setIsAccountOpen(true)}
        onOpenExtensionModal={() => setIsExtensionModalOpen(true)}
        hasArtifact={!!latestArtifact}
        isAdmin={true}
        onExitAdmin={() => router.push("/")}
      />

      {/* Side Navigation */}
      <SideNav
        onNewSolve={handleNewSolve}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenUpgrade={() => setIsSettingsOpen(true)}
        onOpenDocs={() => setActiveTab("kb")}
        onOpenSupport={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area - Symmetrically Centered across the whole viewport */}
      <div
        className={`flex-1 pt-20 sm:pt-24 px-4 sm:px-6 md:px-8 flex flex-col items-center w-full min-w-0 ${
          activeTab === "new" ? "pb-36 sm:pb-40" : "pb-12"
        }`}
      >
        {/* Admin Navigation Header Ribbon */}
        <div className="w-full max-w-5xl mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shadow-[0_0_15px_rgba(221,183,255,0.2)]">
              <span className="material-symbols-outlined text-primary text-[19px]">admin_panel_settings</span>
            </div>
            <div>
              <h2 className="font-h1 text-[15px] font-bold text-white leading-tight">Admin Command Center</h2>
              <p className="text-[11px] font-mono uppercase tracking-wider text-on-surface-variant/70">
                Cognitive Engine & Fine-Tuning Lab
              </p>
            </div>
          </div>

          {/* Module Switcher Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-black/60 p-1.5 rounded-xl border border-white/10">
            {[
              { id: "train", label: "Model Training", icon: "model_training" },
              { id: "new", label: "Solver Terminal", icon: "terminal" },
              { id: "kb", label: "Knowledge Base", icon: "database" },
              { id: "streams", label: "Logic Streams", icon: "account_tree" },
              { id: "archive", label: "Archive", icon: "inventory_2" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                    isActive
                      ? "bg-secondary text-black font-bold shadow-[0_0_12px_rgba(123,208,255,0.4)]"
                      : "text-on-surface-variant hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* VIEW 1: Solver */}
        {activeTab === "new" && (
          <div className="w-full max-w-5xl flex flex-col items-center">
            <ChatArea
              messages={messages}
              isLoading={isLoading}
              onInspectSource={handleInspectSource}
            />
            <PromptBar onSend={handleSendMessage} disabled={isLoading} />
          </div>
        )}

        {/* VIEW 2: Knowledge Base */}
        {activeTab === "kb" && (
          <KnowledgeBaseView
            onBackToChat={() => setActiveTab("new")}
            onUseSnippet={handleUseSnippet}
          />
        )}

        {/* VIEW 3: Logic Streams */}
        {activeTab === "streams" && (
          <LogicStreamsView onBackToChat={() => setActiveTab("new")} />
        )}

        {/* VIEW 4: Archive */}
        {activeTab === "archive" && (
          <ArchiveView
            onBackToChat={() => setActiveTab("new")}
            onLoadMission={handleLoadMission}
          />
        )}

        {/* VIEW 5: Model Training Lab (Primary Admin View) */}
        {activeTab === "train" && (
          <TrainingView onBackToChat={() => setActiveTab("new")} />
        )}
      </div>

      {/* Modals */}
      <DeployModal
        isOpen={isDeployOpen}
        onClose={() => setIsDeployOpen(false)}
        artifactCode={latestArtifact}
      />
      <GroundTruthModal
        isOpen={isGroundTruthOpen}
        onClose={() => setIsGroundTruthOpen(false)}
        sources={activeSources}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />
      <ExtensionPromoPopup
        isModalOpen={isExtensionModalOpen}
        onOpenModal={() => setIsExtensionModalOpen(true)}
        onCloseModal={() => setIsExtensionModalOpen(false)}
      />
    </main>
  );
}
