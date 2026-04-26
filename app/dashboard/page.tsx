"use client";

import { useEffect, useState } from "react";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, Settings, Terminal as TerminalIcon, Webhook } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { Terminal } from "@/components/terminal";
import { RunsView } from "@/components/runs-view";
import { SettingsView } from "@/components/settings-view";
import { WebhookView } from "@/components/webhook-view";
import { AIPanel } from "@/components/ai-panel";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { AddRepoDialog } from "@/components/add-repo-dialog";
import { CurrentRunSubheader } from "@/components/current-run-subheader";
import { useUIStore } from "@/lib/store/ui-store";
import { useSettingsStore } from "@/lib/store/settings-store";
import { useRepoStore } from "@/lib/store/repo-store";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const aiPanelOpen = useUIStore((s) => s.aiPanelOpen);
  const aiPinned = useUIStore((s) => s.aiPinned);
  const activeTab = useUIStore((s) => s.activeTab);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const panelSizes = useUIStore((s) => s.panelSizes);
  const setPanelSizes = useUIStore((s) => s.setPanelSizes);
  const setAIPanelOpen = useUIStore((s) => s.setAIPanelOpen);

  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete);
  const repos = useRepoStore((s) => s.repos);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (!hydrated) return;
    if (!onboardingComplete && repos.length === 0) setShowOnboarding(true);
  }, [hydrated, onboardingComplete, repos.length]);

  const [addRepoOpen, setAddRepoOpen] = useState(false);

  const showAI = aiPanelOpen || aiPinned;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <Navbar />
      <CurrentRunSubheader />

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <PanelGroup
          direction="horizontal"
          autoSaveId="deviewer.layout"
          onLayout={(sizes) => {
            if (sizes.length === 3) {
              setPanelSizes({ sidebar: sizes[0], main: sizes[1], ai: sizes[2] });
            } else if (sizes.length === 2) {
              setPanelSizes({ sidebar: sizes[0], main: sizes[1], ai: panelSizes.ai });
            }
          }}
          className="hidden h-full md:flex"
        >
          {sidebarOpen && (
            <>
              <Panel
                defaultSize={panelSizes.sidebar}
                minSize={14}
                maxSize={28}
                className="border-r border-border"
              >
                <Sidebar onOpenAddRepo={() => setAddRepoOpen(true)} />
              </Panel>
              <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-primary/40 data-[resize-handle-state=drag]:bg-primary" />
            </>
          )}
          <Panel defaultSize={panelSizes.main} minSize={30}>
            <MainArea activeTab={activeTab} setActiveTab={setActiveTab} />
          </Panel>
          {showAI && (
            <>
              <PanelResizeHandle className="w-px bg-border transition-colors hover:bg-primary/40 data-[resize-handle-state=drag]:bg-primary" />
              <Panel defaultSize={panelSizes.ai} minSize={20} maxSize={40}>
                <AIPanel />
              </Panel>
            </>
          )}
        </PanelGroup>

        {/* Mobile layout */}
        <div className="flex h-full flex-col md:hidden">
          <MainArea activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        <MobileSidebar onOpenAddRepo={() => setAddRepoOpen(true)} />

        {/* Mobile: AI panel as bottom sheet */}
        <Sheet open={showAI} onOpenChange={(o) => !o && setAIPanelOpen(false)}>
          <SheetContent
            side="bottom"
            className={cn(
              "h-[80vh] p-0 md:hidden",
              "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            )}
          >
            <AIPanel embedded />
          </SheetContent>
        </Sheet>
      </div>

      <OnboardingWizard
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
      <AddRepoDialog open={addRepoOpen} onClose={() => setAddRepoOpen(false)} />
    </div>
  );
}

function MainArea({
  activeTab,
  setActiveTab,
}: {
  activeTab: ReturnType<typeof useUIStore.getState>["activeTab"];
  setActiveTab: ReturnType<typeof useUIStore.getState>["setActiveTab"];
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        className="flex h-full min-h-0 flex-col"
      >
        <div className="shrink-0 border-b border-border bg-card/40 px-3 py-2">
          <TabsList className="bg-transparent">
            <TabsTrigger value="console">
              <TerminalIcon />
              Console
            </TabsTrigger>
            <TabsTrigger value="runs">
              <GitBranch />
              Runs
            </TabsTrigger>
            <TabsTrigger value="webhook">
              <Webhook />
              Webhook
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="flex flex-1 min-h-0 flex-col overflow-hidden"
          >
            <TabsContent
              value="console"
              forceMount
              hidden={activeTab !== "console"}
              className="flex flex-1 min-h-0 flex-col overflow-hidden p-3 md:p-4"
            >
              <Terminal />
            </TabsContent>
            <TabsContent
              value="runs"
              forceMount
              hidden={activeTab !== "runs"}
              className="flex flex-1 min-h-0 flex-col overflow-hidden p-3 md:p-4"
            >
              <RunsView />
            </TabsContent>
            <TabsContent
              value="webhook"
              forceMount
              hidden={activeTab !== "webhook"}
              className="flex-1 overflow-y-auto p-3 md:p-6"
            >
              <WebhookView />
            </TabsContent>
            <TabsContent
              value="settings"
              forceMount
              hidden={activeTab !== "settings"}
              className="flex-1 overflow-y-auto p-3 md:p-6"
            >
              <SettingsView />
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>
    </div>
  );
}
