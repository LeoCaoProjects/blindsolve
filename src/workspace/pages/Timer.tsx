import React from 'react';
import { WorkspaceTimer } from '../components/workspace/WorkspaceTimer';
import { useAppData } from '../contexts/AppDataContext';
import { useSessionWorkspace } from '../contexts/SessionWorkspaceContext';

export function Timer() {
  const { prefs } = useAppData();
  const { timer } = useSessionWorkspace();
  return <WorkspaceTimer showLiveTimer={prefs.showLiveTimer} session={timer} />;
}
