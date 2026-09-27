import React from 'react';
import { WorkspaceTimer } from '../components/concepts/workspace/WorkspaceTimer';
import { useAppData } from '../contexts/AppDataContext';
import { DemoStage } from '../types/solve';
import { useScreenInit } from '../useScreenInit.js';

export function Timer({ stage: stageProp }: {stage: DemoStage;}) {
  const init = useScreenInit() as {stage?: DemoStage;};
  const { prefs } = useAppData();
  const stage = init.stage ?? stageProp;
  return <WorkspaceTimer key={`${stage}-${prefs.multiphase}`} multiphase={prefs.multiphase} stage={stage} />;
}