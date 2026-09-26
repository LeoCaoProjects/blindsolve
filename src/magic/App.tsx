import React from 'react';
import { MotionConfig } from 'framer-motion';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppDataProvider } from './contexts/AppDataContext';
import { Flashcards } from './pages/Flashcards';
import { LetterPairs } from './pages/LetterPairs';
import { Settings } from './pages/Settings';
import { Setup } from './pages/Setup';
import { SignIn } from './pages/SignIn';
import { Timer } from './pages/Timer';
import { Training } from './pages/Training';
import { useStore } from '../app/Store';

type PreviewStage = 'live' | 'running' | 'stopped' | 'reconstruction' | 'details';

interface AppProps {
  /** Jump the Timer straight to a state for review. "live" is fully interactive. */
  stage?: PreviewStage;
}

export function App({ stage = 'live' }: AppProps) {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AppDataProvider>
          <div className="theme-workspace min-h-[100dvh] w-full overflow-x-hidden bg-bg">
            <ProductionRoutes stage={stage} />
          </div>
        </AppDataProvider>
      </BrowserRouter>
    </MotionConfig>);
}

function ProductionRoutes({ stage }: {stage: PreviewStage}) {
  const { ready, data } = useStore();
  if (!ready) return <p className="flex h-full items-center justify-center text-[13px] text-ink-3" role="status">Loading your workspace…</p>;
  return (
            <Routes>
              <Route path="/" element={data.onboarded ? <Timer stage={stage} /> : <Navigate to="/setup" replace />} />
              <Route path="/pairs" element={<LetterPairs />} />
              <Route path="/flashcards" element={<Flashcards />} />
              <Route path="/training" element={<Training />} />
              <Route path="/memo" element={<Navigate to="/training" replace />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
  );
}
