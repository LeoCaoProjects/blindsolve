import React, { createContext, useContext, useMemo, useState } from "react";
import { useWorkspaceLocation } from "../navigation/workspaces";
import { TrainMode } from "../data/trainingModes";
import {
  TrainInit,
  TrainingSession,
  useTrainingSession,
} from "../hooks/useTrainingSession";
import { TimerSession, useTimerSession } from "../hooks/useTimerSession";
import { DemoStage } from "../types/solve";
import { TrainFilter } from "../utils/bld";
import { useScreenInit } from "../useScreenInit.js";
import { useAppData } from "./AppDataContext";
import { useStore } from "../../app/Store";
import { useFlashcards } from "../hooks/useFlashcards";

interface SessionWorkspaceValue {
  timer: TimerSession;
  training: TrainingSession;
  flashcards: ReturnType<typeof useFlashcards>;
}

const SessionWorkspaceContext = createContext<SessionWorkspaceValue | null>(
  null,
);

/**
 * Browser-session workspace state lives above route elements so navigating within
 * BlindSolve cannot create a new scramble or discard an in-progress attempt.
 * Nothing in this provider is part of the persisted/Supabase workspace.
 */
export function SessionWorkspaceProvider(props: {
  children: React.ReactNode;
  stage: DemoStage;
}) {
  const { user } = useStore();
  return <OwnerWorkspace key={user?.id ?? "guest"} {...props} />;
}

function OwnerWorkspace({
  children,
  stage,
}: {
  children: React.ReactNode;
  stage: DemoStage;
}) {
  const { pathname } = useWorkspaceLocation();
  const init = useScreenInit() as TrainInit & {
    sessions?: "open" | "confirm";
    stage?: DemoStage;
  };
  const { prefs } = useAppData();
  const trainingActive = pathname === "/training" || pathname === "/memo";
  const [mode, setMode] = useState<TrainMode>(init.mode ?? "exec");
  const [trainingScope, setTrainingScope] = useState<TrainFilter>(
    init.filter ?? "both",
  );
  const initFor = (candidate: TrainMode): TrainInit =>
    mode === candidate
      ? { ...init, mode: candidate, filter: trainingScope }
      : { mode: candidate, filter: trainingScope };

  const exec = useTrainingSession(
    initFor("exec"),
    trainingActive && mode === "exec",
    trainingScope,
    setTrainingScope,
  );
  const guided = useTrainingSession(
    initFor("guided"),
    trainingActive && mode === "guided",
    trainingScope,
    setTrainingScope,
  );
  const recall = useTrainingSession(
    initFor("recall"),
    trainingActive && mode === "recall",
    trainingScope,
    setTrainingScope,
  );
  const trace = useTrainingSession(
    initFor("trace"),
    trainingActive && mode === "trace",
    trainingScope,
    setTrainingScope,
  );
  const recognition = useTrainingSession(
    initFor("recognition"),
    trainingActive && mode === "recognition",
    trainingScope,
    setTrainingScope,
  );
  const sessions = { exec, guided, recall, trace, recognition };
  const selected = sessions[mode];
  const training = useMemo(
    () => ({ ...selected, mode, setMode }) as TrainingSession,
    [selected, mode],
  );

  const timer = useTimerSession({
    multiphase: prefs.multiphase,
    stage: init.stage ?? stage,
    active: pathname === "/",
  });
  const flashcards = useFlashcards({}, pathname === "/flashcards");

  return (
    <SessionWorkspaceContext.Provider value={{ timer, training, flashcards }}>
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
