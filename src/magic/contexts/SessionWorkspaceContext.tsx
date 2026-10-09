import React, { createContext, useContext, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { TrainMode } from "../data/trainingModes";
import {
  TrainInit,
  TrainingSession,
  useTrainingSession,
} from "../hooks/useTrainingSession";
import {
  TimerSession,
  useTimerSession,
} from "../hooks/useTimerSession";
import { DemoStage } from "../types/solve";
import { useScreenInit } from "../useScreenInit.js";
import { useAppData } from "./AppDataContext";

interface SessionWorkspaceValue {
  timer: TimerSession;
  training: TrainingSession;
}

const SessionWorkspaceContext = createContext<SessionWorkspaceValue | null>(
  null,
);

/**
 * Browser-session workspace state lives above route elements so navigating within
 * BlindSolve cannot create a new scramble or discard an in-progress attempt.
 * Nothing in this provider is part of the persisted/Supabase workspace.
 */
export function SessionWorkspaceProvider({
  children,
  stage,
}: {
  children: React.ReactNode;
  stage: DemoStage;
}) {
  const { pathname } = useLocation();
  const init = useScreenInit() as TrainInit & {
    sessions?: "open" | "confirm";
    stage?: DemoStage;
  };
  const { prefs } = useAppData();
  const trainingActive = pathname === "/training" || pathname === "/memo";
  const [mode, setMode] = useState<TrainMode>(init.mode ?? "exec");
  const initFor = (candidate: TrainMode): TrainInit =>
    mode === candidate
      ? { ...init, mode: candidate }
      : { mode: candidate };

  const exec = useTrainingSession(
    initFor("exec"),
    trainingActive && mode === "exec",
  );
  const guided = useTrainingSession(
    initFor("guided"),
    trainingActive && mode === "guided",
  );
  const recall = useTrainingSession(
    initFor("recall"),
    trainingActive && mode === "recall",
  );
  const trace = useTrainingSession(
    initFor("trace"),
    trainingActive && mode === "trace",
  );
  const sessions = { exec, guided, recall, trace };
  const selected = sessions[mode];
  const training = useMemo(
    () => ({ ...selected, mode, setMode }) as TrainingSession,
    [selected, mode],
  );

  const timer = useTimerSession({
    multiphase: prefs.multiphase,
    stage: init.stage ?? stage,
    initialSessionsOpen: !!init.sessions,
    active: pathname === "/",
  });

  return (
    <SessionWorkspaceContext.Provider value={{ timer, training }}>
      {children}
    </SessionWorkspaceContext.Provider>
  );
}

export function useSessionWorkspace() {
  const value = useContext(SessionWorkspaceContext);
  if (!value)
    throw new Error("useSessionWorkspace must be used inside its provider");
  return value;
}
