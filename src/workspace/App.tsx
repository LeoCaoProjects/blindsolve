import {
  GlobalNavigationShell,
  hasGlobalNavigation,
} from "./components/layout/GlobalNavigation";
import { SessionWorkspaceFrame } from "./components/workspace/SessionWorkspaceFrame";
import { RouteMetadata } from "../seo/RouteMetadata";
import React, { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useWorkspaceLocation } from "./navigation/workspaces";
import { AppDataProvider } from "./contexts/AppDataContext";
import { Flashcards } from "./pages/Flashcards";
import { LetterPairs } from "./pages/LetterPairs";
import { Settings } from "./pages/Settings";
import { SignIn } from "./pages/SignIn";
import { Timer } from "./pages/Timer";
import { Training } from "./pages/Training";
import { warmScrambles } from "./utils/randomStateScramble";
import { FeedbackInbox } from "./pages/FeedbackInbox";
import { recordPage } from "./utils/feedbackContext";
import { SessionWorkspaceProvider } from "./contexts/SessionWorkspaceContext";
import { useStore } from "../app/Store";

function RouteFrame({ children }: { children: React.ReactNode }) {
  const { pathname } = useWorkspaceLocation();
  const hasNavigation = hasGlobalNavigation(pathname);
  return (
    <div
      className={`h-full min-w-0 ${hasNavigation ? "pb-[calc(56px+env(safe-area-inset-bottom))] vp-md:pb-0 vp-md:pl-[72px]" : ""}`}
    >
      <SessionWorkspaceFrame>{children}</SessionWorkspaceFrame>
    </div>
  );
}

function WorkspacePage() {
  const { pathname } = useWorkspaceLocation();
  if (pathname === "/training") return <Training />;
  if (pathname === "/pairs") return <LetterPairs />;
  if (pathname === "/flashcards") return <Flashcards />;
  return <Timer />;
}

function PageTracker() {
  const { pathname } = useWorkspaceLocation();
  useEffect(() => recordPage(pathname), [pathname]);
  return null;
}

type PreviewStage =
  "live" | "running" | "stopped" | "reconstruction" | "details";

interface AppProps {
  /** Jump the Timer straight to a state for review. "live" is fully interactive. */
  stage?: PreviewStage;
}

function LegacyWorkspace({ workspace }: { workspace: string }) {
  const { search, hash } = useWorkspaceLocation();
  return (
    <Navigate
      to={{ pathname: "/", search, hash }}
      replace
      state={{ workspace }}
    />
  );
}

export function App({ stage = "live" }: AppProps) {
  const { recoveredId } = useStore();
  // Prepare Execution Sprint scrambles in the background as soon as the browser is idle.
  useEffect(() => warmScrambles(), []);
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AppDataProvider>
          <SessionWorkspaceProvider stage={stage}>
            <div className="theme-workspace h-[100dvh] w-full bg-bg">
              <PageTracker />
              <RouteMetadata />
              <GlobalNavigationShell>
                <RouteFrame>
                  <Routes>
                    <Route path="/" element={<WorkspacePage />} />
                    <Route
                      path="/about"
                      element={<Navigate to="/" replace />}
                    />
                    <Route
                      path="/pairs"
                      element={<LegacyWorkspace workspace="/pairs" />}
                    />
                    <Route
                      path="/flashcards"
                      element={<LegacyWorkspace workspace="/flashcards" />}
                    />
                    <Route
                      path="/training"
                      element={<LegacyWorkspace workspace="/training" />}
                    />
                    <Route
                      path="/memo"
                      element={<LegacyWorkspace workspace="/training" />}
                    />
                    <Route path="/settings" element={<Settings />} />
                    <Route
                      path="/setup"
                      element={<Navigate to="/settings" replace />}
                    />
                    <Route path="/signin" element={recoveredId ? <Navigate to="/settings" replace /> : <SignIn />} />
                    <Route path="/admin/feedback" element={recoveredId ? <Navigate to="/settings" replace /> : <FeedbackInbox />} />
                    <Route
                      path="*"
                      element={
                        <main className="p-8">
                          <h1>Page not found</h1>
                          <a href="/">Return to the BlindSolve timer</a>
                        </main>
                      }
                    />
                  </Routes>
                </RouteFrame>
              </GlobalNavigationShell>
            </div>
          </SessionWorkspaceProvider>
        </AppDataProvider>
      </BrowserRouter>
    </MotionConfig>
  );
}
