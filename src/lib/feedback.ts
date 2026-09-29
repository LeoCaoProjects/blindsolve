import type { User } from '@supabase/supabase-js';
import type { Feedback, FeedbackStatus, NewFeedback } from '../magic/types/feedback';
import { supabase } from './supabase';
import { withAccountCloudLock } from './cloudLock';

type FeedbackRow = {
  id: string;
  user_id: string | null;
  contact_email: string | null;
  category: Feedback['category'];
  message: string;
  status: FeedbackStatus;
  source_page: string;
  technical_context: Feedback['context'] | null;
  screenshot_path: string | null;
  screenshot_name: string | null;
  admin_note: string | null;
  submitter_name: string | null;
  submitter_detail: string | null;
  submitter_provider: 'wca' | 'google' | null;
  created_at: string;
};

const requireClient = () => {
  if (!supabase) throw new Error('Feedback is unavailable until Supabase is configured');
  return supabase;
};

export async function feedbackAdmin(userId?: string): Promise<boolean> {
  if (!supabase) return false;
  const client = supabase;
  const request = async () => await client.rpc('is_feedback_admin');
  const { data, error } = userId
    ? await withAccountCloudLock(userId, request)
    : await request();
  if (error) return false;
  return data === true;
}

export async function submitFeedback(input: NewFeedback, user: User | null): Promise<Feedback> {
  const client = requireClient();
  const form = new FormData();
  form.set('category', input.category);
  form.set('message', input.message);
  form.set('contact', input.contact ?? '');
  form.set('source', input.source);
  form.set('context', input.context ? JSON.stringify(input.context) : '');
  if (input.screenshot?.file) form.set('screenshot', input.screenshot.file, input.screenshot.name);
  const { data, error } = await client.functions.invoke('submit-feedback', { body: form });
  if (error) throw error;
  const response = data as { id?: string; createdAt?: string } | null;
  if (!response?.id) throw new Error('Feedback could not be submitted');
  const provider = user?.user_metadata.auth_source === 'wca' ? 'wca' : user ? 'google' : null;
  const submitterName = user ? String(user.user_metadata.full_name ?? user.user_metadata.name ?? user.email ?? 'Signed in') : '';
  const submitterDetail = user ? String(user.user_metadata.wca_id ?? user.email ?? '') : '';
  return {
    id: response.id,
    category: input.category,
    message: input.message,
    status: 'new',
    createdAt: response.createdAt ?? new Date().toISOString(),
    contact: user ? undefined : input.contact,
    source: input.source,
    context: input.context,
    screenshot: input.screenshot ? { name: input.screenshot.name, url: input.screenshot.url } : undefined,
    user: user && provider ? { name: submitterName, detail: submitterDetail, provider } : undefined,
  };
}

export async function listFeedback(): Promise<Feedback[]> {
  const client = requireClient();
  const { data, error } = await client.from('feedback')
    .select('id,user_id,contact_email,category,message,status,source_page,technical_context,screenshot_path,screenshot_name,admin_note,submitter_name,submitter_detail,submitter_provider,created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return Promise.all((data as FeedbackRow[]).map(async (row) => {
    let url: string | undefined;
    if (row.screenshot_path) {
      const signed = await client.storage.from('feedback-screenshots').createSignedUrl(row.screenshot_path, 900);
      url = signed.data?.signedUrl;
    }
    return rowToFeedback(row, url);
  }));
}

export async function updateFeedback(id: string, patch: { status?: FeedbackStatus; note?: string }): Promise<void> {
  const client = requireClient();
  const values: Record<string, unknown> = {};
  if (patch.status) values.status = patch.status;
  if ('note' in patch) values.admin_note = patch.note?.trim() || null;
  const { error } = await client.from('feedback').update(values).eq('id', id);
  if (error) throw error;
}

export async function deleteFeedback(id: string): Promise<void> {
  const client = requireClient();
  const existing = await client.from('feedback').select('screenshot_path').eq('id', id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.screenshot_path) {
    const removed = await client.storage.from('feedback-screenshots').remove([existing.data.screenshot_path]);
    if (removed.error) throw removed.error;
  }
  const { error } = await client.from('feedback').delete().eq('id', id);
  if (error) throw error;
}

function rowToFeedback(row: FeedbackRow, screenshotUrl?: string): Feedback {
  return {
    id: row.id,
    category: row.category,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    contact: row.contact_email ?? undefined,
    source: row.source_page,
    context: row.technical_context ?? undefined,
    note: row.admin_note ?? undefined,
    screenshot: row.screenshot_name && screenshotUrl ? { name: row.screenshot_name, url: screenshotUrl } : undefined,
    user: row.submitter_provider && row.submitter_name ? {
      name: row.submitter_name,
      detail: row.submitter_detail ?? '',
      provider: row.submitter_provider,
    } : undefined,
  };
}
