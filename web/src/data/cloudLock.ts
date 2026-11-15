/** Serialize Supabase work for one account across every tab in this browser profile. */
export async function withAccountCloudLock<T>(
  userId: string,
  operation: () => Promise<T>,
): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks)
    return operation();
  return navigator.locks.request(`blindsolve-cloud:${userId}`, operation);
}
