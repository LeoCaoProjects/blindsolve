import React from 'react';
import { WorkspaceTimer } from '../components/concepts/workspace/WorkspaceTimer';
import { useAppData } from '../contexts/AppDataContext';
import { DemoStage } from '../types/solve';
import { useScreenInit } from '../useScreenInit.js';
import { useSessionWorkspace } from '../contexts/SessionWorkspaceContext';

export function Timer({ stage: stageProp }: {stage: DemoStage;}) {
  const init = useScreenInit() as {stage?: DemoStage;};
  const { prefs } = useAppData();
  const stage = init.stage ?? stageProp;
  const { timer } = useSessionWorkspace();
  return <WorkspaceTimer multiphase={prefs.multiphase} showLiveTimer={prefs.showLiveTimer} stage={stage} session={timer} />;
}
