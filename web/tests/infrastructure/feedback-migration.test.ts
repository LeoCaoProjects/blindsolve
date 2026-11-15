import { describe, expect, it } from 'vitest';
import sql from '../../../supabase/migrations/202609270001_feedback.sql?raw';
import hardening from '../../../supabase/migrations/202609280006_feedback_submission_boundary.sql?raw';

describe('feedback database authorization', () => {
  it('reserves reading, updates and deletion for server-authorized admins', () => {
    expect(sql).toMatch(/for select to authenticated using \(public\.is_feedback_admin\(\)\)/i);
    expect(sql).toMatch(/for update to authenticated using \(public\.is_feedback_admin\(\)\)/i);
    expect(sql).toMatch(/for delete to authenticated using \(public\.is_feedback_admin\(\)\)/i);
    expect(sql).not.toMatch(/email\s*=/i);
  });

  it('keeps screenshot storage private and admin-readable', () => {
    expect(sql).toContain("'feedback-screenshots', 'feedback-screenshots', false");
    expect(sql).toContain('feedback_screenshot_admin_read');
  });

  it('routes public submissions through the rate-limited server boundary', () => {
    expect(hardening).toContain('consume_feedback_submission_slot');
    expect(hardening).toContain('revoke insert on table public.feedback from anon, authenticated');
    expect(hardening).toContain('drop policy if exists feedback_screenshot_create');
    expect(hardening).toContain('grant execute on function public.consume_feedback_submission_slot(text) to service_role');
  });
});
