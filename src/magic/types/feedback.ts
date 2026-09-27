import { AuthProvider } from './app';

export type FeedbackCategory = 'bug' | 'feature' | 'general';
export type FeedbackStatus = 'new' | 'reviewing' | 'planned' | 'resolved' | 'archived';

/** Non-sensitive technical context, attached automatically to bug reports. No mnemonic content. */
export interface FeedbackTechContext {
  build: string;
  browser: string;
  os: string;
  device: string;
  viewport: string;
  /** e.g. "Trace Sprint · Both" when the report came from Training */
  training?: string;
}

export interface Feedback {
  id: string;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  /** ISO timestamp */
  createdAt: string;
  /** Set automatically for signed-in users */
  user?: {name: string;detail: string;provider: AuthProvider;};
  /** Optional reply address from signed-out users */
  contact?: string;
  /** Area the user was in, e.g. "Training / Trace Sprint" */
  source: string;
  screenshot?: {name: string;url: string;};
  context?: FeedbackTechContext;
  /** Private, admins only */
  note?: string;
}

export type NewFeedback = Omit<Pick<Feedback, 'category' | 'message' | 'contact' | 'screenshot' | 'source' | 'context'>, 'screenshot'> & {
  screenshot?: {name: string;url: string;file?: File;};
};

export const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  bug: 'Bug',
  feature: 'Feature request',
  general: 'General'
};

export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  planned: 'Planned',
  resolved: 'Resolved',
  archived: 'Archived'
};

export const STATUS_ORDER: FeedbackStatus[] = ['new', 'reviewing', 'planned', 'resolved', 'archived'];
