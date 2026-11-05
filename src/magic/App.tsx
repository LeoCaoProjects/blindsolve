import {
  GlobalNavigationShell,
  hasGlobalNavigation,
} from "./components/layout/GlobalNavigation";
import { SubNavFrame } from "./components/layout/SubNavigation";
import { RouteMetadata } from "../seo/RouteMetadata";
import React, { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AppDataProvider } from "./contexts/AppDataContext";
import { Flashcards } from "./pages/Flashcards";
import { LetterPairs } from "./pages/LetterPairs";
import { Settings } from "./pages/Settings";
import { Setup } from "./pages/Setup";
import { SignIn } from "./pages/SignIn";
import { Timer } from "./pages/Timer";
import { Training } from "./pages/Training";
import { warmScrambles } from "./utils/randomStateScramble";
import { FeedbackInbox } from "./pages/FeedbackInbox";
import { recordPage } from "./utils/feedbackContext";
import { SessionWorkspaceProvider } from "./contexts/SessionWorkspaceContext";

function RouteFrame({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const hasNavigation = hasGlobalNavigation(pathname);
  return (
    <div
      className={`h-full min-w-0 ${hasNavigation ? "pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0 md:pl-[72px]" : ""}`}
    >
      <SubNavFrame>{children}</SubNavFrame>
    </div>
  );
}

function PageTracker() {
  const { pathname } = useLocation();
  useEffect(() => recordPage(pathname), [pathname]);
  return null;
}

type PreviewStage =
  "live" | "running" | "stopped" | "reconstruction" | "details";

interface AppProps {
  /** Jump the Timer straight to a state for review. "live" is fully interactive. */
  stage?: PreviewStage;
}

export function App({ stage = "live" }: AppProps) {
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
                    <Route path="/" element={<Timer stage={stage} />} />
                    <Route
                      path="/about"
                      element={<Navigate to="/" replace />}
                    />
                    <Route path="/pairs" element={<LetterPairs />} />
                    <Route path="/flashcards" element={<Flashcards />} />
                    <Route path="/training" element={<Training />} />
                    <Route
                      path="/memo"
                      element={<Navigate to="/training" replace />}
                    />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/setup" element={<Setup />} />
                    <Route path="/signin" element={<SignIn />} />
                    <Route path="/admin/feedback" element={<FeedbackInbox />} />
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
