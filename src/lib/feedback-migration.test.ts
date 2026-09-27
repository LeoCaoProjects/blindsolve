import { describe, expect, it } from 'vitest';
import sql from '../../supabase/migrations/202609270001_feedback.sql?raw';

describe('feedback database authorization', () => {
  it('allows public creation but reserves reading, updates and deletion for server-authorized admins', () => {
    expect(sql).toContain('feedback_anyone_create');
    expect(sql).toMatch(/for select to authenticated using \(public\.is_feedback_admin\(\)\)/i);
    expect(sql).toMatch(/for update to authenticated using \(public\.is_feedback_admin\(\)\)/i);
    expect(sql).toMatch(/for delete to authenticated using \(public\.is_feedback_admin\(\)\)/i);
    expect(sql).not.toMatch(/email\s*=/i);
  });

  it('keeps screenshot storage private and admin-readable', () => {
    expect(sql).toContain("'feedback-screenshots', 'feedback-screenshots', false");
    expect(sql).toContain('feedback_screenshot_admin_read');
  });
});
